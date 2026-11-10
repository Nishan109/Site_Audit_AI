import { reviewedCriteria, reviewIssues } from "./review-workspace";
import type { Issue } from "./types";
import {
  UX_CRITERIA,
  uxScore,
  type UXAnalysis,
  type UXCriterion,
  type UXSource,
} from "./ux";

export function observationData(
  source: UXSource,
): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(source.observation);
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
export function describeUXSource(
  source: UXSource,
): { label: string; value: string }[] {
  const data = observationData(source);
  if (!data)
    return [{ label: "Collected observation", value: source.observation }];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) rows.push({ label, value });
    else if (typeof value === "number")
      rows.push({ label, value: String(value) });
  };
  if (["link", "button", "field"].includes(source.kind)) {
    add("Label", data.name || "No name detected in the collected HTML");
    if (data.name) add("Label source", data.nameFrom);
  }
  if (source.kind === "link") {
    add("Destination", data.destination || data.href);
    rows.push({ label: "Live destination", value: "Not opened or tested" });
    if (data.targetInInitialHTML === false)
      rows.push({
        label: "On-page target",
        value:
          "Not present in initial HTML; JavaScript behavior was not tested",
      });
    if (data.targetInInitialHTML === true)
      rows.push({
        label: "On-page target",
        value: "Present in the collected HTML",
      });
  }
  if (source.kind === "heading") {
    add("Heading", data.text);
    add("Heading level", data.level);
  }
  if (source.kind === "navigation") {
    add("Navigation name", data.name || "No explicit navigation name");
    add("Links in this group", data.linkCount);
    if (Array.isArray(data.labels))
      add(
        "Link labels",
        data.labels.filter((label) => typeof label === "string").join(" · "),
      );
  }
  if (source.kind === "field") {
    add("Field type", data.type);
    add("Field identifier", data.id || data.fieldName);
    if (typeof data.required === "boolean")
      add(
        "Declared requirement",
        data.required ? "Required" : "Not marked required",
      );
    if (data.disabled) add("Field state", "Disabled in collected HTML");
    if (data.readOnly) add("Field state", "Read only");
    add("Associated form", data.form);
    add("Group", data.group);
    if (Array.isArray(data.help)) add("Associated help", data.help.join(" "));
  }
  if (source.kind === "button") {
    add("Control type", data.type);
    if (data.disabled) add("Control state", "Disabled in collected HTML");
    add("Declared destination", data.destination);
  }
  if (source.kind === "form") {
    add("Form name", data.name || "No explicit form name");
    add("Editable questions", data.editableQuestions);
    add("Required questions", data.requiredQuestions);
    add("Declared destination", data.action);
    if (Array.isArray(data.fieldLabels))
      add(
        "Field labels",
        data.fieldLabels
          .map(
            (field) =>
              (field &&
                typeof field === "object" &&
                "name" in field &&
                field.name) ||
              "No name detected",
          )
          .join(" · "),
      );
  }
  if (source.kind === "page") {
    add("Page", data.pageTitle);
    if (data.counts && typeof data.counts === "object") {
      const counts = data.counts as Record<string, unknown>;
      for (const [key, label] of [
        ["navigation", "Navigation groups"],
        ["headings", "Headings"],
        ["links", "Links"],
        ["forms", "Forms"],
        ["fields", "Fields"],
      ])
        add(label, counts[key]);
    }
    add(
      "Collection method",
      "Initial page HTML; no browser interactions executed",
    );
  }
  return rows.length
    ? rows
    : [{ label: "Collected observation", value: source.observation }];
}
export function uxIssueArea(issue: Issue): UXCriterion | "other" {
  if (issue.uxCriterion) return issue.uxCriterion;
  // Older reports did not preserve the specialist's criterion. Use only the
  // observed element types for grouping; this does not change their findings.
  const kinds = issue.uxEvidence?.map((source) => source.kind) || [];
  if (kinds.includes("field") || kinds.includes("form")) return "forms";
  if (kinds.includes("navigation")) return "navigation";
  if (kinds.includes("button") || kinds.includes("link")) return "controls";
  if (kinds.includes("heading")) return "structure";
  return "other";
}
export function prioritizeUXIssues(issues: Issue[]) {
  const rank = { High: 0, Medium: 1, Low: 2 };
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort(
      (a, b) =>
        rank[a.issue.priority] - rank[b.issue.priority] || a.index - b.index,
    )
    .map((item, rank) => ({ ...item, rank }));
}
/** Keep the specialist, overview and exported plan on the same score eligibility. */
export function uxAssessment(analysis?: UXAnalysis, collectedPages?: string[]) {
  const current = analysis?.method === "html-ux-review-v1";
  const criteria = reviewedCriteria(
    current ? analysis.criteria : [],
    collectedPages,
    uxScore,
  );
  return { current, criteria, score: uxScore(criteria) };
}

