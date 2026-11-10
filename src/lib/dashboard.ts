import type { AuditResult, Issue } from "./types";
import { messagingScore } from "./messaging";
import { uxScore } from "./ux";
import { seoAssessmentCandidates, seoScore } from "./seo";
import { conversionAssessmentCandidates, conversionScore } from "./conversion";
import { aiVisibilityAssessment } from "./ai-visibility";
import { hasSecurityResults } from "./security-refresh";
import { hasAccessibilityResults } from "./accessibility-refresh";
import { validatedPageSpeedReports } from "./pagespeed";
import { sourceURL } from "./source-url";

export { sourceURL } from "./source-url";

export const DASHBOARD_AREAS = [
  {
    key: "messaging",
    label: "Messaging & copy",
    icon: "message",
    description: "Purpose, audience and supportable wording",
  },
  {
    key: "ux",
    label: "User experience",
    icon: "layers",
    description: "Navigation, structure and HTML control clarity",
  },
  {
    key: "seo",
    label: "Search optimization",
    icon: "search",
    description: "Metadata and observed discovery signals",
  },
  {
    key: "conversion",
    label: "Conversion",
    icon: "target",
    description: "Action clarity and decision support",
  },
  {
    key: "aeo",
    label: "AI content readiness",
    icon: "sparkle",
    description: "Clear answers, context and supporting detail",
  },
] as const;
export type DashboardArea = (typeof DASHBOARD_AREAS)[number]["key"];
export const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 } as const;
export const validDashboardScore = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;
export const findingIdentity = (issue: Issue) =>
  [
    sourceURL(issue.pageUrl || ""),
    issue.title.trim().toLowerCase().replace(/\s+/g, " "),
  ].join("|");
