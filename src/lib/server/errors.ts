import { NextResponse } from "next/server";
import { z } from "zod";

export class AuditError extends Error {
  constructor(
    message: string,
    public status = 502,
    public code = "ANALYSIS_FAILED",
  ) {
    super(message);
  }
}

export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new AuditError(
      "Send a valid JSON request body.",
      400,
      "INVALID_REQUEST",
    );
  }
}

export function auditErrorDetails(error: unknown) {
  if (error instanceof AuditError) {
    return { error: error.message, code: error.code, status: error.status };
  }
  if (error instanceof z.ZodError) {
    console.error(
      "AI report schema validation failed:",
      error.issues.map(({ path, code }) => ({ path, code })),
    );
    return {
      error:
        "The AI returned an incomplete report. Please try again; no template results have been substituted.",
      code: "INVALID_AI_RESPONSE",
      status: 502,
    };
  }
  // Never expose SDK errors: they can contain URLs, credentials, or page data.
  console.error(
    "Audit request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return {
    error: "Analysis could not be completed. Please try again.",
    code: "ANALYSIS_FAILED",
    status: 502,
  };
}

export function errorResponse(error: unknown) {
  const { status, ...body } = auditErrorDetails(error);
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
