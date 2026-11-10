import { analyzeWebsite } from "@/lib/server/audit";
import { auditResponse } from "@/lib/server/audit-stream";
import { currentAccount, workspaceAccess } from "@/lib/server/auth";
import { saveCompletedReport } from "@/lib/server/report-store";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  const owner = await currentAccount();
  if (!owner) return Response.json({ error: "Log in to continue.", code: "AUTH_REQUIRED" }, { status: 401 });
  return auditResponse(request, analyzeWebsite, 160_000,
    (report, signal) => saveCompletedReport(report, owner, signal));
}
