import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { refreshSecurityChecks } from "@/lib/server/security-refresh";
import { AuditError, errorResponse, readBody } from "@/lib/server/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  const deadline = AbortSignal.timeout(55_000);
  try {
    const { url } = await readBody(request);
    const result = await refreshSecurityChecks(
      url,
      AbortSignal.any([request.signal, deadline]),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(
      deadline.aborted && !request.signal.aborted
        ? new AuditError(
            "Security checks took longer than expected. Try again.",
            504,
            "SECURITY_TIMEOUT",
          )
        : error,
    );
  }
}
