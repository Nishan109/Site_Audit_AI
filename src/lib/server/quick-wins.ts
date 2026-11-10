import { createHash } from "node:crypto";
import type { Issue, QuickWin } from "../types";
import type { QuickWinArea, QuickWinsSelection } from "../quick-wins";
import { verifiedQuickWinSchema, quickWinSchema } from "./schemas";
export function usableQuickWinBenefit(impact: string) {
  return (
    quickWinSchema.shape.impact.safeParse(impact.trim()).success &&
    !/^(?:low|medium|high|n\/a|none|unknown|not assessed)\.?$/i.test(
      impact.trim(),
    )
  );
}
export function unprovenFormAssociationClaim(
  text: string,
  sources: { kind: string; observation?: string }[],
) {
  if (
    !/(?:unassociated[^.!?]{0,50}form|no associated form|lack\w* an? associated form|missing (?:a |an? associated )?form|wrap[^.!?]{0,70}(?:proper )?form (?:element|tag))/i.test(
      text,
    )
  )
    return false;
  return sources.some((source) => {
    if (!["field", "button"].includes(source.kind)) return false;
    try {
      return /no associated form/i.test(
        JSON.parse(source.observation || "{}").form || "",
      );
    } catch {
      return false;
    }
  });
}

export interface QuickWinGroup {
  category: QuickWinArea;
  issues: Issue[];
  quickWins: QuickWin[];
}
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function unsupportedQuickWinOutcome(text: string) {
  return /\b(?:guarantee\w* (?:rankings?|conversions?|revenue|results)|(?:will|certain to) (?:increase|boost|improve|raise|reduce|lift)\b[^.!?]{0,60}\b(?:conversions?|sales|revenue|traffic|rankings?|bounce|abandonment)|(?:increase|boost|lift|improve|reduce|drop)\w*[^.!?]{0,50}\d+(?:\.\d+)?\s*%)/i.test(
    text,
  );
}
export function assembleQuickWins(groups: QuickWinGroup[]) {
  const selection: QuickWinsSelection = {
    method: "verified-shortlist-v1",
    reviewed: 0,
    retained: 0,
    highEffortExcluded: 0,
    unlinkedExcluded: 0,
    unsupportedExcluded: 0,
    duplicatesExcluded: 0,
    overflowExcluded: 0,
  };
  const candidates: QuickWin[] = [];
  for (const group of groups)
    for (const win of group.quickWins) {
      selection.reviewed++;
      if (win.effort === "High") {
        selection.highEffortExcluded++;
        continue;
      }
      const parent = group.issues.find(
        (issue) =>
          issue.title === win.relatedIssue?.title &&
          issue.pageUrl === win.relatedIssue?.pageUrl &&
          issue.evidence === win.relatedIssue?.evidence,
      );
      if (
        !parent?.fixSteps?.length ||
        !parent.pageUrl ||
        !win.pageUrl ||
        !win.evidence
      ) {
        selection.unlinkedExcluded++;
        continue;
      }
      const sources =
        group.category === "messaging"
          ? win.messagingEvidence
          : group.category === "ux"
            ? win.uxEvidence
            : group.category === "seo"
              ? win.seoEvidence
              : win.conversionEvidence;
      if (
        !sources?.length ||
        !sources.some((source) => source.pageUrl === win.pageUrl) ||
        !usableQuickWinBenefit(win.impact) ||
        unprovenFormAssociationClaim(
          `${win.action}. ${parent.title}. ${parent.detail}`,
          sources,
        ) ||
        unsupportedQuickWinOutcome(`${win.action}. ${win.impact}`)
      ) {
        selection.unsupportedExcluded++;
        continue;
      }
      const id = `qw-${createHash("sha256").update(`${group.category}|${parent.pageUrl}|${parent.title}|${win.action}`).digest("hex").slice(0, 16)}`;
      candidates.push({
        ...win,
        id,
        category: group.category,
        relatedIssue: parent,
      });
    }
  const effort = { Low: 0, Medium: 1, High: 2 },
    priority = { High: 0, Medium: 1, Low: 2 };
  candidates.sort(
    (a, b) =>
      effort[a.effort] - effort[b.effort] ||
      priority[a.relatedIssue!.priority] - priority[b.relatedIssue!.priority],
  );
  const seen = new Set<string>(),
    parents = new Set<string>();
  const deduplicated = candidates.filter((win) => {
    const action = `${win.pageUrl}|${normalize(win.action)}`,
      parent = `${win.category}|${win.relatedIssue!.pageUrl}|${normalize(win.relatedIssue!.title)}`;
    if (seen.has(action) || parents.has(parent)) {
      selection.duplicatesExcluded++;
      return false;
    }
    seen.add(action);
    parents.add(parent);
    return true;
  });
  selection.overflowExcluded = Math.max(0, deduplicated.length - 6);
  const quickWins = deduplicated
    .slice(0, 6)
    .map((win) => verifiedQuickWinSchema.parse(win));
  selection.retained = quickWins.length;
  return { quickWins, selection };
}
