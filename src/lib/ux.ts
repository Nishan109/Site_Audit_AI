export const UX_CRITERIA = [
  { key: "navigation", label: "Navigation & findability", weight: 30 },
  { key: "structure", label: "Information structure", weight: 25 },
  { key: "controls", label: "Controls & next steps", weight: 25 },
  { key: "forms", label: "Form clarity", weight: 20 },
] as const;
export type UXCriterion = (typeof UX_CRITERIA)[number]["key"];
export interface UXSource {
  id: string;
  pageUrl: string;
  kind:
    "page" | "navigation" | "heading" | "link" | "button" | "form" | "field";
  location: string;
  observation: string;
}
export interface UXCounts {
  navigation: number;
  headings: number;
  links: number;
  buttons: number;
  forms: number;
  fields: number;
}
export interface UXAnalysis {
  method: "html-ux-review-v1";
  summary: string;
  summarySources: UXSource[];
  criteria: {
    key: UXCriterion;
    score: number | null;
    reason: string;
    sources: UXSource[];
  }[];
  strengths: { text: string; sources: UXSource[] }[];
  scope: UXCounts & { pages: number; sources: number; truncated: boolean };
  verification: { checked: number; retained: number; withheld: number };
  unassessed: string[];
}
export function uxScore(criteria: UXAnalysis["criteria"]) {
  let total = 0,
    weight = 0;
  for (const rubric of UX_CRITERIA) {
    const item = criteria.find((item) => item.key === rubric.key);
    if (item?.score === null || item?.score === undefined) continue;
    total += item.score * rubric.weight;
    weight += rubric.weight;
  }
  return weight ? Math.round(total / weight) : null;
}
