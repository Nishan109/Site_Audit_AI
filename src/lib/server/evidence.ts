import { createHash } from "node:crypto";
import { loadPageHTML } from "./streamed-html";
import { AuditError } from "./errors";
import { normalizeUrl } from "./url";
import { readPublicHTML as readPage } from "./website-fetch";
import { extractMessagingCopy, type MessagingCopy } from "./messaging-evidence";
import { extractUXEvidence, type UXSnapshot } from "./ux-evidence";
import { extractSEOEvidence, type SEOResponse } from "./seo-evidence";
import type { SEOPage } from "../seo";
import type { SecurityResponse, SecuritySnapshot } from "../security";
import { extractSecurityEvidence } from "./security-evidence";
import { extractAccessibilityEvidence } from "./accessibility-evidence";
import type { AccessibilitySnapshot } from "../accessibility";

export interface PageEvidence {
  url: string; title: string; contentHash: string; fetchedAt: string;
  content: string; links: Array<{ text: string; url: string }>; schemaTypes: string[];
  messagingCopy?: MessagingCopy;
  uxSnapshot?: UXSnapshot;
  seoSnapshot?: SEOPage;
  securitySnapshot?: SecuritySnapshot;
  accessibilitySnapshot?: AccessibilitySnapshot;
  collectionNote?: string;
  facts: { https: boolean; csp: boolean; mixedAssets: number; images: number; missingAlt: number; h1Count: number; headingsOrdered: boolean; unnamedControls: number };
}

export function extractEvidence(html: string, url: string, csp: boolean, seoResponse?: SEOResponse, securityResponse?: SecurityResponse): PageEvidence {
  const { $, boundaries, segments } = loadPageHTML(html);
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const title = clean($("title").first().text());
  const description = $("meta[name='description']").attr("content") || "";
  const canonical = $("link[rel='canonical']").attr("href") || "";
  const schemaTypes = new Set<string>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) { item.forEach(visit); return; }
    for (const [key, value] of Object.entries(item)) {
      if (key === "@type") { for (const type of Array.isArray(value) ? value : [value]) if (typeof type === "string") schemaTypes.add(type); }
      else if (typeof value === "object") visit(value);
    }
  };
  $("script[type='application/ld+json']").each((_, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Invalid JSON-LD is not counted. */ } });
  const headings = $("h1,h2,h3,h4,h5,h6").toArray().map(el => `${el.tagName.toUpperCase()}: ${clean($(el).text())}`).slice(0, 50);
  let previous = 0; let headingsOrdered = true;
  $("h1,h2,h3,h4,h5,h6").each((_, el) => { const rank = Number(el.tagName.slice(1)); if (rank > previous + 1) headingsOrdered = false; previous = rank; });
  const links = $("a[href]").toArray().flatMap(el => { try { const link = new URL($(el).attr("href")!, url); return /^https?:$/.test(link.protocol) ? [{ text: clean($(el).text()).slice(0, 120), url: link.href }] : []; } catch { return []; } }).slice(0, 100);
  const ctas = $("button,a[role='button'],input[type='submit']").toArray().map(el => clean($(el).text() || $(el).attr("value") || $(el).attr("aria-label") || "")).filter(Boolean).slice(0, 35);
  let unnamedControls = 0;
  $("button,input:not([type='hidden']):not([type='submit']):not([type='button']),select,textarea").each((_, el) => {
    const node = $(el); const id = node.attr("id");
    const label = id ? $("label").toArray().some(label => $(label).attr("for") === id && clean($(label).text())) : false;
    const labelledBy = (node.attr("aria-labelledby") || "").split(/\s+/).some(id => id && $("[id]").toArray().some(el => $(el).attr("id") === id && clean($(el).text())));
    if (!(node.attr("aria-label") || labelledBy || label || node.closest("label").length || node.attr("title") || el.tagName === "button" && clean(node.text()))) unnamedControls++;
  });
  const facts = { https: url.startsWith("https:"), csp, mixedAssets: $("script[src],img[src],link[rel='stylesheet'][href],iframe[src]").toArray().filter(el => /^http:\/\//i.test($(el).attr("src") || $(el).attr("href") || "")).length, images: $("img").length, missingAlt: $("img:not([alt])").length, h1Count: $("h1").length, headingsOrdered, unnamedControls };
  const forms = $("form").toArray().map(el => ({ fields: $(el).find("input:not([type='hidden']),select,textarea").toArray().map(input => ({ name: $(input).attr("name") || $(input).attr("id") || "unnamed", type: $(input).attr("type") || input.tagName })) })).slice(0, 10);
  $("script,style,noscript,template,svg,[hidden],[inert],[aria-hidden='true']").remove();
  $("[style]").each((_, element) => { if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test($(element).attr("style") || "")) $(element).remove(); });
  const text = clean($("body").find("*").addBack().contents().filter((_,node)=>node.type === "text").toArray().map(node=>"data" in node ? node.data : "").join(" ")).slice(0, 16000);
  const content = `URL: ${url}\nTitle: ${title || "missing"}\nMeta description: ${description || "missing"}\nCanonical: ${canonical || "missing"}\nHeadings: ${headings.join(" | ") || "none"}\nButtons: ${ctas.join(" | ") || "none"}\nSchema types: ${[...schemaTypes].join(", ") || "none detected"}\nHTML observations: ${JSON.stringify(facts)}\nForms: ${JSON.stringify(forms)}\nVisible text: ${text}`;
  return { url, title, links, schemaTypes: [...schemaTypes], facts, content, messagingCopy: extractMessagingCopy(html), uxSnapshot: extractUXEvidence(html, url), seoSnapshot: extractSEOEvidence(html, url, seoResponse), securitySnapshot: extractSecurityEvidence(html, url, securityResponse), accessibilitySnapshot: extractAccessibilityEvidence(html), collectionNote: boundaries || segments ? `Read completed server-streamed HTML (${boundaries} boundary/boundaries, ${segments} segment(s)). Page JavaScript was not executed; rendered appearance and interactions remain untested.` : undefined, fetchedAt: new Date().toISOString(), contentHash: createHash("sha256").update(html).digest("hex") };
}

