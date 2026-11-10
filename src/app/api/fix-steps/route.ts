import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { collectEvidence } from "@/lib/server/evidence";
import { generateJson } from "@/lib/server/gemini";
import { errorResponse, readBody } from "@/lib/server/errors";
import { fixStepSchema } from "@/lib/server/schemas";
export const maxDuration = 90;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  try {
    const body = await readBody(request);
    const input = z.object({url:z.string(),issueTitle:z.string().min(3).max(250),issueDetail:z.string().min(3).max(4000)}).safeParse(body);
    if (!input.success) return NextResponse.json({error:"A valid URL, issue title and detail are required."},{status:400});
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(80_000)]);
    const evidence = await collectEvidence(input.data.url, signal);
    const result = await generateJson(`Provide 3-5 specific implementation steps for this issue: ${JSON.stringify(input.data)}. Use only the following actual page evidence. If the issue is not supported, explain how to verify it before changing anything. Never pretend to have edited the site. ${JSON.stringify(evidence.pages.map(p=>p.content))}`, z.object({steps:z.array(fixStepSchema).min(2).max(5)}),signal);
    return NextResponse.json({...result.data,modelUsed:result.modelUsed,dataSource:"live"});
  } catch(error) { return errorResponse(error); }
}
