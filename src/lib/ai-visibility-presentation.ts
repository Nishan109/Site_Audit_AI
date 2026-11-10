import { sourceURL } from "./dashboard";
import { reviewIssues } from "./review-workspace";
import type { AuditResult, FixStep, Issue } from "./types";
import {
  AI_VISIBILITY_UNASSESSED,
  aiVisibilityAssessment,
  isAIVisibilitySource,
  type AIVisibilityPage,
  type AIVisibilityReview,
  type AIVisibilitySource,
} from "./ai-visibility";

export type ReadinessCollectedPage = Pick<
  NonNullable<AuditResult["pagesAnalyzed"]>[number],
  "url" | "title" | "fetchedAt"
>;

const observedValues = (values: unknown, empty: string) =>
  Array.isArray(values)
    ? values.length
      ? values
          .map((value) =>
            typeof value === "string" && value.trim() ? value : "Empty value",
          )
          .join("\n")
      : empty
    : "Not recorded";

export function aiHeadingRows(headings: unknown) {
  if (!Array.isArray(headings)) return [];
  return headings.flatMap((heading) =>
    heading &&
    Number.isInteger(heading.level) &&
    heading.level >= 1 &&
    heading.level <= 6 &&
    typeof heading.text === "string"
      ? [{ label: `H${heading.level}`, value: heading.text || "Empty heading" }]
      : [],
  );
}

export function aiMarkupRows(data: Record<string, unknown>) {
  const count = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? String(value)
      : "Not recorded";
  return [
    { label: "JSON-LD blocks", value: count(data.jsonLdBlocks) },
    { label: "Unparseable JSON-LD blocks", value: count(data.invalidJsonLd) },
    {
      label: "JSON-LD types",
      value: observedValues(data.jsonLdTypes, "None collected"),
    },
    {
      label: "Microdata types",
      value: observedValues(data.microdataTypes, "None collected"),
    },
    {
      label: "RDFa types",
      value: observedValues(data.rdfaTypes, "None collected"),
    },
  ];
}

export function aiVisibilityRows(source: AIVisibilitySource) {
  if (source.kind === "copy")
    return [{ label: "Website excerpt", value: source.text }];
  try {
    const parsed: unknown = JSON.parse(source.text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const data = parsed as Record<string, unknown>;
      if (source.kind === "headings" && Array.isArray(data.headings)) {
        const rows = aiHeadingRows(data.headings);
        if (!data.headings.length)
          return [{ label: "Heading outline", value: "No headings collected" }];
        if (rows.length) return rows;
      }
      if (source.kind === "metadata")
        return [
          {
            label: "Title elements",
            value: observedValues(data.titles, "No title collected"),
          },
          {
            label: "Meta descriptions",
            value: observedValues(
              data.descriptions,
              "No description collected",
            ),
          },
          {
            label: "HTML language",
            value:
              typeof data.language === "string"
                ? data.language || "Not declared"
                : "Not recorded",
          },
        ];
      if (source.kind === "structured") return aiMarkupRows(data);
    }
  } catch {
    // Saved observations may predate the structured shape.
  }
  return [{ label: "Collected observation", value: source.text }];
}

export function aiSourceKey(source: AIVisibilitySource) {
  return JSON.stringify([
    sourceURL(source.pageUrl) ?? source.pageUrl,
    source.id,
  ]);
}

export function distinctAISources(sources: AIVisibilitySource[] = []) {
  const records = new Map<string, AIVisibilitySource>();
  if (!Array.isArray(sources)) return [];
  for (const source of sources) {
    if (!isAIVisibilitySource(source)) continue;
    const key = aiSourceKey(source);
    if (!records.has(key)) records.set(key, source);
  }
  return [...records.values()];
}

export function aiFindingPages(issue: Issue) {
  return [
    ...new Set(
      [
        issue.pageUrl,
        ...distinctAISources(issue.aiEvidence).map(({ pageUrl }) => pageUrl),
      ].flatMap((value) => {
        const key = sourceURL(value || "");
        return key ? [key] : [];
      }),
    ),
  ];
}

