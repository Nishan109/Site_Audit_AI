import { loadPageHTML } from "./streamed-html";
import type { SEOPage, SEOSource, SEOCheck } from "../seo";
import type { PageEvidence } from "./evidence";
import { extractMessagingCopy } from "./messaging-evidence";

export interface SEOResponse {
  status: number;
  xRobotsTag: string[];
  link: string[];
}
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
export function extractSEOEvidence(
  html: string,
  pageUrl: string,
  response?: SEOResponse,
): SEOPage {
  const { $ } = loadPageHTML(html);
  let truncated = false;
  const limited = (values: string[], maximum = 15, length = 1800) => {
    if (
      values.length > maximum ||
      values.some((value) => value.length > length)
    )
      truncated = true;
    return values.slice(0, maximum).map((value) => value.slice(0, length));
  };
  const titles = limited(
    $("head title")
      .toArray()
      .map((element) => clean($(element).text())),
  );
  const descriptions = limited(
    $("meta[name]")
      .toArray()
      .filter(
        (element) => $(element).attr("name")?.toLowerCase() === "description",
      )
      .map((element) => clean($(element).attr("content") || "")),
  );
  let base = pageUrl;
  try {
    base = new URL($("base[href]").first().attr("href") || pageUrl, pageUrl)
      .href;
  } catch {
    /* Invalid base does not invent a canonical target. */
  }
  const canonical = (href: string, method: "HTML" | "HTTP header") => {
    let resolved: string | null = null;
    try {
      const target = new URL(href, method === "HTML" ? base : pageUrl);
      if (href.trim() && /^https?:$/.test(target.protocol))
        resolved = target.href;
    } catch {
      /* Literal invalid values remain visible. */
    }
    return { href: href.slice(0, 1800), resolved, method };
  };
  const htmlCanonicals = $("head link[rel]")
    .toArray()
    .filter((element) =>
      /(?:^|\s)canonical(?:\s|$)/i.test($(element).attr("rel") || ""),
    )
    .map((element) => canonical($(element).attr("href") || "", "HTML"));
  const httpCanonicals = (response?.link || []).flatMap((header) =>
    [...header.matchAll(/<([^>]+)>\s*([^<]*?)(?=,\s*<|$)/g)].flatMap(
      (match) => {
        const rel = match[2].match(
          /(?:^|;)\s*rel\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;,\s]+))/i,
        );
        return rel &&
          /(?:^|\s)canonical(?:\s|$)/i.test(rel[1] || rel[2] || rel[3])
          ? [canonical(match[1], "HTTP header")]
          : [];
      },
    ),
  );
  const canonicals = [...htmlCanonicals, ...httpCanonicals];
  const directives: SEOPage["directives"] = $("meta[name]")
    .toArray()
    .filter((element) =>
      /^(robots|googlebot|googlebot-news|bingbot)$/i.test(
        $(element).attr("name") || "",
      ),
    )
    .map((element) => ({
      agent: $(element).attr("name")!.toLowerCase(),
      value: clean($(element).attr("content") || "").slice(0, 1600),
      method: "HTML" as const,
    }));
  directives.push(
    ...(response?.xRobotsTag || []).map((value) => ({
      agent: "header (scope in value)",
      value: value.slice(0, 1600),
      method: "HTTP header" as const,
    })),
  );
  const structured: SEOPage["structured"] = {
    jsonLdBlocks: 0,
    invalidJsonLd: 0,
    jsonLdTypes: [],
    microdataTypes: [],
    rdfaTypes: [],
  };
  const types = new Set<string>();
  const visit = (value: unknown, depth = 0) => {
    if (depth > 30 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((value) => visit(value, depth + 1));
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (key === "@type")
        for (const type of Array.isArray(entry) ? entry : [entry]) {
          if (typeof type === "string") types.add(type);
        }
      else visit(entry, depth + 1);
    }
  };
  $("script[type]").each((_, element) => {
    if (
      ($(element).attr("type") || "").split(";")[0].trim().toLowerCase() !==
      "application/ld+json"
    )
      return;
    structured.jsonLdBlocks++;
    try {
      visit(JSON.parse($(element).text()));
    } catch {
      structured.invalidJsonLd++;
    }
  });
  structured.jsonLdTypes = limited([...types], 40, 300);
  structured.microdataTypes = limited(
    [
      ...new Set(
        $("[itemscope][itemtype]")
          .toArray()
          .flatMap((element) =>
            ($(element).attr("itemtype") || "").split(/\s+/).filter(Boolean),
          ),
      ),
    ],
    40,
    300,
  );
  structured.rdfaTypes = limited(
    [
      ...new Set(
        $("[typeof]")
          .toArray()
          .flatMap((element) =>
            ($(element).attr("typeof") || "").split(/\s+/).filter(Boolean),
          ),
      ),
    ],
    40,
    300,
  );
  const copy = extractMessagingCopy(html);
  const headings = copy.blocks
    .filter((block) => block.kind === "heading")
    .map((block) => ({ level: 0, text: block.text }));
  // Read real element ranks separately; CSS sizing is outside this assessment.
  $("script,style,noscript,template,[hidden],[aria-hidden='true']").remove();
  const ranked = $("h1,h2,h3,h4,h5,h6")
    .toArray()
    .filter((element) => clean($(element).text()))
    .map((element) => ({
      level: Number(element.tagName.slice(1)),
      text: clean($(element).text()).slice(0, 900),
    }));
  const internalLinks = $("a[href]")
    .toArray()
    .flatMap((element) => {
      try {
        const target = new URL($(element).attr("href")!, base);
        return /^https?:$/.test(target.protocol) &&
          target.origin === new URL(pageUrl).origin
          ? [
              {
                text: clean(
                  $(element).text() || $(element).attr("aria-label") || "",
                ).slice(0, 300),
                url: target.href.slice(0, 1800),
              },
            ]
          : [];
      } catch {
        return [];
      }
    });
  if (
    ranked.length > 60 ||
    internalLinks.length > 80 ||
    canonicals.length > 15 ||
    directives.length > 15
  )
    truncated = true;
  const content = copy.blocks.filter(
    (block) =>
      ["main", "body"].includes(block.region) &&
      !["link", "button", "heading"].includes(block.kind),
  );
  return {
    url: pageUrl,
    titles,
    descriptions,
    canonicals: canonicals.slice(0, 15),
    directives: directives.slice(0, 15),
    headersChecked: !!response,
    responseStatus: response?.status ?? null,
    headings: (ranked.length ? ranked : headings).slice(0, 60),
    internalLinks: internalLinks.slice(0, 80),
    structured,
    content: content.slice(0, 35).map((block) => block.text),
    language: $("html").attr("lang") || "",
    truncated: truncated || copy.truncated || content.length > 35,
  };
}

