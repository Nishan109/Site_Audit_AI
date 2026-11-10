import { workspaceAccess } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { readBody, errorResponse } from "@/lib/server/errors";
import { normalizeUrl } from "@/lib/server/url";
import { researchWebsite } from "@/lib/server/research";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  try {
    const { url } = await readBody(request);
    const result = await researchWebsite(normalizeUrl(url), AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]));
    return NextResponse.json({
      provider: result.provider, modelUsed: result.modelUsed, summary: result.summary,
      searchedAt: new Date().toISOString(), sources: result.sources, queries: result.searchQueries,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
