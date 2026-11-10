import { sourceURL } from "./dashboard";
import { reviewedCriteria, reviewIssues } from "./review-workspace";
import type { FixStep, Issue } from "./types";
import { describeUXSource } from "./ux-presentation";
import type { UXSource } from "./ux";
import {
  CONVERSION_CRITERIA,
  conversionAssessmentCandidates,
  conversionScore,
  type ConversionAnalysis,
  type ConversionSource,
} from "./conversion";

export function conversionData(
  source: ConversionSource,
): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(source.observation);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
export function conversionObservationRows(source: ConversionSource) {
  const data = conversionData(source);
  if (source.kind === "form" || source.kind === "field") {
    // Only render the collector's observation fields. Saved records may carry
    // additional properties which should never be printed as raw form data.
    if (!Object.keys(data).length)
      return [
        { label: "Form details", value: "Not recorded in a readable format" },
      ];
    const rows = describeUXSource({ ...source, kind: source.kind }).filter(
      ({ label }) => label !== "Collected observation",
    );
    if (
      source.kind === "form" &&
      typeof data.method === "string" &&
      data.method
    )
      rows.push({ label: "Recorded method", value: data.method });
    return rows;
  }
  if (
    source.kind === "link" &&
    /^\s*(mailto|tel):/i.test(String(data.destination || data.href || ""))
  )
    return describeUXSource({
      ...source,
      kind: "link",
      observation: JSON.stringify({
        ...data,
        destination: conversionDestination(source),
      }),
    });
  if (source.kind !== "copy")
    return describeUXSource({
      ...source,
      kind: source.kind as UXSource["kind"],
    });
  return [
    {
      label: "Collected wording",
      value: String(data.text || source.observation),
    },
    { label: "Page region", value: String(data.region || "Not established") },
    ...(data.renderingNote
      ? [{ label: "Rendering note", value: String(data.renderingNote) }]
      : []),
    {
      label: "Verification",
      value:
        "Published website copy; business claims have not been independently verified",
    },
  ];
}
export function conversionDestination(source: ConversionSource) {
  const data = conversionData(source);
  const value = String(
    data.destination ||
      data.href ||
      data.action ||
      "Destination not established by initial HTML",
  );
  try {
    const target = new URL(value);
    if (target.protocol === "mailto:")
      return `Email ${decodeURIComponent(target.pathname)}${target.search ? " · Pre-filled draft" : ""}`;
    if (target.protocol === "tel:")
      return `Call ${decodeURIComponent(target.pathname)}`;
  } catch {
    /* Relative form actions and unknown behavior stay literal. */
  }
  return value;
}
export function conversionSourceKey(source: ConversionSource) {
  return JSON.stringify([
    sourceURL(source.pageUrl) ?? source.pageUrl,
    source.id,
  ]);
}

export function distinctConversionSources(sources: ConversionSource[]) {
  const observations = new Map<string, ConversionSource>();
  for (const source of sources) {
    const key = conversionSourceKey(source);
    if (!observations.has(key)) observations.set(key, source);
  }
  return [...observations.values()];
}

export function conversionObservations(
  analysis: ConversionAnalysis | undefined,
  issues: Issue[],
) {
  return distinctConversionSources([
    ...(analysis?.evidence || []),
    ...(analysis?.actions || []),
    ...(analysis?.forms || []),
    ...(analysis?.summarySources || []),
    ...(analysis?.goal?.sources || []),
    ...conversionAssessmentCandidates(analysis).flatMap((item) => item.sources),
    ...(analysis?.strengths || []).flatMap((item) => item.sources || []),
    ...issues.flatMap((issue) => issue.conversionEvidence || []),
  ]);
}

export function conversionPages(
  collectedPages: string[] | undefined,
  observations: ConversionSource[],
) {
  return [
    ...new Set(
      (collectedPages ?? observations.map((source) => source.pageUrl))
        .map(sourceURL)
        .filter((page): page is string => page !== null),
    ),
  ];
}

export function conversionFindingPages(issue: Issue) {
  return [
    ...new Set(
      [
        issue.pageUrl || "",
        ...(issue.conversionEvidence || []).map((source) => source.pageUrl),
      ]
        .map(sourceURL)
        .filter((page): page is string => page !== null),
    ),
  ];
}

export function conversionPageLabel(page: string) {
  const url = new URL(page);
  return `${url.host}${url.pathname}${url.search}`;
}

export function conversionAssessment(
  analysis: ConversionAnalysis | undefined,
  collectedPages?: string[],
) {
  const candidates = conversionAssessmentCandidates(analysis);
  const eligible = reviewedCriteria(
    candidates,
    collectedPages ?? [],
    conversionScore,
  );
  const criteria = CONVERSION_CRITERIA.map((rubric) => {
    const item = eligible.find(({ key }) => key === rubric.key);
    const unassessed = candidates.find(
      ({ key, score }) => key === rubric.key && score === null,
    );
    return {
      ...rubric,
      score: item?.score ?? null,
      reason:
        item?.reason ||
        unassessed?.reason ||
        "No source-backed assessment was available for this area.",
      sources: item?.sources ?? [],
    };
  });
  return {
    criteria,
    assessed: eligible.length,
    score: conversionScore(eligible),
  };
}

