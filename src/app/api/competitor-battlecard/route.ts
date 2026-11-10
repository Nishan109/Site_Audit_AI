import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { normalizeUrl, validatePublicHost } from "@/lib/server/url";
import { researchWebsite } from "@/lib/server/research";
import { generateJson } from "@/lib/server/gemini";
import { errorResponse, readBody, AuditError } from "@/lib/server/errors";
import { competitorsSchema } from "@/lib/server/schemas";
import { searchWeb } from "@/lib/server/web-search";
export const maxDuration = 120;
export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  try {
    const body=await readBody(request); const url=normalizeUrl(body.url); await validatePublicHost(url);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(110_000)]);
    const research=await researchWebsite(url,signal);
    const result=await generateJson(`Create up to 2 competitor battlecards for ${url} using ONLY this live research. Competitor names and website URLs must appear in the research notes or collected sources. Do not invent rivals or domains. Distinguish researched facts from suggested strategies. Return an empty competitors array if no real competitor was verified. Research: ${JSON.stringify(research)}`,competitorsSchema,signal);
    if(!result.data.competitors.length) throw new AuditError("The research agent could not verify suitable competitors. Try again later.",422,"INSUFFICIENT_RESEARCH");
    const sources=new Set(research.sources);
    const queries=[...research.searchQueries];
    for(const competitor of result.data.competitors) {
      competitor.url=normalizeUrl(competitor.url);
      const domain=new URL(competitor.url).hostname.replace(/^www\./,"");
      const observed=research.sourceEvidence.includes(domain) || research.discoveredUrls.some(source=>{try{return new URL(source).hostname.replace(/^www\./,"")===domain;}catch{return false;}});
      if(observed) continue;
      // Comparison articles may name alternatives without linking their official
      // sites. Confirm the proposed domain through a real follow-up search.
      const evidenceText=research.sourceEvidence.normalize("NFKD").toLowerCase();
      const nameTokens=competitor.name.normalize("NFKD").toLowerCase().match(/[\p{L}\p{N}]{5,}/gu)||[];
      if(!nameTokens.some(token=>evidenceText.includes(token))) throw new AuditError("A competitor's name was not supported by the collected research.",502,"UNSUPPORTED_FINDING");
      const official=await searchWeb(`${competitor.name} official website`,signal);
      const matched=official.results.find(source=>new URL(source.url).hostname.replace(/^www\./,"")===domain);
      if(!matched) throw new AuditError("A competitor's official domain could not be verified by live search.",502,"UNSUPPORTED_FINDING");
      competitor.url=matched.url;
      sources.add(matched.url); queries.push(official.query);
    }
    return NextResponse.json({...result.data,modelUsed:result.modelUsed,sources:[...sources],searchQueries:queries,dataSource:"live"});
  } catch(error) { return errorResponse(error); }
}