export function seoCatalog(pages: PageEvidence[]): SEOSource[] {
  return pages.flatMap((page, index) => {
    const seo = page.seoSnapshot;
    if (!seo) return [];
    return (
      [
        [
          "metadata",
          "Titles and meta descriptions",
          {
            titles: seo.titles,
            descriptions: seo.descriptions,
            language: seo.language,
          },
        ],
        [
          "canonical",
          "Canonical declarations",
          {
            declarations: seo.canonicals,
            headersChecked: seo.headersChecked,
            finalUrl: seo.url,
          },
        ],
        [
          "directives",
          "Page-level indexing directives",
          {
            directives: seo.directives,
            headersChecked: seo.headersChecked,
            responseStatus: seo.responseStatus,
            scope:
              "Initial HTML and available response headers; robots.txt and actual indexing were not checked.",
          },
        ],
        [
          "headings",
          "Collected heading outline",
          {
            headings: seo.headings,
            scope: "HTML outline, not rendered sizes or ranking signals.",
          },
        ],
        [
          "links",
          "Sampled same-origin links",
          {
            links: seo.internalLinks,
            destinationsTested: false,
            truncated: seo.truncated,
          },
        ],
        [
          "structured",
          "Structured data in initial HTML",
          {
            ...seo.structured,
            scope:
              "JSON syntax and declared types only. Rich Results eligibility and search appearance were not tested.",
          },
        ],
        [
          "content",
          "Collected main copy",
          { copy: seo.content, truncated: seo.truncated },
        ],
      ] as const
    ).map(([kind, label, observation], sourceIndex) => ({
      id: `S${index + 1}-E${sourceIndex + 1}`,
      pageUrl: page.url,
      kind,
      label,
      observation: JSON.stringify(observation),
    }));
  });
}

