import { workspaceAccess } from "@/lib/server/auth";
import { creativeComparisonResponse } from "@/lib/server/creative-comparison-response";
export const maxDuration = 90;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  return denied || creativeComparisonResponse(request);
}
