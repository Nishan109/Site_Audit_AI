import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { errorResponse, readBody } from "@/lib/server/errors";
import {
  requestPageSpeed,
  PageSpeedError,
} from "@/lib/server/pagespeed-request";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  try {
    const { url, strategy } = await readBody(request);
    const result = await requestPageSpeed(
      url,
      strategy,
      AbortSignal.any([request.signal, AbortSignal.timeout(85_000)]),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PageSpeedError)
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          keyConfigured: error.keyConfigured,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
            ...(error.retryAfterSeconds
              ? { "Retry-After": String(error.retryAfterSeconds) }
              : {}),
          },
        },
      );
    return errorResponse(error);
  }
}