export function conversionValidation(issue: Issue) {
  const kinds = issue.conversionEvidence?.map((source) => source.kind) ?? [];
  if (
    issue.conversionCriterion === "forms" ||
    kinds.includes("form") ||
    kinds.includes("field")
  )
    return [
      "Check the affected form’s labels, instructions and required indicators against the recorded evidence.",
      "In a test environment, use dummy data to check keyboard flow, error messages and confirmation after submission.",
    ];
  if (
    issue.conversionCriterion === "actions" ||
    kinds.includes("link") ||
    kinds.includes("button")
  )
    return [
      "Check that the updated label describes the action or destination it actually opens.",
      "Try the affected control with a keyboard and on a small screen. Check the destination or what happens after activation.",
    ];
  return [
    "Compare the revised wording with the collected excerpt and confirm the facts with the site owner.",
    "Ask a visitor to explain their options and what will happen after taking the next step.",
  ];
}
export function conversionPlan(
  analysis: ConversionAnalysis | undefined,
  issues: Issue[],
  url: string,
  steps: Record<string, FixStep[]> = {},
  collectedPages?: string[],
) {
  const assessment = conversionAssessment(analysis, collectedPages);
  const sources = conversionObservations(analysis, issues);
  const pages = conversionPages(collectedPages, sources);
  const cite = (items: ConversionSource[] = []) =>
    items.map(
      (source) =>
        `  Source: ${sourceURL(source.pageUrl) || "Page unavailable"} · ${source.location} · ${source.id}`,
    );
  return [
    "CONVERSION CLARITY · ACTION PLAN",
    `Website: ${url}`,
    analysis?.summary || "Findings from the collected website evidence.",
    ...cite(analysis?.summarySources),
    `Qualitative clarity score: ${assessment.score ?? "Not assessed"}`,
    `${assessment.assessed} of ${assessment.criteria.length} criteria assessed`,
    ...assessment.criteria.flatMap((item) => [
      `${item.label}: ${item.score === null ? "Not assessed" : `${item.score}/100`} — ${item.reason}`,
      ...cite(item.sources),
    ]),
    "",
    "REVIEW SCOPE",
    `Pages reviewed: ${collectedPages ? pages.length : (analysis?.scope?.pages ?? (pages.length || "Not recorded"))}.`,
    ...pages.map((page) => `- ${page}`),
    ...(analysis
      ? [
          `Recorded link/control observations: ${analysis.scope?.controls ?? "Not recorded"}. Recorded forms: ${analysis.scope?.forms ?? "Not recorded"}.`,
          ...(analysis.scope?.truncated
            ? ["Some content and observations were sampled."]
            : []),
          ...(analysis.verification?.withheld
            ? ["Unsupported draft advice was withheld."]
            : []),
          "",
          `Likely visitor goal (report-wide hypothesis): ${analysis.goal?.text || "Not established"}`,
          ...cite(analysis.goal?.sources),
          "",
          "STRENGTHS TO PRESERVE",
          ...(analysis.strengths || []).flatMap((item) => [
            `- ${item.text}`,
            ...cite(item.sources),
          ]),
          "",
          "SELECTED ACTIONS",
          ...cite(analysis.actions),
          "OBSERVED FORMS",
          ...cite(analysis.forms),
        ]
      : []),
    "",
    "PRIORITIZED IMPROVEMENTS",
    ...reviewIssues(issues).flatMap(({ issue, key }, index) => [
      `${index + 1}. ${issue.title} · ${issue.priority} priority`,
      issue.detail,
      `Finding source: ${sourceURL(issue.pageUrl || "") || "Not recorded"}`,
      ...(!issue.conversionEvidence?.length && issue.evidence
        ? [`Collected evidence: ${issue.evidence}`]
        : []),
      ...cite(issue.conversionEvidence),
      ...(steps[key] ?? steps[issue.title] ?? issue.fixSteps ?? []).map(
        (step, index) => `${index + 1}) ${step.title}: ${step.description}`,
      ),
      "How to validate (manual checks)",
      ...conversionValidation(issue).map((check) => `- ${check}`),
      "",
    ]),
    ...(!issues.length
      ? [
          "No supported conversion clarity fixes were identified in this sample.",
        ]
      : []),
    "",
    "SUPPORTING OBSERVATIONS",
    ...sources.flatMap((source) => [
      `${source.id} · ${sourceURL(source.pageUrl) || "Page unavailable"} · ${source.location}`,
      ...conversionObservationRows(source).map(
        (row) => `${row.label}: ${row.value}`,
      ),
      "",
    ]),
    "VALIDATE WITH REAL VISITORS AND MEASUREMENT",
    "1) Define the completed action that matters. Track clicks separately from completed enquiries, signups or purchases.",
    "2) Test the affected route, form, feedback and mobile/keyboard behavior before publishing.",
    "3) Confirm consent-aware event delivery and compare outcomes using real analytics or a properly designed experiment.",
    "",
    "NOT TESTED",
    ...(
      analysis?.unassessed || [
        "Actual clicks, successful submissions and conversion performance",
      ]
    ).map((item) => `- ${item}`),
    "This is a qualitative review of collected HTML and copy, not a conversion-rate measurement or forecast of uplift.",
  ].join("\n");
}
