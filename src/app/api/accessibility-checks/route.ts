import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { refreshAccessibilityChecks } from "@/lib/server/accessibility-refresh";
import { errorResponse, readBody } from "@/lib/server/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  try {
    const { url } = await readBody(request);
    const result = await refreshAccessibilityChecks(
      url,
      AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
