import { sourceURL } from "./dashboard";
import { reviewedCriteria, reviewIssues } from "./review-workspace";
import type { Issue, FixStep } from "./types";
import {
  SEO_CRITERIA,
  SEO_UNTESTED,
  seoAssessmentCandidates,
  seoScore,
  type SEOAnalysis,
  type SEOPage,
  type SEOSource,
} from "./seo";

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      )
    : [];

function recordedValues(values: unknown, empty: string) {
  if (!Array.isArray(values)) return "Not recorded";
  return values.length
    ? values
        .map((value) =>
          typeof value === "string" && value.trim() ? value : "Empty value",
        )
        .join("\n")
    : empty;
}

export function seoReviewedCriteria(
  analysis?: SEOAnalysis,
  collectedPages?: string[],
) {
  return reviewedCriteria(
    seoAssessmentCandidates(analysis),
    collectedPages,
    seoScore,
  );
}

export function seoSourceKey(source: SEOSource) {
  return JSON.stringify([
    sourceURL(source.pageUrl) ?? source.pageUrl,
    source.id,
  ]);
}

export function seoObservations(
  analysis: SEOAnalysis | undefined,
  issues: Issue[],
) {
  const sources = [
    ...(analysis?.evidence || []),
    ...(analysis?.assessmentValidation?.summaryWithheld
      ? []
      : analysis?.summarySources || []),
    ...seoAssessmentCandidates(analysis).flatMap((item) => item.sources || []),
    ...(analysis?.strengths || []).flatMap((item) => item.sources),
    ...issues.flatMap((issue) => issue.seoEvidence || []),
  ];
  const observations = new Map<string, SEOSource>();
  for (const source of sources) {
    const key = seoSourceKey(source);
    if (!observations.has(key)) observations.set(key, source);
  }
  return [...observations.values()];
}

export function seoPageSignals(page: SEOPage) {
  const structured = page.structured;
  return {
    metadata: [
      {
        label: "Title elements",
        value: recordedValues(page.titles, "No title collected"),
      },
      {
        label: "Meta descriptions",
        value: recordedValues(page.descriptions, "No description collected"),
      },
      {
        label: "HTML language",
        value:
          page.language ||
          (page.language === "" ? "Not declared" : "Not recorded"),
      },
    ],
    discovery: [
      {
        label: "HTTP status",
        value: String(page.responseStatus ?? "Not collected"),
      },
      {
        label: "Response headers",
        value:
          page.headersChecked == null
            ? "Not recorded"
            : page.headersChecked
              ? "Collected"
              : "Not collected",
      },
      {
        label: "Canonical declarations",
        value: page.canonicals
          ? recordedValues(
              page.canonicals.map(
                ({ href, resolved, method }) =>
                  `${method} · Declared ${href || "empty value"}${resolved ? ` · Resolved ${resolved}` : " · No resolved HTTP(S) target"}`,
              ),
              page.headersChecked
                ? "None collected in HTML or response headers"
                : "None collected in HTML. Header declarations unavailable.",
            )
          : "Not recorded",
      },
      {
        label: "Page directives",
        value: page.directives
          ? recordedValues(
              page.directives.map(
                ({ agent, value, method }) =>
                  `${agent} · ${method} · ${value || "Empty value"}`,
              ),
              page.headersChecked
                ? "None collected in HTML or response headers"
                : "None collected in HTML. Header directives unavailable.",
            )
          : "Not recorded",
      },
    ],
    content: [
      {
        label: "Collected heading outline",
        value: recordedValues(
          page.headings?.map(
            ({ level, text }) => `H${level} · ${text || "Empty text"}`,
          ),
          "No headings collected",
        ),
      },
      {
        label: "Collected copy excerpts",
        value: recordedValues(page.content, "No excerpts collected"),
      },
      {
        label: "Sampled internal links",
        value: recordedValues(
          page.internalLinks?.map(
            ({ text, url }) => `${text || "No text label"} · ${url}`,
          ),
          "No links collected",
        ),
      },
    ],
    structured: [
      {
        label: "JSON-LD blocks",
        value: String(structured?.jsonLdBlocks ?? "Not recorded"),
      },
      {
        label: "Unparseable JSON-LD blocks",
        value: String(structured?.invalidJsonLd ?? "Not recorded"),
      },
      {
        label: "JSON-LD types",
        value: recordedValues(structured?.jsonLdTypes, "None collected"),
      },
      {
        label: "Microdata types",
        value: recordedValues(structured?.microdataTypes, "None collected"),
      },
      {
        label: "RDFa types",
        value: recordedValues(structured?.rdfaTypes, "None collected"),
      },
    ],
  };
}

