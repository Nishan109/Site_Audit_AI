import type { AEOAnalysis, Issue } from "../src/lib/types";
import {
  AI_VISIBILITY_CRITERIA,
  AI_VISIBILITY_UNASSESSED,
  type AIVisibilityReview,
  type AIVisibilitySource,
} from "../src/lib/ai-visibility";
export const source: AIVisibilitySource = {
  id: "AI1-C1",
  pageUrl: "https://bakery.example/",
  kind: "copy",
  label: "Page excerpt",
  text: "Acorn Bakery bakes sourdough bread for Saturday collection in Bath.",
  region: "main",
};
export const markup: AIVisibilitySource = {
  id: "AI1-S",
  pageUrl: source.pageUrl,
  kind: "structured",
  label: "Structured-data observations",
  text: JSON.stringify({
    jsonLdBlocks: 1,
    invalidJsonLd: 0,
    jsonLdTypes: ["Bakery"],
    microdataTypes: [],
    rdfaTypes: [],
  }),
};
export const otherSource: AIVisibilitySource = {
  ...source,
  id: "AI2-C1",
  pageUrl: "https://bakery.example/about",
  text: "Our bakery team prepares bread in Bath each morning.",
};
export const review: AIVisibilityReview = {
  method: "cited-content-readiness-v1",
  summary:
    "The bakery page explains its location and collection context, with an opportunity to add verified product detail.",
  summarySources: [source],
  criteria: AI_VISIBILITY_CRITERIA.map(({ key }) => ({
    key,
    score: key === "support" ? null : 80,
    reason:
      key === "support"
        ? "The collected sample does not support an attribution assessment for these specific claims."
        : "The bakery's collected wording identifies its offering and collection context.",
    sources: [source],
  })),
  strengths: [
    {
      text: "The introduction identifies the bakery's location and collection day.",
      sources: [source],
    },
  ],
  evidence: [
    source,
    markup,
    ...Array.from({ length: 3 }, (_, index) => ({
      ...source,
      id: `AI1-C${index + 2}`,
      text: `Additional bakery excerpt ${index + 1}.`,
    })),
    otherSource,
  ],
  pages: [
    {
      url: source.pageUrl,
      title: "Acorn Bakery in Bath",
      excerptIds: [source.id],
      headings: [{ level: 1, text: "Saturday collection" }],
      markup: {
        collected: true,
        jsonLdBlocks: 1,
        invalidJsonLd: 0,
        jsonLdTypes: ["Bakery"],
        microdataTypes: [],
        rdfaTypes: [],
      },
      sampled: false,
    },
    {
      url: otherSource.pageUrl,
      title: "About the Acorn team",
      excerptIds: [otherSource.id],
      headings: [],
      markup: {
        collected: false,
        jsonLdBlocks: 0,
        invalidJsonLd: 0,
        jsonLdTypes: [],
        microdataTypes: [],
        rdfaTypes: [],
      },
      sampled: true,
    },
  ],
  scope: { pages: 2, sources: 6, sampled: true },
  verification: { checked: 4, retained: 3, withheld: 1 },
  assessmentValidation: { summaryWithheld: false, withheldCriteria: [] },
  unassessed: [...AI_VISIBILITY_UNASSESSED],
};
export const lowIssue: Issue = {
  title: "Describe the rye loaf more specifically",
  detail:
    "The introduction names rye loaves without an ingredient description. Add verified product detail relevant to a visitor choosing bread.",
  priority: "Low",
  aiCriterion: "answers",
  evidenceType: "ai-observation",
  evidence: source.text,
  pageUrl: source.pageUrl,
  aiEvidence: [source],
  fixSteps: [
    {
      title: "Confirm the ingredient description",
      description:
        "Ask the bakery team for the accurate ingredients before publishing.",
    },
    {
      title: "Add the confirmed wording",
      description: "Describe the rye loaf using only those confirmed details.",
    },
  ],
};
export const highIssue: Issue = {
  ...lowIssue,
  title: "Clarify the collection context",
  priority: "High",
  aiCriterion: "identity",
  detail:
    "Consider clarifying the page-specific collection context using only the bakery's verified details.",
  fixSteps: [
    {
      title: "Confirm the current collection arrangements",
      description:
        "Check the collection day and location with the bakery team.",
    },
    {
      title: "Put collection details beside the offer",
      description:
        "Use the confirmed details where visitors choose their bread.",
    },
  ],
};
export const analysis: AEOAnalysis = {
  overallScore: 80,
  structuredDataScore: null,
  contentReadabilityScore: null,
  entityCoverageScore: null,
  faqPresenceScore: null,
  schemaMarkupTypes: ["Bakery"],
  review,
  issues: [lowIssue, highIssue],
};