export function dashboardModel(result: AuditResult) {
  const pages = [
    ...new Map(
      (result.pagesAnalyzed || [])
        .filter(
          (page) =>
            sourceURL(page.url) &&
            Number.isFinite(Date.parse(page.fetchedAt)) &&
            /^[a-f\d]{64}$/i.test(page.contentHash),
        )
        .map((page) => [sourceURL(page.url)!, page]),
    ).values(),
  ];
  const pageURLs = new Set(pages.map((page) => sourceURL(page.url)));
  const sourced = (items: { pageUrl: string }[]) =>
    items.length > 0 &&
    items.every((item) => pageURLs.has(sourceURL(item.pageUrl)));
  function assessment<
    T extends {
      key: string;
      score: number | null;
      reason: string;
      sources: { pageUrl: string }[];
    },
  >(
    review: { method: string; criteria: T[] } | undefined,
    method: string,
    calculate: (criteria: T[]) => number | null,
  ) {
    if (review?.method !== method)
      return { score: null, assessed: 0, current: false };
    const eligible = review.criteria.filter(
      (item) =>
        validDashboardScore(item.score) &&
        item.reason.trim() &&
        sourced(item.sources),
    );
    const assessed = eligible.filter(
      (item, index) =>
        eligible.findIndex((other) => other.key === item.key) === index &&
        validDashboardScore(calculate([item])),
    );
    const score = calculate(assessed);
    return {
      score: validDashboardScore(score) ? score : null,
      assessed: assessed.length,
      current: true,
    };
  }
  const { score: readinessScore, assessed: readinessAssessed, current: readinessCurrent } =
    aiVisibilityAssessment(result.aeoAnalysis?.review, pages.map((page) => page.url));
  const assessments = {
    messaging: assessment(
      result.messagingAnalysis,
      "copy-evidence-review-v1",
      messagingScore,
    ),
    ux: assessment(result.uxAnalysis, "html-ux-review-v1", uxScore),
    seo: assessment(
      result.seoAnalysis && {
        ...result.seoAnalysis,
        criteria: seoAssessmentCandidates(result.seoAnalysis),
      },
      "page-seo-review-v1",
      seoScore,
    ),
    conversion: assessment(
      result.conversionAnalysis && {
        ...result.conversionAnalysis,
        criteria: conversionAssessmentCandidates(result.conversionAnalysis),
      },
      "conversion-evidence-review-v1",
      conversionScore,
    ),
    aeo: { score: readinessScore, assessed: readinessAssessed, current: readinessCurrent },
  };
  const lists = {
    messaging: result.messaging,
    ux: result.ux,
    seo: result.seo,
    conversion: result.conversion,
    aeo: result.aeoAnalysis?.issues || [],
  };
  const findings: { id: string; issue: Issue; areas: DashboardArea[] }[] = [];
  let unsupported = 0;
  for (const { key } of DASHBOARD_AREAS) {
    for (const issue of lists[key] || []) {
      const evidence =
        issue.evidence?.trim() ||
        (issue.messagingEvidence || []).map((item) => item.quote).join(" ") ||
        (issue.uxEvidence || []).map((item) => item.observation).join(" ") ||
        (issue.seoEvidence || []).map((item) => item.observation).join(" ") ||
        (issue.conversionEvidence || [])
          .map((item) => item.observation)
          .join(" ") ||
        (issue.aiEvidence || []).map((item) => item.text).join(" ");
      if (
        !issue.title.trim() ||
        !issue.detail.trim() ||
        !pageURLs.has(sourceURL(issue.pageUrl || "")) ||
        !evidence?.trim() ||
        !(issue.priority in PRIORITY_ORDER)
      ) {
        unsupported++;
        continue;
      }
      const id = findingIdentity(issue);
      const existing = findings.find((item) => item.id === id);
      if (existing) {
        if (!existing.areas.includes(key)) existing.areas.push(key);
        if (
          PRIORITY_ORDER[issue.priority] <
          PRIORITY_ORDER[existing.issue.priority]
        )
          existing.issue = issue;
      } else findings.push({ id, issue, areas: [key] });
    }
  }
  findings.sort(
    (a, b) =>
      PRIORITY_ORDER[a.issue.priority] - PRIORITY_ORDER[b.issue.priority],
  );
  const categories = DASHBOARD_AREAS.map((area) => ({
    ...area,
    ...assessments[area.key],
    findings: findings.filter((item) => item.areas.includes(area.key)).length,
  }));
  const scores = categories.flatMap((item) =>
    item.score === null ? [] : [item.score],
  );
  const overallScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const priorities = { High: 0, Medium: 0, Low: 0 };
  for (const { issue } of findings) priorities[issue.priority]++;
  const quickWins = [
    ...new Map(
      (result.quickWins || [])
        .filter(
          (win) =>
            win.relatedIssue &&
            findings.some(
              (item) => item.id === findingIdentity(win.relatedIssue!),
            ) &&
            win.effort !== "High" &&
            win.action.trim(),
        )
        .map((win) => [findingIdentity(win.relatedIssue!), win]),
    ).values(),
  ];
  const urls = (items: string[]) => [
    ...new Set(items.map(sourceURL).filter((item): item is string => !!item)),
  ];
  const researchLinks = urls(result.research?.sources || []);
  const researchAvailable = !!(
    result.research?.summary.trim() &&
    researchLinks.length &&
    Number.isFinite(Date.parse(result.research.searchedAt))
  );
  const sourceLinks = urls([
    ...(result.sources || []),
    ...pages.map((page) => page.url),
    ...(researchAvailable ? researchLinks : []),
  ]);
  const performance = validatedPageSpeedReports(result.pageSpeedReports, result.url);
  const checks = [
    {
      key: "security" as const,
      label: "Security signals",
      icon: "shield" as const,
      available: hasSecurityResults(result.securityAudit, result.url),
      description:
        "Response headers and initial HTML; no vulnerability verdict.",
    },
    {
      key: "accessibility" as const,
      label: "Accessibility signals",
      icon: "access" as const,
      available: hasAccessibilityResults(result.accessibilityAudit, result.url),
      description:
        "HTML observations; browser and assistive testing still needed.",
    },
    {
      key: "performance" as const,
      label: "PageSpeed insights",
      icon: "chart" as const,
      available: performance.length > 0,
      description: performance.length
        ? `${performance.map((item) => item.strategy).join(" & ")} measurements collected; review their own timestamps.`
        : "Run a separate mobile or desktop performance test.",
    },
  ];
  const warnings = [...new Set((result.warnings || []).filter(Boolean))];
  const limitations = [
    ...new Set([
      "Only the listed pages were collected; this is not a whole-domain crawl.",
      "Scores assess supported content and HTML criteria. They do not measure conversions, rankings, AI citations, security protection or WCAG conformance.",
      ...(result.limitations || []),
    ]),
  ];
  return {
    pages,
    sourceLinks,
    researchLinks,
    researchAvailable,
    categories,
    overallScore,
    assessed: scores.length,
    findings,
    priorities,
    quickWins,
    unsupported,
    checks,
    warnings,
    limitations,
  };
}
export type DashboardModel = ReturnType<typeof dashboardModel>;
export function dashboardPlan(
  result: AuditResult,
  model = dashboardModel(result),
) {
  return [
    "AUDIT OVERVIEW",
    `Website: ${result.url}`,
    `Audit collected: ${result.analyzedAt}`,
    `Content & clarity assessment: ${model.overallScore === null ? "Not assessed" : `${model.overallScore}/100`}`,
    `Equal average of ${model.assessed} available category assessments; unassessed, legacy and non-marketing scores are excluded.`,
    "",
    "CATEGORY ASSESSMENTS",
    ...model.categories.map(
      (item) =>
        `${item.label}: ${item.score ?? "Not assessed"}${item.score === null ? "" : "/100"} · ${item.assessed}/4 criteria assessed · ${item.findings} finding(s)`,
    ),
    "",
    `${model.findings.length} distinct supported findings · ${model.priorities.High} high, ${model.priorities.Medium} medium, ${model.priorities.Low} low priority.`,
    "Priority is a qualitative recommendation, not measured business impact.",
    ...model.findings.flatMap(({ issue, areas }, index) => [
      "",
      `${index + 1}. ${issue.title}`,
      `${issue.priority} priority · ${areas.map((area) => DASHBOARD_AREAS.find((item) => item.key === area)!.label).join(", ")}`,
      issue.detail,
      `Page: ${issue.pageUrl}`,
      `Evidence: ${issue.evidence || "See the category review for structured source observations."}`,
      ...(issue.fixSteps || []).map(
        (step, i) => `${i + 1}) ${step.title}: ${step.description}`,
      ),
    ]),
    "",
    "COVERAGE",
    `${model.pages.length} distinct collected pages · ${model.sourceLinks.length} unique source links`,
    ...model.pages.map(
      (page) =>
        `${page.url} · ${page.fetchedAt} · SHA-256: ${page.contentHash}${page.collectionNote ? ` · ${page.collectionNote}` : ""}`,
    ),
    "Source links (a listed link does not mean its page was collected):",
    ...model.sourceLinks,
    `Web research: ${model.researchAvailable ? `${model.researchLinks.length} source links recorded at ${result.research!.searchedAt}` : "Not available in this report"}`,
    ...model.checks.map(
      (check) =>
        `${check.label}: ${check.available ? "Results collected" : "No current results"} · ${check.description}`,
    ),
    `${model.quickWins.length} linked smaller-effort suggestions available; effort is an estimate.`,
    ...(model.unsupported
      ? [
          `${model.unsupported} finding record(s) excluded because page evidence or required fields were incomplete.`,
        ]
      : []),
    "",
    "WARNINGS & LIMITATIONS",
    ...model.warnings,
    ...model.limitations,
  ].join("\n");
}
