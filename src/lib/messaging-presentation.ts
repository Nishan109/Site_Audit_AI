import type { Issue, FixStep } from "./types";
import {
  reviewIssueKey,
  reviewIssues,
  reviewedCriteria,
} from "./review-workspace";
import {
  MESSAGING_CRITERIA,
  messagingScore,
  type MessagingAnalysis,
  type CopySource,
} from "./messaging";

export function copySources(issue: Issue): CopySource[] {
  const sources = issue.messagingEvidence || [
    ...(issue.evidence && issue.pageUrl
      ? [
          {
            id: "original",
            quote: issue.evidence,
            pageUrl: issue.pageUrl,
            kind: "collected copy",
            region: "page",
          },
        ]
      : []),
    ...(issue.supportingEvidence || []),
  ];
  const unique = new Map<string, CopySource>();
  for (const source of sources)
    unique.set(`${source.pageUrl}|${source.quote}`, source);
  return [...unique.values()];
}
export function messagingIssueKey(issue: Issue, index: number) {
  void index; // Compatibility with existing callers; identity no longer depends on position.
  return reviewIssueKey(issue);
}
export function prioritizedCopyIssues(issues: Issue[]) {
  return reviewIssues(issues).map((item, rank) => ({ ...item, rank }));
}
export function messagingPlan(
  analysis: MessagingAnalysis | undefined,
  issues: Issue[],
  url: string,
  drafts: Record<string, string> = {},
  steps: Record<string, FixStep[]> = {},
  collectedPages?: string[],
) {
  const eligible = reviewedCriteria(
    analysis?.method === "copy-evidence-review-v1" ? analysis.criteria : [],
    collectedPages,
    messagingScore,
  );
  return [
    "MESSAGING & COPY · ACTION PLAN",
    `Website: ${url}`,
    analysis?.summary || "Copy findings from the collected page content.",
    ...(analysis
      ? [
          `Qualitative copy score: ${messagingScore(eligible) ?? "Not assessed"}`,
          ...analysis.criteria.map(
            (item) =>
              `${MESSAGING_CRITERIA.find((rubric) => rubric.key === item.key)?.label || "Unassessed area"}: ${eligible.some((candidate) => candidate.key === item.key) ? `${item.score}/100` : "Not assessed"} — ${eligible.some((candidate) => candidate.key === item.key) ? item.reason : "No verified assessment was available for this area."}`,
          ),
        ]
      : []),
    "",
    ...prioritizedCopyIssues(issues).flatMap(({ issue, key }, index) => {
      const replacement = drafts[key] ?? issue.copySuggestion?.replacement;
      const edited =
        issue.copySuggestion &&
        replacement !== issue.copySuggestion.replacement;
      return [
        `${index + 1}. ${issue.title} · ${issue.priority} priority`,
        issue.detail,
        ...(issue.copySuggestion
          ? [
              `Current copy: ${issue.copySuggestion.original}`,
              edited
                ? "Your edited draft · not reviewed by AI:"
                : "AI wording option · review before publishing:",
              replacement || "(Draft is empty)",
            ]
          : []),
        ...copySources(issue).flatMap((source) => [
          `Source: ${source.pageUrl} · ${source.kind} · ${source.region}`,
          `“${source.quote}”`,
        ]),
        ...(issue.copySuggestion?.sources || []).map(
          (source) => `Wording support: “${source.quote}” · ${source.pageUrl}`,
        ),
        ...(steps[key] ?? steps[issue.title] ?? issue.fixSteps ?? []).map(
          (step, index) => `${index + 1}) ${step.title}: ${step.description}`,
        ),
        "",
      ];
    }),
    ...(!issues.length
      ? ["No supported copy fixes were identified in this sample."]
      : []),
    "Review wording in its page context and verify all business claims before publishing. Draft edits do not update the original audit scores. Scores are qualitative AI assessments, not measured visitor behavior or conversion outcomes.",
    analysis?.scope.truncated
      ? "Some collected copy was sampled or shortened. Missing information cannot be established from this sample."
      : "Only the listed collected pages were reviewed.",
  ].join("\n");
}