export const UX_BROWSER_SCOPE = [
  "Rendered desktop/mobile layout, spacing and visual readability",
  "Keyboard behavior, focus order and interactive controls",
  "Live destinations, form validation and task completion",
];

function uxSourceLines(source: UXSource) {
  return [
    `Source: ${source.pageUrl} · ${source.kind} · ${source.location} · ${source.id}`,
    ...describeUXSource(source).map((row) => `${row.label}: ${row.value}`),
  ];
}

export function uxActionPlan(
  analysis: UXAnalysis | undefined,
  issues: Issue[],
  url: string,
  steps: Record<string, NonNullable<Issue["fixSteps"]>> = {},
  collectedPages?: string[],
) {
  const assessment = uxAssessment(analysis, collectedPages);
  return [
    "USER EXPERIENCE · ACTION PLAN",
    `Website: ${url}`,
    analysis?.summary || "Findings from the collected website evidence.",
    `HTML-based UX score: ${assessment.score ?? "Not assessed"}`,
    `${assessment.criteria.length} of 4 criteria assessed; qualitative, weighted assessment.`,
    ...UX_CRITERIA.map((rubric) => {
      const eligible = assessment.criteria.find(
        (item) => item.key === rubric.key,
      );
      const recorded = assessment.current
        ? analysis?.criteria.find((item) => item.key === rubric.key)
        : undefined;
      return `${rubric.label}: ${eligible ? `${eligible.score}/100` : "Not assessed"}${(eligible || recorded)?.reason ? ` — ${(eligible || recorded)!.reason}` : ""}`;
    }),
    ...(analysis
      ? [
          "ASSESSMENT EVIDENCE",
          "Summary sources:",
          ...analysis.summarySources.flatMap(uxSourceLines),
          ...UX_CRITERIA.flatMap((rubric) => {
            const recorded = analysis.criteria.find(
              (item) => item.key === rubric.key,
            );
            return recorded?.sources.length
              ? [
                  `${rubric.label} · recorded supporting observations (not a separate browser test):`,
                  ...recorded.sources.flatMap(uxSourceLines),
                ]
              : [];
          }),
        ]
      : []),
    "",
    ...reviewIssues(issues).flatMap(({ issue, key }, index) => [
      `${index + 1}. ${issue.title} · ${issue.priority} priority`,
      issue.detail,
      ...(issue.pageUrl ? [`Finding source: ${issue.pageUrl}`] : []),
      ...(!issue.uxEvidence?.length && issue.evidence
        ? [`Saved observation: ${issue.evidence}`]
        : []),
      ...(issue.uxEvidence || []).flatMap(uxSourceLines),
      ...(steps[key] ?? steps[issue.title] ?? issue.fixSteps ?? []).map(
        (step, index) => `${index + 1}) ${step.title}: ${step.description}`,
      ),
      "",
    ]),
    ...(!issues.length
      ? [
          "No supported usability improvements were identified in this HTML sample.",
        ]
      : []),
    "BROWSER TESTING STILL NEEDED",
    "Browser interactions were not tested. The following are manual follow-up topics, not test results.",
    ...(analysis?.unassessed.length
      ? analysis.unassessed
      : UX_BROWSER_SCOPE
    ).map((item) => `- ${item}`),
    ...(analysis
      ? [
          "COLLECTION AND EVIDENCE SCOPE",
          `${collectedPages?.length ?? analysis.scope.pages} collected page(s); ${analysis.scope.sources} source observations.`,
          `${analysis.scope.navigation} navigation groups; ${analysis.scope.headings} headings; ${analysis.scope.links} links; ${analysis.scope.buttons} buttons; ${analysis.scope.forms} forms; ${analysis.scope.fields} fields.`,
          `Draft checks against collected evidence: ${analysis.verification.checked} checked, ${analysis.verification.retained} retained, ${analysis.verification.withheld} withheld. These are not browser tests.`,
          ...(analysis.scope.truncated
            ? ["Some observations were sampled or shortened."]
            : []),
          ...analysis.strengths.flatMap((strength) => [
            `Recorded strength: ${strength.text}`,
            ...strength.sources.flatMap(uxSourceLines),
          ]),
        ]
      : [
          "Earlier saved review; a current source-backed criterion breakdown is unavailable.",
        ]),
    "Qualitative AI assessment of collected HTML. It does not measure the complete user experience or conversion performance.",
  ].join("\n");
}
