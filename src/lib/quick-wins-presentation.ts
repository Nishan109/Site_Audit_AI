import { issueSteps } from "./review-workspace";
import type { FixStep, QuickWin } from "./types";
import { QUICK_WIN_AREAS } from "./quick-wins";
import { describeUXSource } from "./ux-presentation";
import { seoObservationRows } from "./seo-presentation";
import { conversionObservationRows } from "./conversion-presentation";

export const quickWinKey = (win: QuickWin) =>
  win.id || `${win.category || "saved"}|${win.pageUrl || ""}|${win.action}`;
export function orderedQuickWins(
  wins: QuickWin[],
  sort: "effort" | "priority" = "effort",
) {
  const effort = { Low: 0, Medium: 1, High: 2 },
    priority = { High: 0, Medium: 1, Low: 2 };
  return wins
    .map((win, index) => ({ win, index }))
    .sort((a, b) => {
      const e = effort[a.win.effort] - effort[b.win.effort],
        p =
          priority[a.win.relatedIssue?.priority || "Low"] -
          priority[b.win.relatedIssue?.priority || "Low"];
      return (sort === "effort" ? e || p : p || e) || a.index - b.index;
    })
    .map((item, rank) => ({ ...item, rank, key: quickWinKey(item.win) }));
}
export function quickWinEvidenceLines(win: QuickWin) {
  const lines = [
    ...(win.messagingEvidence || []).flatMap((source) => [
      `${source.pageUrl} · ${source.kind} · ${source.region}`,
      `Collected wording: ${source.quote}`,
      ...(source.renderingNote ? [source.renderingNote] : []),
    ]),
    ...(win.uxEvidence || []).flatMap((source) => [
      `${source.pageUrl} · ${source.location}`,
      ...describeUXSource(source).map((row) => `${row.label}: ${row.value}`),
    ]),
    ...(win.seoEvidence || []).flatMap((source) => [
      `${source.pageUrl} · ${source.label}`,
      ...seoObservationRows(source).map((row) => `${row.label}: ${row.value}`),
    ]),
    ...(win.conversionEvidence || []).flatMap((source) => [
      `${source.pageUrl} · ${source.location}`,
      ...conversionObservationRows(source).map(
        (row) => `${row.label}: ${row.value}`,
      ),
    ]),
  ];
  return lines.length
    ? lines
    : [
        `Saved evidence: ${win.evidence || "Not available in this report"}`,
        `Source page: ${win.pageUrl || "Not recorded"}`,
      ];
}
export function quickWinsPlan(
  wins: QuickWin[],
  url: string,
  done: ReadonlySet<string> = new Set(),
  sort: "effort" | "priority" = "effort",
  generated: Record<string, FixStep[]> = {},
) {
  return [
    "QUICK WINS · IMPLEMENTATION SHORTLIST",
    `Website: ${url}`,
    `${wins.length} suggestion(s); ${wins.filter((win) => done.has(quickWinKey(win))).length} marked done by you.`,
    "Effort is a qualitative estimate, not a measured duration. Benefits are hypotheses, not measured uplift. Manual completion does not change audit scores or confirm a successful fix.",
    "",
    ...orderedQuickWins(wins, sort).flatMap(({ win, key }, index) => [
      `${index + 1}. ${win.action}`,
      `Area: ${QUICK_WIN_AREAS.find((area) => area.key === win.category)?.label || "Saved suggestion"} · Estimated effort: ${win.effort}`,
      `Status: ${done.has(key) ? "Marked done by you (not re-tested)" : "To do"}`,
      `Expected benefit (hypothesis): ${win.impact}`,
      ...(win.relatedIssue
        ? [
            `Underlying finding: ${win.relatedIssue.title} · ${win.relatedIssue.priority} priority`,
            `Finding page: ${win.relatedIssue.pageUrl}`,
            `Observed condition: ${win.relatedIssue.detail}`,
          ]
        : [
            "A linked finding is not available in this saved report; run a fresh audit to verify the suggestion.",
          ]),
      ...(win.relatedIssue ? issueSteps(win.relatedIssue, generated) : []).map(
        (step, index) => `${index + 1}) ${step.title}: ${step.description}`,
      ),
      "Supporting evidence:",
      ...quickWinEvidenceLines(win),
      "",
    ]),
    ...(!wins.length
      ? [
          "No smaller-effort suggestions were supported for this shortlist. Review the full findings and testing limits.",
          "",
        ]
      : []),
    "BEFORE MARKING A TASK DONE",
    "Confirm the change fits the existing page and codebase. Test the affected behavior, then measure actual outcomes where appropriate.",
    "Only the collected pages were reviewed. Rendered layouts, live interactions and commercial/search performance were not verified by this shortlist.",
  ].join("\n");
}
