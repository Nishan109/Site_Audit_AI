import type { UXSource } from "./ux";

export const CONVERSION_CRITERIA = [
  { key: "actions", label: "Action clarity", weight: 35 },
  { key: "decision", label: "Decision support", weight: 25 },
  { key: "forms", label: "Form clarity", weight: 20 },
  { key: "expectations", label: "Next-step expectations", weight: 20 },
] as const;
export type ConversionCriterion = (typeof CONVERSION_CRITERIA)[number]["key"];
export interface ConversionSource extends Omit<UXSource, "kind"> {
  kind: "page" | "link" | "button" | "form" | "field" | "copy";
}
export interface ConversionAnalysis {
  method: "conversion-evidence-review-v1";
  summary: string;
  summarySources: ConversionSource[];
  goal: { text: string; sources: ConversionSource[] } | null;
  actions: ConversionSource[];
  forms: ConversionSource[];
  evidence: ConversionSource[];
  criteria: {
    key: ConversionCriterion;
    score: number | null;
    reason: string;
    sources: ConversionSource[];
  }[];
  strengths: { text: string; sources: ConversionSource[] }[];
  scope: {
    pages: number;
    sources: number;
    controls: number;
    forms: number;
    truncated: boolean;
  };
  verification: { checked: number; retained: number; withheld: number };
  unassessed: string[];
}

export function conversionAssessmentCandidates(analysis?: ConversionAnalysis) {
  if (
    analysis?.method !== "conversion-evidence-review-v1" ||
    !Array.isArray(analysis.criteria)
  )
    return [];
  return analysis.criteria.filter(
    (item) =>
      item &&
      CONVERSION_CRITERIA.some(({ key }) => key === item.key) &&
      typeof item.reason === "string" &&
      Array.isArray(item.sources) &&
      item.sources.every((source) => typeof source?.pageUrl === "string"),
  );
}

export function conversionScore(criteria: ConversionAnalysis["criteria"]) {
  let total = 0,
    weight = 0;
  for (const rubric of CONVERSION_CRITERIA) {
    const item = criteria.find((item) => item.key === rubric.key);
    if (item?.score == null) continue;
    total += item.score * rubric.weight;
    weight += rubric.weight;
  }
  return weight ? Math.round(total / weight) : null;
}
export const CONVERSION_GUIDANCE = [
  {
    label: "Measure meaningful actions · Google Analytics",
    url: "https://support.google.com/analytics/answer/9267568?hl=en",
  },
  {
    label: "Clear form instructions · W3C WAI",
    url: "https://www.w3.org/WAI/tutorials/forms/instructions/",
  },
  {
    label: "Labeling form controls · W3C WAI",
    url: "https://www.w3.org/WAI/tutorials/forms/labels/",
  },
];