export function seoObservationRows(
  source: SEOSource,
): { label: string; value: string }[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.observation);
  } catch {
    return [{ label: "Collected observation", value: source.observation }];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return [{ label: "Collected observation", value: source.observation }];
  const data = parsed as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === "string" || typeof value === "number")
      rows.push({ label, value: String(value) });
  };
  const array = (value: unknown) => (Array.isArray(value) ? value : []);
  const headerState =
    data.headersChecked === true
      ? "Collected"
      : data.headersChecked === false
        ? "Not collected"
        : "Not recorded";
  if (source.kind === "metadata") {
    add(
      "Title elements",
      recordedValues(data.titles, "Not observed in initial HTML"),
    );
    add(
      "Meta descriptions",
      recordedValues(data.descriptions, "Not observed in initial HTML"),
    );
    add("HTML language", data.language ?? "Not recorded");
  } else if (source.kind === "canonical") {
    for (const [index, item] of records(data.declarations).entries()) {
      add(
        `Canonical ${index + 1} · ${item.method}`,
        item.resolved || item.href || "Empty declaration",
      );
    }
    if (!array(data.declarations).length)
      add("Canonical", "No declaration collected");
    add("Response headers", headerState);
  } else if (source.kind === "directives") {
    for (const item of records(data.directives))
      add(`${item.agent} · ${item.method}`, item.value || "Empty value");
    if (!array(data.directives).length)
      add(
        "Page directives",
        "None collected; this does not establish indexability",
      );
    add("HTTP response", data.responseStatus ?? "Not collected");
    add("Response headers", headerState);
  } else if (source.kind === "headings") {
    for (const [index, item] of records(data.headings).entries())
      add(`Heading ${index + 1} · H${item.level}`, item.text);
    if (!array(data.headings).length)
      add("Heading outline", "No headings collected");
  } else if (source.kind === "structured") {
    add("JSON-LD blocks", data.jsonLdBlocks);
    add("Unparseable JSON-LD blocks", data.invalidJsonLd);
    add(
      "JSON-LD types",
      array(data.jsonLdTypes).join(", ") || "None collected",
    );
    add(
      "Microdata types",
      array(data.microdataTypes).join(", ") || "None collected",
    );
    add("RDFa types", array(data.rdfaTypes).join(", ") || "None collected");
  } else if (source.kind === "links") {
    for (const [index, item] of records(data.links).entries())
      add(`Link ${index + 1} · ${item.text || "No text label"}`, item.url);
    add("Destination behavior", "Not opened or tested");
  } else if (source.kind === "content")
    for (const [index, value] of array(data.copy).entries())
      add(`Copy excerpt ${index + 1}`, value);
  return rows.length
    ? rows
    : [{ label: "Collected observation", value: source.observation }];
}
export function seoPlan(
  analysis: SEOAnalysis | undefined,
  issues: Issue[],
  url: string,
  steps: Record<string, FixStep[]> = {},
  collectedPages?: string[],
) {
  const eligible = seoReviewedCriteria(analysis, collectedPages);
  const observations = seoObservations(analysis, issues);
  const pages = analysis?.pages || [];
  const strengths = analysis?.strengths || [];
  return [
    "SEARCH OPTIMIZATION · ACTION PLAN",
    `Website: ${url}`,
    analysis?.assessmentValidation?.summaryWithheld
      ? "The summary could not be verified in this run. Collected observations and supported findings remain available."
      : (analysis?.method === "page-seo-review-v1" && analysis.summary) ||
        "Findings from the collected page evidence.",
    `Qualitative on-page score: ${seoScore(eligible) ?? "Not assessed"}`,
    ...(analysis
      ? [
          ...(analysis.assessmentValidation?.summaryWithheld ||
          analysis.assessmentValidation?.withheldCriteria.length
            ? [
                "Some SEO assessments could not be verified. Unverified explanations were withheld and affected areas are excluded from the score.",
              ]
            : []),
          ...SEO_CRITERIA.map(({ key, label }) => {
            const item = eligible.find((criterion) => criterion.key === key);
            const reason =
              analysis.assessmentValidation?.withheldCriteria?.includes(key)
                ? "The assessment explanation could not be verified."
                : "No verified assessment was available for this area.";
            return `${label}: ${item ? `${item.score}/100 — ${item.reason}` : `Not assessed — ${reason}`}`;
          }),
        ]
      : []),
    "",
    ...(analysis
      ? [
          "REVIEW SCOPE",
          `Pages reviewed: ${collectedPages?.length ?? analysis.scope?.pages ?? "Not recorded"}. Final responses with headers collected: ${analysis.scope?.headersChecked ?? "Not recorded"}.`,
          ...pages.map((page) => `- ${page.url}`),
          ...(analysis.scope?.truncated
            ? ["Some content or observations were sampled."]
            : []),
          "",
          ...(strengths.length
            ? [
                "STRENGTHS TO PRESERVE",
                ...strengths.flatMap((item) => [
                  `- ${item.text}`,
                  ...item.sources.map(
                    (source) => `  Source: ${source.pageUrl} · ${source.label}`,
                  ),
                ]),
                "",
              ]
            : []),
        ]
      : []),
    "PRIORITIZED IMPROVEMENTS",
    ...reviewIssues(issues).flatMap(({ issue, key }, index) => [
      `${index + 1}. ${issue.title} · ${issue.priority} priority`,
      issue.detail,
      `Finding source: ${issue.pageUrl || "Not recorded"}`,
      ...(issue.seoEvidence || []).flatMap((source) => [
        `Source: ${source.pageUrl} · ${source.label}`,
        ...seoObservationRows(source).map(
          (row) => `${row.label}: ${row.value}`,
        ),
      ]),
      ...(!issue.seoEvidence?.length && issue.evidence
        ? [`Saved observation: ${issue.evidence}`]
        : []),
      ...(steps[key] ?? steps[issue.title] ?? issue.fixSteps ?? []).map(
        (step, index) => `${index + 1}) ${step.title}: ${step.description}`,
      ),
      "",
    ]),
    ...(!issues.length
      ? ["No supported on-page fixes were identified in this sample."]
      : []),
    "",
    ...(analysis?.checks?.length || pages.length
      ? [
          "OBSERVED PAGE SIGNALS",
          ...pages.flatMap((page) => [
            page.url,
            ...Object.values(seoPageSignals(page))
              .flat()
              .map(({ label, value }) => `${label}: ${value}`),
            ...(page.truncated
              ? ["Some observations for this page were sampled."]
              : []),
            "",
          ]),
          ...(analysis?.checks || []).flatMap((check) => [
            `${check.pageUrl} · ${check.label}: ${check.status}`,
            check.detail,
          ]),
          "",
        ]
      : []),
    ...(observations.length
      ? [
          "SUPPORTING OBSERVATIONS",
          ...observations.flatMap((source) => [
            `${source.id} · ${source.pageUrl} · ${source.label}`,
            ...seoObservationRows(source).map(
              (row) => `${row.label}: ${row.value}`,
            ),
            "",
          ]),
        ]
      : []),
    "NOT TESTED",
    ...[...new Set([...(analysis?.unassessed || []), ...SEO_UNTESTED])].map(
      (item) => `- ${item}`,
    ),
    "This is a qualitative assessment of collected HTML and available response headers, not a search-ranking, indexing or rich-result eligibility measurement.",
  ].join("\n");
}
