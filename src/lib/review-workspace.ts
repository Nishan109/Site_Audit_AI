import type { FixStep, Issue } from "./types";
import { findingIdentity, PRIORITY_ORDER } from "./dashboard";

/** Stable across filtering, sorting and section navigation; never a visible-row index. */
export const reviewIssueKey = (issue: Issue) =>
  `${findingIdentity(issue)}|${issue.messagingCriterion || issue.seoCriterion || issue.conversionCriterion || issue.uxCriterion || issue.aiCriterion || ""}|${issue.detail.trim()}`;

export function reviewIssues(issues: Issue[]) {
  const occurrences = new Map<string, number>();
  return issues
    .map((issue, index) => {
      const identity = reviewIssueKey(issue);
      const occurrence = occurrences.get(identity) || 0;
      occurrences.set(identity, occurrence + 1);
      return {
        issue,
        index,
        key: occurrence ? `${identity}|duplicate-${occurrence}` : identity,
      };
    })
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.issue.priority] - PRIORITY_ORDER[b.issue.priority],
    );
}

/** Title-keyed entries remain readable for earlier reports and specialist consumers. */
export const issueSteps = (
  issue: Issue,
  generated: Record<string, FixStep[]> = {},
) =>
  generated[reviewIssueKey(issue)] ??
  generated[issue.title] ??
  issue.fixSteps ??
  [];

export { reviewedCriteria, type ReviewCriterion } from "./reviewed-criteria";