export function aiVisibilityPages(
  review: AIVisibilityReview | undefined,
  collected: ReadinessCollectedPage[] | undefined,
  sources: AIVisibilitySource[],
) {
  const records = new Map<string, AIVisibilityPage>();
  for (const page of Array.isArray(review?.pages) ? review.pages : []) {
    const key = sourceURL(page?.url || "");
    if (key && !records.has(key)) records.set(key, page);
  }
  const inventory: { url: string; title?: string; fetchedAt?: string }[] =
    collected ??
    [
      ...new Set([
        ...records.keys(),
        ...sources.map((source) => source.pageUrl),
      ]),
    ].map((url) => ({ url }));
  const pages = new Map<
    string,
    {
      url: string;
      title: string;
      fetchedAt?: string;
      record?: AIVisibilityPage;
    }
  >();
  for (const page of inventory) {
    const url = sourceURL(page.url);
    if (!url || pages.has(url)) continue;
    const record = records.get(url);
    pages.set(url, {
      url,
      title: record?.title || page.title || "Collected page",
      fetchedAt: page.fetchedAt,
      record,
    });
  }
  return [...pages.values()];
}

export type ReadinessPage = ReturnType<typeof aiVisibilityPages>[number];

export function aiVisibilityPageEvidence(
  page: ReadinessPage,
  sources: AIVisibilitySource[],
) {
  const local = sources.filter(
    (source) => sourceURL(source.pageUrl) === page.url,
  );
  const copy = local.filter(({ kind }) => kind === "copy");
  const order = new Map(
    (Array.isArray(page.record?.excerptIds) ? page.record.excerptIds : []).map(
      (id, index) => [id, index],
    ),
  );
  copy.sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  return {
    copy,
    metadata: local.filter(({ kind }) => kind === "metadata"),
    headings: local.filter(({ kind }) => kind === "headings"),
    structured: local.filter(({ kind }) => kind === "structured"),
  };
}

export function aiVisibilityPresentation(
  review: AIVisibilityReview | undefined,
  issues: Issue[],
  collected?: ReadinessCollectedPage[],
) {
  const assessment = aiVisibilityAssessment(
    review,
    collected?.map(({ url }) => url),
  );
  const summarySources =
    assessment.current && !assessment.summaryWithheld
      ? distinctAISources(review?.summarySources)
      : [];
  const summary =
    summarySources.length && typeof review?.summary === "string"
      ? review.summary
      : undefined;
  const strengths =
    assessment.current && Array.isArray(review?.strengths)
      ? review.strengths.filter((item) => typeof item?.text === "string")
      : [];
  const observations = distinctAISources([
    ...(Array.isArray(review?.evidence) ? review.evidence : []),
    ...summarySources,
    ...assessment.criteria.flatMap(({ sources }) => sources),
    ...strengths.flatMap((item) => distinctAISources(item.sources)),
    ...issues.flatMap((issue) => distinctAISources(issue.aiEvidence)),
  ]);
  return {
    assessment,
    summary,
    summarySources,
    strengths,
    observations,
    pages: aiVisibilityPages(review, collected, observations),
    limits: [
      ...new Set([
        ...AI_VISIBILITY_UNASSESSED,
        ...(Array.isArray(review?.unassessed)
          ? review.unassessed.filter((item) => typeof item === "string")
          : []),
      ]),
    ],
  };
}

export function aiVisibilityValidation(issue: Issue) {
  switch (issue.aiCriterion) {
    case "identity":
      return [
        "Check that the page names the organization and describes the offer or topic clearly.",
        "Verify the stated scope, location, or audience against the current facts.",
      ];
    case "support":
      return [
        "Find the source, date, qualification, or constraint behind the affected claim.",
        "Check that the revised wording accurately reflects what that source supports.",
      ];
    case "structure":
      return [
        "Check that the affected heading describes the content immediately below it.",
        "Read the heading outline in order and confirm it is easy to scan.",
      ];
    case "answers":
      return [
        "Identify the visitor question the revision is meant to answer.",
        "Read the revision on the page and verify that it answers the question using confirmed details.",
      ];
    default:
      return [
        "Compare the change with the collected evidence and confirm any new details.",
        "Read the revised page in context to check that the change addresses the finding.",
      ];
  }
}