export function seoChecks(pages: PageEvidence[]): SEOCheck[] {
  return pages.flatMap((page, index) => {
    const seo = page.seoSnapshot;
    if (!seo) return [];
    const make = (
      suffix: string,
      key: SEOCheck["key"],
      label: string,
      status: SEOCheck["status"],
      detail: string,
      source: number,
    ): SEOCheck => ({
      id: `page-${index + 1}-${suffix}`,
      key,
      label,
      status,
      detail,
      pageUrl: page.url,
      sourceIds: [`S${index + 1}-E${source}`],
    });
    const targets = new Set(
      seo.canonicals.flatMap((item) => item.resolved || []),
    );
    const noindex = seo.directives.some((item) =>
      /\b(?:noindex|none)\b/i.test(item.value),
    );
    const hasStructured =
      seo.structured.jsonLdBlocks +
        seo.structured.microdataTypes.length +
        seo.structured.rdfaTypes.length >
      0;
    return [
      make(
        "title",
        "metadata",
        "Page title",
        seo.titles.length === 1 && !!seo.titles[0] ? "observed" : "review",
        seo.titles.length === 1 && seo.titles[0]
          ? "One non-empty title element was collected. Relevance is assessed separately."
          : "No single non-empty title was established in the initial HTML. Review the collected values.",
        1,
      ),
      make(
        "description",
        "metadata",
        "Meta description",
        seo.descriptions.length === 1 && !!seo.descriptions[0]
          ? "observed"
          : "review",
        seo.descriptions.length === 1 && seo.descriptions[0]
          ? "One non-empty meta description was collected. It may not be the snippet used by a search engine."
          : "A single non-empty meta description was not established. This does not prove an indexing problem.",
        1,
      ),
      make(
        "canonical",
        "discovery",
        "Canonical declaration",
        !seo.canonicals.length
          ? "not-observed"
          : targets.size > 1 || seo.canonicals.some((item) => !item.resolved)
            ? "review"
            : "observed",
        !seo.canonicals.length
          ? `No canonical was collected${seo.headersChecked ? " in HTML or response headers" : " in HTML; response headers were not available"}. Its absence alone does not establish a defect.`
          : targets.size > 1
            ? "Different canonical targets were collected. Verify the intended preferred URL before changing anything."
            : seo.canonicals.some((item) => !item.resolved)
              ? "A canonical declaration did not resolve to a non-empty HTTP(S) URL."
              : "A canonical preference was observed. Search-engine selection of a canonical was not checked.",
        2,
      ),
      make(
        "directives",
        "discovery",
        "Indexing directives",
        noindex ? "review" : "observed",
        noindex
          ? "A restrictive noindex/none token was collected. Check its crawler scope and whether exclusion is intentional; actual indexing was not tested."
          : `No noindex/none token was collected${seo.headersChecked ? " in page directives and response headers" : " in page directives; response headers were not available"}. This does not establish crawlability or indexing.`,
        3,
      ),
      make(
        "structured",
        "structured",
        "Structured data",
        seo.structured.invalidJsonLd
          ? "review"
          : hasStructured
            ? "observed"
            : "not-observed",
        seo.structured.invalidJsonLd
          ? `${seo.structured.invalidJsonLd} JSON-LD block(s) did not parse as JSON. Vocabulary correctness and eligibility remain untested.`
          : hasStructured
            ? "Structured-data syntax or type declarations were collected. Rich-result eligibility was not validated."
            : "No JSON-LD, microdata item types or RDFa types were collected. Structured data is not mandatory for every page.",
        6,
      ),
    ];
  });
}
