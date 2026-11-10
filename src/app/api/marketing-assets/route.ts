import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { collectEvidence } from "@/lib/server/evidence";
import { generateJson } from "@/lib/server/gemini";
import { errorResponse, readBody, AuditError } from "@/lib/server/errors";
import { adsSchema } from "@/lib/server/schemas";
export const maxDuration = 90;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  try {
    const body = await readBody(request);
    if (body.customInstructions !== undefined && (typeof body.customInstructions !== "string" || body.customInstructions.length > 3000)) throw new AuditError("Copywriter instructions must be text under 3,000 characters.",400);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(80_000)]);
    const evidence = await collectEvidence(body.url,signal);
    const result = await generateJson(`Write 3 Google search ad drafts (headline maximum 30 characters, description maximum 90) and 2 Facebook ad drafts for the ACTUAL business described below. Do not invent prices, discounts, certifications, results or functionality. The score is a qualitative AI copy-quality assessment, never a measured performance prediction. Give a specific reason for each draft. Do not predict CTR or conversion percentages. Optional user instructions: ${JSON.stringify(body.customInstructions||"")}. Page evidence: ${JSON.stringify(evidence.pages.map(p=>p.content))}`,adsSchema,signal);
    return NextResponse.json({...result.data,modelUsed:result.modelUsed,dataSource:"live",assessmentNotice:"AI-generated drafts based on collected page content. Scores assess copy quality; advertising performance has not been measured."});
  } catch(error) { return errorResponse(error); }
}