export async function collectEvidence(rawUrl: unknown, signal: AbortSignal, onSubmittedPageRead?: (relatedPages: number) => void) {
  const url = normalizeUrl(rawUrl);
  let root;
  try { root = await readPage(url, signal); }
  catch (error) { signal.throwIfAborted(); if (error instanceof AuditError) throw error; throw new AuditError("The website could not be securely read. Check its URL, certificate, and public accessibility.", 422, "WEBSITE_UNREACHABLE"); }
  const homepage = extractEvidence(root.html, root.url, root.csp, root.seoResponse, root.securityResponse);
  assertReadablePage(homepage);
  const candidates = [...new Set(homepage.links.filter(link => { const target = new URL(link.url); return target.origin === new URL(homepage.url).origin && !target.search && /\/(about|pricing|features|products|services)(\/|$)/i.test(target.pathname) && target.href !== homepage.url; }).map(link => link.url))].slice(0, 2);
  signal.throwIfAborted();
  onSubmittedPageRead?.(candidates.length);
  const additional = await Promise.allSettled(candidates.map(async target => { const page = await readPage(target, AbortSignal.any([signal, AbortSignal.timeout(10_000)])); if (new URL(page.url).origin !== new URL(homepage.url).origin) throw new Error("External redirect"); return extractEvidence(page.html, page.url, page.csp, page.seoResponse, page.securityResponse); }));
  signal.throwIfAborted();
  const pages = [homepage, ...additional.flatMap(item => item.status === "fulfilled" ? [item.value] : [])];
  const warnings = additional.flatMap((item, index) => item.status === "rejected" ? [`Could not read ${candidates[index]}; that page is excluded from this report.`] : []);
  return { url: homepage.url, pages, warnings };
}

export function assertReadablePage(page: PageEvidence) {
  const readable = page.messagingCopy?.blocks.map((block) => block.text).join(" ") || "";
  if (readable.length < 100) throw new AuditError("This page did not provide enough readable content in its HTML response. It may require JavaScript or sign-in. Try a public page with readable content.", 422, "INSUFFICIENT_EVIDENCE");
}

export async function readEvidencePage(url: string, signal: AbortSignal): Promise<PageEvidence> {
  const page = await readPage(normalizeUrl(url), signal);
  return extractEvidence(page.html, page.url, page.csp, page.seoResponse, page.securityResponse);
}

const normalize = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
export function evidenceCatalog(pages: PageEvidence[]) {
  return pages.flatMap((page, pageIndex) => page.content.split(/\n|(?<=[.!?])\s+/).filter(text=>text.trim().length>=5).flatMap(text=>text.match(/.{1,260}(?:\s|$)/g)||[text]).map((quote,index)=>({id:`P${pageIndex+1}-E${index+1}`,pageUrl:page.url,quote:quote.trim()})));
}
export function assertEvidence(items: Array<{ pageUrl: string; evidence: string }>, pages: PageEvidence[]) {
  const catalog=evidenceCatalog(pages);
  for (const item of items) {
    const reference=catalog.find(entry=>entry.id===item.evidence && entry.pageUrl===item.pageUrl);
    if(reference) item.evidence=reference.quote;
    const page = pages.find(page => page.url === item.pageUrl);
    if (!page || !normalize(page.content).includes(normalize(item.evidence))) throw new AuditError("An AI finding could not be matched to collected page evidence. Please retry; the unverified report was not displayed.", 502, "UNSUPPORTED_FINDING");
  }
}

export function consistentWithFacts(item: {pageUrl:string; title?:string; detail?:string; action?:string}, pages:PageEvidence[]) {
  const page=pages.find(page=>page.url===item.pageUrl);
  if(!page) return false;
  const text=[item.title,item.detail,item.action].filter(Boolean).join(" ").toLowerCase();
  if (/\balt[ -]*(text|attributes?|tags?)\b/.test(text) && page.facts.missingAlt===0) return false;
  if (/\b(duplicate|multiple|redundant)\b.*\bh1\b|\bh1\b.*\b(duplicate|multiple|redundant)\b/.test(text) && page.facts.h1Count<=1) return false;
  if (/heading (hierarchy|levels)|heading level|skipped heading|non.sequential heading/.test(text) && page.facts.headingsOrdered) return false;
  if (/csp|content security policy/.test(text) && /missing|absent|implement|add /.test(text) && page.facts.csp) return false;
  if (/missing canonical|no canonical|add (a )?canonical/.test(text) && !page.content.includes("Canonical: missing")) return false;
  return true;
}

export function uniqueFindings<T extends {pageUrl:string;evidence:string;title?:string;action?:string}>(items:T[]):T[] {
  const titles=new Set<string>(); const citations=new Set<string>();
  return items.filter(item=>{
    const title=item.pageUrl+"|"+normalize(item.title||item.action||"");
    const citation=item.pageUrl+"|"+normalize(item.evidence);
    if(titles.has(title)||citations.has(citation)) return false;
    titles.add(title); citations.add(citation); return true;
  });
}
