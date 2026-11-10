import { load } from "cheerio";
import { AuditError } from "./errors";
import { normalizeUrl } from "./url";

export interface SearchResult { title: string; url: string; snippet: string }
export interface WebSearchResult { provider: "DuckDuckGo" | "Bing RSS"; query: string; results: SearchResult[] }

function publicResultUrl(value: string, base: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value, base);
    return normalizeUrl(url.searchParams.get("uddg") || url.href);
  } catch { return null; }
}

export function parseSearchResults(body: string, provider: WebSearchResult["provider"]): SearchResult[] {
  const $ = load(body, { xmlMode: provider === "Bing RSS" });
  const entries = provider === "DuckDuckGo" ? $(".result").toArray() : $("item").toArray();
  const seen = new Set<string>();
  return entries.flatMap(entry => {
    const item = $(entry);
    const title = provider === "DuckDuckGo" ? item.find(".result__a").text() : item.find("title").text();
    const rawUrl = provider === "DuckDuckGo" ? item.find(".result__a").attr("href") || "" : item.find("link").text();
    const rawSnippet = provider === "DuckDuckGo" ? item.find(".result__snippet").text() : item.find("description").text();
    const url = publicResultUrl(rawUrl, provider === "DuckDuckGo" ? "https://duckduckgo.com" : "https://www.bing.com");
    if (!url || !title.trim() || seen.has(url)) return [];
    seen.add(url);
    const snippet = load(rawSnippet).text().replace(/\s+/g, " ").trim().slice(0, 1200);
    return [{ title: title.replace(/\s+/g, " ").trim().slice(0, 250), url, snippet }];
  }).slice(0, 6);
}

export async function searchWeb(query: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<WebSearchResult> {
  const endpoints: Array<{ provider: WebSearchResult["provider"]; url: URL }> = [
    { provider: "DuckDuckGo", url: new URL("https://html.duckduckgo.com/html/") },
    { provider: "Bing RSS", url: new URL("https://www.bing.com/search?format=rss") },
  ];
  for (const endpoint of endpoints) {
    if (signal.aborted) break;
    endpoint.url.searchParams.set("q", query);
    try {
      const response = await fetcher(endpoint.url, {
        cache: "no-store", redirect: "error",
        headers: { "User-Agent": "SiteAuditAI/1.0", Accept: endpoint.provider === "Bing RSS" ? "application/rss+xml,text/xml" : "text/html" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
      // Challenge/error pages are not research evidence.
      if (response.status !== 200) continue;
      const body = await response.text();
      if (body.length > 1_500_000) continue;
      const results = parseSearchResults(body, endpoint.provider);
      if (results.length) return { provider: endpoint.provider, query, results };
    } catch { /* Try the other public search endpoint; never invent results. */ }
  }
  throw new AuditError("Web search could not return usable sources. Google grounding is also unavailable. Please retry later.", 503, "RESEARCH_UNAVAILABLE");
}
