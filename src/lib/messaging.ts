export const MESSAGING_CRITERIA = [
  { key: "clarity", label: "Purpose & message clarity", weight: 35 },
  { key: "audience", label: "Audience & next-step clarity", weight: 25 },
  { key: "specificity", label: "Specific, supportable language", weight: 25 },
  { key: "consistency", label: "Consistency & readability", weight: 15 },
] as const;
export type MessagingCriterion = (typeof MESSAGING_CRITERIA)[number]["key"];
export interface CopySource {
  id: string;
  pageUrl: string;
  quote: string;
  kind: string;
  region: string;
  destination?: string;
  renderingNote?: string;
}
export interface CopySuggestion {
  original: string;
  replacement: string;
  sources: CopySource[];
}
export interface MessagingAnalysis {
  method: "copy-evidence-review-v1";
  summary: string;
  summarySources: CopySource[];
  strengths: { text: string; source: CopySource }[];
  criteria: {
    key: MessagingCriterion;
    score: number;
    reason: string;
    sources: CopySource[];
  }[];
  scope: { pages: number; blocks: number; truncated: boolean };
  verification: { checked: number; retained: number; withheld: number };
}
export function messagingScore(criteria: MessagingAnalysis["criteria"]) {
  let total = 0,
    weight = 0;
  for (const rubric of MESSAGING_CRITERIA) {
    const item = criteria.find((item) => item.key === rubric.key);
    if (!item) continue;
    total += item.score * rubric.weight;
    weight += rubric.weight;
  }
  return weight ? Math.round(total / weight) : null;
}
