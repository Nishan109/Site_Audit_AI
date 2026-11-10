import type { AuditResult, Issue } from "../src/lib/types";
import { MESSAGING_CRITERIA } from "../src/lib/messaging";
import { UX_CRITERIA } from "../src/lib/ux";
import { SEO_CRITERIA } from "../src/lib/seo";
import { CONVERSION_CRITERIA } from "../src/lib/conversion";
import { analysis as aiAnalysis } from "./ai-visibility-fixtures";

export const url = "https://bakery.example/";
export const source = {
  id: "COPY1",
  pageUrl: url,
  quote: "Sourdough bread for Saturday collection in Bath.",
  kind: "body",
  region: "main",
};
export const observation = {
  id: "HTML1",
  pageUrl: url,
  kind: "page" as const,
  location: "main",
  observation: source.quote,
};
export const issue = (
  title: string,
  priority: Issue["priority"] = "Medium",
  pageUrl = url,
): Issue => ({
  title,
  priority,
  pageUrl,
  detail: `The collected page supports this review: ${title}.`,
  evidence: source.quote,
  fixSteps: [
    {
      title: `Review ${title.toLowerCase()}`,
      description:
        "Use the collected wording to make the change, then check it in a browser.",
    },
  ],
});
export function dashboardFixture(): AuditResult {
  return {
    url,
    analyzedAt: "2026-11-07T10:00:00.000Z",
    analysisId: "dashboard-fixture",
    dataSource: "live",
    summary: "A bakery collection page.",
    overview: "The collected page explains a bakery offering.",
    scores: {
      Messaging: 99,
      UX: 99,
      SEO: 99,
      Conversion: 99,
      AEO: 99,
      Security: 100,
      Accessibility: 100,
    },
    pagesAnalyzed: [
      {
        url,
        title: "Acorn Bakery",
        fetchedAt: "2026-11-07T09:59:00.000Z",
        contentHash: "a".repeat(64),
      },
    ],
    sources: [url, `${url}#main`, "https://research.example/bakery"],
    searchQueries: [],
    agentSteps: [],
    topIssues: [issue("Only the saved shortlist")],
    messaging: [
      issue("Explain collection timing", "Low"),
      issue("Clarify the main promise", "High"),
    ],
    ux: [issue("Label the collection control", "High")],
    seo: [issue("Review the page description")],
    conversion: [issue("Explain the next step")],
    quickWins: [],
    messagingAnalysis: {
      method: "copy-evidence-review-v1",
      summary: source.quote,
      summarySources: [source],
      strengths: [
        { text: "The page names its offering and location.", source },
      ],
      criteria: MESSAGING_CRITERIA.map(({ key }) => ({
        key,
        score: 80,
        reason: "The collected copy supports this criterion.",
        sources: [source],
      })),
      scope: { pages: 1, blocks: 1, truncated: false },
      verification: { checked: 2, retained: 2, withheld: 0 },
    },
    uxAnalysis: {
      method: "html-ux-review-v1",
      summary: "The collected HTML supports a navigation review.",
      summarySources: [observation],
      criteria: UX_CRITERIA.map(({ key }) => ({
        key,
        score: 60,
        reason: "The collected HTML supports this criterion.",
        sources: [observation],
      })),
      strengths: [],
      scope: {
        pages: 1,
        sources: 1,
        navigation: 1,
        headings: 1,
        links: 1,
        buttons: 1,
        forms: 0,
        fields: 0,
        truncated: false,
      },
      verification: { checked: 1, retained: 1, withheld: 0 },
      unassessed: [],
    },
    seoAnalysis: {
      method: "page-seo-review-v1",
      summary: "The collected metadata supports an on-page review.",
      summarySources: [],
      criteria: SEO_CRITERIA.map(({ key }) => ({
        key,
        score: 90,
        reason: "The collected metadata supports this criterion.",
        sources: [
          {
            id: "SEO1",
            pageUrl: url,
            kind: "metadata",
            label: "Page metadata",
            observation: source.quote,
          },
        ],
      })),
      strengths: [],
      checks: [],
      pages: [],
      scope: { pages: 1, sources: 1, headersChecked: 1, truncated: false },
      verification: { checked: 1, retained: 1, withheld: 0 },
      unassessed: [],
    },
    conversionAnalysis: {
      method: "conversion-evidence-review-v1",
      summary: "The next-step wording supports a clarity review.",
      summarySources: [observation],
      goal: null,
      actions: [],
      forms: [],
      evidence: [observation],
      criteria: CONVERSION_CRITERIA.map(({ key }) => ({
        key,
        score: 70,
        reason: "The collected wording supports this criterion.",
        sources: [observation],
      })),
      strengths: [],
      scope: { pages: 1, sources: 1, controls: 1, forms: 0, truncated: false },
      verification: { checked: 1, retained: 1, withheld: 0 },
      unassessed: [],
    },
    aeoAnalysis: {
      ...structuredClone(aiAnalysis),
      issues: [issue("Add support for product details", "Low")],
    },
  };
}
