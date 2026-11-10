import { reviewedCriteria } from "./reviewed-criteria";

export const AI_VISIBILITY_CRITERIA = [
  {
    key: "answers",
    label: "Clear, useful answers",
    short: "Answers",
    weight: 35,
  },
  {
    key: "identity",
    label: "Identity & topic context",
    short: "Identity",
    weight: 25,
  },
  {
    key: "support",
    label: "Attribution & supporting detail",
    short: "Supporting detail",
    weight: 25,
  },
  {
    key: "structure",
    label: "Readable content structure",
    short: "Structure",
    weight: 15,
  },
] as const;
export type AIVisibilityCriterion =
  (typeof AI_VISIBILITY_CRITERIA)[number]["key"];
export interface AIVisibilitySource {
  id: string;
  pageUrl: string;
  kind: "copy" | "metadata" | "headings" | "structured";
  label: string;
  text: string;
  region?: string;
  heading?: string;
  truncated?: boolean;
}
export interface AIVisibilityPage {
  url: string;
  title: string;
  excerptIds: string[];
  headings: { level: number; text: string }[];
  markup: {
    collected: boolean;
    jsonLdBlocks: number;
    invalidJsonLd: number;
    jsonLdTypes: string[];
    microdataTypes: string[];
    rdfaTypes: string[];
  };
  sampled: boolean;
}
export interface AIVisibilityReview {
  method: "cited-content-readiness-v1";
  summary: string;
  summarySources: AIVisibilitySource[];
  criteria: {
    key: AIVisibilityCriterion;
    score: number | null;
    reason: string;
    sources: AIVisibilitySource[];
  }[];
  strengths: { text: string; sources: AIVisibilitySource[] }[];
  evidence: AIVisibilitySource[];
  pages: AIVisibilityPage[];
  verification: { checked: number; retained: number; withheld: number };
  assessmentValidation: {
    summaryWithheld: boolean;
    withheldCriteria: AIVisibilityCriterion[];
  };
  scope: { pages: number; sources: number; sampled: boolean };
  unassessed: string[];
}
export function aiVisibilityScore(criteria: AIVisibilityReview["criteria"]) {
  let total = 0,
    weight = 0;
  for (const rubric of AI_VISIBILITY_CRITERIA) {
    const item = criteria.find((item) => item.key === rubric.key);
    if (item?.score == null) continue;
    total += item.score * rubric.weight;
    weight += rubric.weight;
  }
  return weight ? Math.round(total / weight) : null;
}

export function isAIVisibilitySource(
  source: unknown,
): source is AIVisibilitySource {
  if (!source || typeof source !== "object") return false;
  const item = source as Partial<AIVisibilitySource>;
  return (
    typeof item.id === "string" &&
    !!item.id.trim() &&
    typeof item.pageUrl === "string" &&
    typeof item.label === "string" &&
    typeof item.text === "string" &&
    !!item.text.trim() &&
    (item.kind === "copy" ||
      item.kind === "metadata" ||
      item.kind === "headings" ||
      item.kind === "structured")
  );
}

export function aiVisibilityAssessment(
  review?: AIVisibilityReview,
  collectedPages: string[] = [],
) {
  const current = review?.method === "cited-content-readiness-v1";
  const validation = current ? review.assessmentValidation : undefined;
  const withheld = new Set(
    Array.isArray(validation?.withheldCriteria)
      ? validation.withheldCriteria
      : [],
  );
  const candidates =
    current && Array.isArray(review.criteria)
      ? review.criteria.filter(
          (item) =>
            item &&
            typeof item.reason === "string" &&
            Array.isArray(item.sources) &&
            item.sources.every(isAIVisibilitySource),
        )
      : [];
  const eligible = reviewedCriteria(
    candidates.filter(
      ({ key, sources }) =>
        !withheld.has(key) &&
        sources.some(
          ({ kind }) =>
            kind === "copy" || (key === "structure" && kind === "headings"),
        ),
    ),
    collectedPages,
    aiVisibilityScore,
  );
  const criteria = AI_VISIBILITY_CRITERIA.map((rubric) => {
    const item = eligible.find(({ key }) => key === rubric.key);
    const unassessed = candidates.find(
      ({ key, score }) => key === rubric.key && score === null,
    );
    return {
      ...rubric,
      score: item?.score ?? null,
      reason: withheld.has(rubric.key)
        ? "This explanation could not be verified against the collected content."
        : item?.reason ||
          unassessed?.reason ||
          "No source-backed assessment was available for this area.",
      sources: item?.sources ?? [],
    };
  });
  return {
    current,
    criteria,
    score: aiVisibilityScore(eligible),
    assessed: eligible.length,
    summaryWithheld: validation?.summaryWithheld === true,
    partial: validation?.summaryWithheld === true || withheld.size > 0,
  };
}

export const AI_VISIBILITY_UNASSESSED = [
  "Appearances, citations and rankings in live AI answers",
  "AI crawler access, robots.txt rules and server bot logs",
  "Search indexing, referral traffic and conversions",
  "Independent verification of the website's claims and credentials",
];
export const AI_VISIBILITY_GUIDANCE = [
  {
    label: "Google: AI features and your website",
    url: "https://developers.google.com/search/docs/appearance/ai-features",
  },
  {
    label: "OpenAI: search and training crawlers",
    url: "https://developers.openai.com/api/docs/bots",
  },
];