export function aiVisibilityPlan(
  review: AIVisibilityReview | undefined,
  issues: Issue[],
  url: string,
  steps: Record<string, FixStep[]> = {},
  collected?: ReadinessCollectedPage[],
) {
  const model = aiVisibilityPresentation(review, issues, collected);
  const { assessment, pages } = model;
  const cite = (sources?: AIVisibilitySource[]) =>
    distinctAISources(sources).map(
      (source) =>
        `  Source: ${sourceURL(source.pageUrl) || "Page unavailable"} · ${source.id} · ${source.label}`,
    );
  return [
    "AI VISIBILITY · CONTENT READINESS PLAN",
    `Website: ${url}`,
    "Live AI appearances, citations and crawler access were not measured.",
    `Content-readiness score: ${assessment.score === null ? "Not assessed" : `${assessment.score}/100`}`,
    `${assessment.assessed} of ${assessment.criteria.length} criteria assessed`,
    ...(assessment.partial
      ? ["Some explanations could not be verified and were withheld."]
      : []),
    ...(assessment.current
      ? []
      : ["Run a new audit for a cited content-readiness assessment."]),
    ...(model.summary ? [model.summary, ...cite(model.summarySources)] : []),
    ...assessment.criteria.flatMap((item) => [
      `${item.label}: ${item.score === null ? "Not assessed" : `${item.score}/100`} — ${item.reason}`,
      ...cite(item.sources),
    ]),
    "",
    "REVIEW SCOPE",
    `${pages.length} collected page(s) in the available inventory. ${review?.scope?.sources ?? model.observations.length} recorded observation(s).`,
    ...(review?.scope?.sampled ? ["Some content was sampled."] : []),
    ...(review?.verification?.withheld
      ? ["Unsupported or uncertain draft advice was withheld."]
      : []),
    ...pages.map((page) =>
      [
        page.url,
        page.fetchedAt ? `Collected ${page.fetchedAt}` : "",
        page.record?.sampled ? "Page sample was limited." : "",
      ]
        .filter(Boolean)
        .join(" · "),
    ),
    "",
    "STRENGTHS TO PRESERVE",
    ...model.strengths.flatMap((item) => [item.text, ...cite(item.sources)]),
    "",
    "PRIORITIZED IMPROVEMENTS",
    ...reviewIssues(issues).flatMap(({ issue, key }) => [
      `${issue.priority} priority · ${issue.title}`,
      issue.detail,
      `Finding page: ${sourceURL(issue.pageUrl || "") || "Not recorded"}`,
      ...cite(issue.aiEvidence),
      ...(!distinctAISources(issue.aiEvidence).length && issue.evidence
        ? [issue.evidence]
        : []),
      ...(steps[key] ?? steps[issue.title] ?? issue.fixSteps ?? []).map(
        (step, index) => `${index + 1}) ${step.title}: ${step.description}`,
      ),
      "How to check it (manual)",
      ...aiVisibilityValidation(issue).map((item) => `- ${item}`),
      "",
    ]),
    ...(!issues.length
      ? ["No supported content improvements were identified in this sample."]
      : []),
    "",
    "OBSERVED PAGE EVIDENCE",
    ...pages.flatMap((page) => [
      page.url,
      page.title,
      ...aiHeadingRows(page.record?.headings).map(
        ({ label, value }) => `${label}: ${value}`,
      ),
      ...(page.record?.markup?.collected === true
        ? aiMarkupRows(page.record.markup).map(
            ({ label, value }) => `${label}: ${value}`,
          )
        : ["Markup inventory: Not collected"]),
      "",
    ]),
    "COLLECTED EVIDENCE · WEBSITE CLAIMS ARE NOT INDEPENDENTLY VERIFIED",
    ...model.observations.flatMap((source) => [
      `${source.id} · ${sourceURL(source.pageUrl) || "Page unavailable"} · ${source.label}`,
      ...[source.region, source.heading].filter(Boolean),
      ...aiVisibilityRows(source).map(
        ({ label, value }) => `${label}: ${value}`,
      ),
      ...(source.truncated ? ["Excerpt sampled."] : []),
      "",
    ]),
    "NOT MEASURED",
    ...model.limits.map((item) => `- ${item}`),
  ].join("\n");
}
