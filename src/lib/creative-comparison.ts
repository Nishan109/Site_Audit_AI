import type { z } from "zod";
import type { comparisonSchema } from "./server/schemas";
import type { CreativeAsset } from "./ad-studio";

export type ComparisonResult = z.infer<typeof comparisonSchema>;
export function isComparisonResult(value: unknown): value is ComparisonResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const strings = (value: unknown, minimum = 0) =>
    Array.isArray(value) &&
    value.length >= minimum &&
    value.every((item) => typeof item === "string" && item.trim().length > 0);
  const assessment = (value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return (
      typeof item.score === "number" &&
      Number.isInteger(item.score) &&
      item.score >= 0 &&
      item.score <= 100 &&
      strings(item.strengths, 1) &&
      strings(item.weaknesses) &&
      (item.criteria === undefined ||
        (item.criteria &&
          typeof item.criteria === "object" &&
          REVIEW_CRITERIA.every(({ key }) => {
            const criterion = (item.criteria as Record<string, unknown>)[key];
            if (!criterion || typeof criterion !== "object") return false;
            const entry = criterion as Record<string, unknown>;
            return (
              typeof entry.score === "number" &&
              Number.isInteger(entry.score) &&
              entry.score >= 0 &&
              entry.score <= 100 &&
              typeof entry.evidence === "string" &&
              entry.evidence.trim().length >= 12
            );
          })))
    );
  };
  if (!(
    ["Creative A", "Creative B", "Tie"].includes(String(result.winner)) &&
    typeof result.rationale === "string" &&
    result.rationale.trim().length >= 20 &&
    assessment(result.creativeA) &&
    assessment(result.creativeB) &&
    strings(result.recommendations, 1) &&
    (result.reviewMethod === undefined ||
      result.reviewMethod === "independent-rubric-v1") &&
    (result.identicalInputs === undefined ||
      typeof result.identicalInputs === "boolean")
  ))
    return false;
  const a = result.creativeA as ComparisonResult["creativeA"];
  const b = result.creativeB as ComparisonResult["creativeB"];
  if (result.winner === "Creative A" && a.score <= b.score) return false;
  if (result.winner === "Creative B" && b.score <= a.score) return false;
  if (result.reviewMethod === "independent-rubric-v1") {
    if (!a.criteria || !b.criteria) return false;
    const tied = Math.abs(a.score - b.score) <= COMPARISON_TIE_THRESHOLD;
    if (tied !== (result.winner === "Tie")) return false;
    if (
      result.identicalInputs &&
      (result.winner !== "Tie" || a.score !== b.score)
    )
      return false;
  }
  return true;
}
export type CreativeVariant = "A" | "B";
export interface ComparisonCreative {
  asset?: CreativeAsset;
  headline: string;
  copy: string;
  fit: "contain" | "cover";
  position: string;
}
export const REVIEW_FOCUSES = [
  "Overall clarity",
  "Message & audience",
  "Visual hierarchy",
  "Call to action",
] as const;
export type ReviewFocus = (typeof REVIEW_FOCUSES)[number];
export const COMPARISON_TIE_THRESHOLD = 3;
export const REVIEW_CRITERIA = [
  { key: "message", label: "Message & audience" },
  { key: "hierarchy", label: "Visual hierarchy" },
  { key: "legibility", label: "Readability & contrast" },
  { key: "action", label: "Call to action" },
] as const;
export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number]["key"];
// Product rubric weights, not experimentally calibrated performance metrics.
export const REVIEW_WEIGHTS: Record<
  ReviewFocus,
  Record<ReviewCriterion, number>
> = {
  "Overall clarity": { message: 35, hierarchy: 25, legibility: 25, action: 15 },
  "Message & audience": {
    message: 55,
    hierarchy: 15,
    legibility: 15,
    action: 15,
  },
  "Visual hierarchy": {
    message: 20,
    hierarchy: 45,
    legibility: 25,
    action: 10,
  },
  "Call to action": { message: 20, hierarchy: 15, legibility: 20, action: 45 },
};
export interface CreativeReview {
  result: ComparisonResult;
  revision: number;
  reviewedAt: string;
  model: string;
  focus: string;
  audience: string;
  names: Record<CreativeVariant, string>;
}
export function comparisonCopy(creative: ComparisonCreative) {
  return [
    creative.headline.trim() ? `Headline: ${creative.headline.trim()}` : "",
    creative.copy.trim() ? `Primary text: ${creative.copy.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
export function comparisonReady(
  creatives: Record<CreativeVariant, ComparisonCreative>,
  loading: boolean,
  uploading: boolean,
) {
  return !!creatives.A.asset && !!creatives.B.asset && !loading && !uploading;
}
export function reviewText(review: CreativeReview, url: string) {
  const { result } = review;
  return [
    "SITEAUDIT AI · CREATIVE REVIEW",
    `Website context: ${url}`,
    `Reviewed: ${review.reviewedAt}`,
    `Focus: ${review.focus}`,
    review.audience ? `Audience: ${review.audience}` : "",
    `Images: A — ${review.names.A}; B — ${review.names.B}`,
    "",
    "AI preference: " + result.winner,
    result.rationale,
    ...(result.reviewMethod === "independent-rubric-v1"
      ? [
          `Method: each creative assessed separately against the same rubric. Scores within ${COMPARISON_TIE_THRESHOLD} points have no clear preference.`,
          ...(result.identicalInputs
            ? [
                "Identical image and supplied copy: one assessment applied equally to both.",
              ]
            : []),
        ]
      : []),
    "",
    ...(["A", "B"] as const).flatMap((variant) => {
      const assessment = variant === "A" ? result.creativeA : result.creativeB;
      return [
        `CREATIVE ${variant} · AI assessment ${assessment.score}/100`,
        "Strengths",
        ...assessment.strengths.map((text) => `- ${text}`),
        "What to improve",
        ...assessment.weaknesses.map((text) => `- ${text}`),
        ...(assessment.criteria
          ? REVIEW_CRITERIA.map(
              ({ key, label }) =>
                `${label}: ${assessment.criteria![key].score}/100 — ${assessment.criteria![key].evidence}`,
            )
          : []),
        "",
      ];
    }),
    "NEXT VERSION",
    ...result.recommendations.map((text, index) => `${index + 1}. ${text}`),
    "",
    "This is a qualitative AI review of uploaded originals and supplied copy. It is not an A/B experiment; advertising performance has not been measured.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
