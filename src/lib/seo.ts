export const SEO_CRITERIA = [
  { key: "metadata", label: "Titles & descriptions", weight: 30 },
  { key: "discovery", label: "Canonical & indexing signals", weight: 30 },
  { key: "content", label: "Content & page structure", weight: 25 },
  { key: "structured", label: "Structured data", weight: 15 },
] as const;
export type SEOCriterion = (typeof SEO_CRITERIA)[number]["key"];
export interface SEOSource {
  id: string;
  pageUrl: string;
  kind:
    | "metadata"
    | "canonical"
    | "directives"
    | "headings"
    | "links"
    | "structured"
    | "content";
  label: string;
  observation: string;
}
export interface SEOPage {
  url: string;
  titles: string[];
  descriptions: string[];
  canonicals: {
    href: string;
    resolved: string | null;
    method: "HTML" | "HTTP header";
  }[];
  directives: {
    agent: string;
    value: string;
    method: "HTML" | "HTTP header";
  }[];
  headersChecked: boolean;
  responseStatus: number | null;
  headings: { level: number; text: string }[];
  internalLinks: { text: string; url: string }[];
  structured: {
    jsonLdBlocks: number;
    invalidJsonLd: number;
    jsonLdTypes: string[];
    microdataTypes: string[];
    rdfaTypes: string[];
  };
  content: string[];
  language: string;
  truncated: boolean;
}
export interface SEOCheck {
  id: string;
  key: SEOCriterion;
  label: string;
  pageUrl: string;
  status: "observed" | "review" | "not-observed" | "not-assessed";
  detail: string;
  sourceIds: string[];
}
export interface SEOAnalysis {
  method: "page-seo-review-v1";
  summary: string;
  summarySources: SEOSource[];
  criteria: {
    key: SEOCriterion;
    score: number | null;
    reason: string;
    sources: SEOSource[];
  }[];
  strengths: { text: string; sources: SEOSource[] }[];
  checks: SEOCheck[];
  evidence?: SEOSource[];
  pages: SEOPage[];
  scope: {
    pages: number;
    sources: number;
    headersChecked: number;
    truncated: boolean;
  };
  verification: { checked: number; retained: number; withheld: number };
  assessmentValidation?: {
    reassessed: boolean;
    summaryWithheld: boolean;
    withheldCriteria: SEOCriterion[];
  };
  unassessed: string[];
}

export function seoAssessmentCandidates(analysis?: SEOAnalysis) {
  if (
    analysis?.method !== "page-seo-review-v1" ||
    !Array.isArray(analysis.criteria)
  )
    return [];
  return analysis.criteria.filter(
    (item) =>
      item &&
      typeof item.reason === "string" &&
      Array.isArray(item.sources) &&
      item.sources.every((source) => typeof source?.pageUrl === "string") &&
      !analysis.assessmentValidation?.withheldCriteria?.includes(item.key),
  );
}

export const SEO_UNTESTED = [
  "Actual search rankings and indexing",
  "Search-result appearance and rich-result eligibility",
  "Rendered content, robots.txt, sitemaps and full-domain crawling",
  "Search impressions, clicks and click-through rates",
] as const;
export function seoScore(criteria: SEOAnalysis["criteria"]) {
  let total = 0,
    weight = 0;
  for (const rubric of SEO_CRITERIA) {
    const item = criteria.find((item) => item.key === rubric.key);
    if (item?.score == null) continue;
    total += item.score * rubric.weight;
    weight += rubric.weight;
  }
  return weight ? Math.round(total / weight) : null;
}
export const SEO_GUIDANCE = [
  {
    label: "Title links",
    url: "https://developers.google.com/search/docs/appearance/title-link",
  },
  {
    label: "Search snippets",
    url: "https://developers.google.com/search/docs/appearance/snippet",
  },
  {
    label: "Canonical URLs",
    url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
  },
  {
    label: "Indexing directives",
    url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
  },
  {
    label: "Structured data",
    url: "https://developers.google.com/search/docs/appearance/structured-data/sd-policies",
  },
];
