import { dashboardFixture, url } from "./dashboard-fixtures";
import type { Issue } from "../src/lib/types";
import type { CopySource } from "../src/lib/messaging";
import type { SEOSource } from "../src/lib/seo";
import type { ConversionSource } from "../src/lib/conversion";
import { MESSAGING_CRITERIA } from "../src/lib/messaging";
import { SEO_CRITERIA } from "../src/lib/seo";
import { CONVERSION_CRITERIA } from "../src/lib/conversion";

/** Illustrative test data only. Never imported by the application or API routes. */
export function specialistFixture() {
  const report = dashboardFixture();
  report.analysisId = "specialist-ui-fixture";
  const copy: CopySource = {
    id: "copy-main",
    pageUrl: url,
    kind: "body copy",
    region: "main",
    quote:
      "Sourdough bread for Saturday collection in Bath. Choose your loaf and collect between 9am and 12pm.",
  };
  const heading: CopySource = {
    ...copy,
    id: "copy-heading",
    kind: "heading",
    quote: "Bread your way.",
  };
  const metadata: SEOSource = {
    id: "seo-metadata",
    pageUrl: url,
    kind: "metadata",
    label: "Titles and meta descriptions",
    observation: JSON.stringify({
      titles: ["Acorn Bakery · Sourdough in Bath"],
      descriptions: ["Freshly baked sourdough bread, made slowly in Bath."],
      language: "en",
    }),
  };
  const canonical: SEOSource = {
    id: "seo-canonical",
    pageUrl: url,
    kind: "canonical",
    label: "Canonical declaration",
    observation: JSON.stringify({
      declarations: [{ href: url, resolved: url, method: "HTML" }],
      headersChecked: true,
    }),
  };
  const action: ConversionSource = {
    id: "conversion-link",
    pageUrl: url,
    kind: "link",
    location: "main · collection link",
    observation: JSON.stringify({
      name: "Explore",
      destination: `${url}collection`,
      href: "/collection",
      nameFrom: "element content",
    }),
  };
  const form: ConversionSource = {
    id: "conversion-form",
    pageUrl: url,
    kind: "form",
    location: "collection enquiry",
    observation: JSON.stringify({
      name: "Collection enquiry",
      editableQuestions: 2,
      requiredQuestions: 1,
      fieldLabels: [{ name: "Email" }, { name: "Your question" }],
      action: "current page or script-controlled",
    }),
  };
  const issue = (
    title: string,
    priority: Issue["priority"],
    detail: string,
  ): Issue => ({
    title,
    priority,
    detail,
    pageUrl: url,
    fixSteps: [
      {
        title: "Make a focused change",
        description:
          "Update the affected wording using the collected collection details. Keep the offer and opening times accurate.",
      },
      {
        title: "Review it on the page",
        description:
          "Read the wording in context and test the affected action with a keyboard and on mobile.",
      },
    ],
  });
  report.messaging = [
    {
      ...issue(
        "Make the collection offer clear in your headline",
        "High",
        "The headline “Bread your way” does not identify the Saturday collection offer described in the supporting copy.",
      ),
      messagingCriterion: "clarity",
      messagingEvidence: [heading, copy],
      evidence: heading.quote,
      copySuggestion: {
        original: heading.quote,
        replacement: "Sourdough for your Saturday. Baked in Bath.",
        sources: [copy],
      },
    },
    {
      ...issue(
        "Name the destination in your action label",
        "Medium",
        "The action label “Explore” gives less context than the collection route it links to.",
      ),
      messagingCriterion: "audience",
      messagingEvidence: [
        {
          ...copy,
          id: "copy-action",
          kind: "action label",
          quote: "Explore",
          destination: `${url}collection`,
        },
      ],
      evidence: "Explore",
      copySuggestion: {
        original: "Explore",
        replacement: "Choose your Saturday loaf",
        sources: [copy],
      },
    },
    {
      ...issue(
        "Keep collection details together",
        "Low",
        "The collection window in the supporting copy can be kept close to the next action when the wording is revised.",
      ),
      messagingCriterion: "consistency",
      messagingEvidence: [copy],
      evidence: copy.quote,
    },
  ];
  report.messagingAnalysis = {
    method: "copy-evidence-review-v1",
    summary:
      "The supporting copy explains what you offer and when to collect it. Bring that specificity into the headline and next action.",
    summarySources: [copy],
    criteria: MESSAGING_CRITERIA.map((rubric, index) => ({
      key: rubric.key,
      score: [68, 74, 85, 78][index],
      reason:
        "Supporting wording identifies the bread, location and collection window; the headline and action use broader language.",
      sources: [copy, heading],
    })),
    strengths: [
      {
        text: "The supporting sentence names the location and collection window.",
        source: copy,
      },
    ],
    scope: { pages: 1, blocks: 18, truncated: false },
    verification: { checked: 3, retained: 3, withheld: 0 },
  };
  report.seo = [
    {
      ...issue(
        "Add collection context to the page description",
        "Medium",
        "The collected description names sourdough and Bath. Adding the accurate Saturday collection context is a page-specific wording improvement to consider.",
      ),
      seoCriterion: "metadata",
      seoEvidence: [metadata],
      evidenceType: "seo-observation",
    },
    {
      ...issue(
        "Confirm the intended canonical preference",
        "Low",
        "The collected canonical points to this page. Confirm that this is the preferred URL before changing related page declarations.",
      ),
      seoCriterion: "discovery",
      seoEvidence: [canonical],
      evidenceType: "seo-observation",
    },
  ];
  report.seoAnalysis = {
    method: "page-seo-review-v1",
    summary:
      "The page has a specific title and a canonical preference. Review the description in context; actual search indexing and rankings were not tested.",
    summarySources: [metadata, canonical],
    criteria: SEO_CRITERIA.map((rubric, index) => ({
      key: rubric.key,
      score: [72, 85, 80, null][index],
      reason:
        "Collected titles, metadata and page structure support a limited on-page review.",
      sources: [metadata],
    })),
    strengths: [
      {
        text: "The title identifies the bakery offering and location.",
        sources: [metadata],
      },
    ],
    evidence: [metadata, canonical],
    pages: [
      {
        url,
        titles: ["Acorn Bakery · Sourdough in Bath"],
        descriptions: ["Freshly baked sourdough bread, made slowly in Bath."],
        canonicals: [{ href: url, resolved: url, method: "HTML" }],
        directives: [],
        headersChecked: true,
        responseStatus: 200,
        headings: [
          { level: 1, text: "Bread your way." },
          { level: 2, text: "Saturday collection" },
        ],
        internalLinks: [{ text: "Explore", url: `${url}collection` }],
        structured: {
          jsonLdBlocks: 0,
          invalidJsonLd: 0,
          jsonLdTypes: [],
          microdataTypes: [],
          rdfaTypes: [],
        },
        content: [copy.quote],
        language: "en",
        truncated: false,
      },
    ],
    checks: [
      {
        id: "canonical-check",
        key: "discovery",
        label: "Canonical declaration",
        pageUrl: url,
        status: "observed",
        detail:
          "One canonical preference was collected. Search-engine selection was not tested.",
        sourceIds: [canonical.id],
      },
    ],
    scope: { pages: 1, sources: 2, headersChecked: 1, truncated: false },
    verification: { checked: 2, retained: 2, withheld: 0 },
    unassessed: [
      "Actual search rankings and indexing",
      "Rich-result eligibility and full-domain crawling",
    ],
  };
  report.conversion = [
    {
      ...issue(
        "Make the collection action easier to recognize",
        "High",
        "The collected “Explore” link points to the collection route. A more specific label could make that next step clearer; visitor behavior still needs testing.",
      ),
      conversionCriterion: "actions",
      conversionEvidence: [action],
      evidenceType: "conversion-observation",
    },
    {
      ...issue(
        "Review expectations around the enquiry form",
        "Medium",
        "The collected form contains an email question and an enquiry field. Check the surrounding wording in context before changing what visitors are asked to provide.",
      ),
      conversionCriterion: "expectations",
      conversionEvidence: [form],
      evidenceType: "conversion-observation",
    },
  ];
  report.conversionAnalysis = {
    method: "conversion-evidence-review-v1",
    summary:
      "A collection route and an enquiry form are present in the collected HTML. Clearer labels are practical hypotheses to validate with visitors.",
    summarySources: [action],
    goal: {
      text: "Choose a loaf for Saturday collection or ask about an order.",
      sources: [
        {
          ...action,
          id: "goal-copy",
          kind: "copy",
          observation: JSON.stringify({ text: copy.quote, region: "main" }),
        },
      ],
    },
    criteria: CONVERSION_CRITERIA.map((rubric, index) => ({
      key: rubric.key,
      score: [65, 78, null, 72][index],
      reason:
        "The collected action and collection wording support a limited review of next-step clarity.",
      sources: [action],
    })),
    actions: [action],
    forms: [form],
    evidence: [action, form],
    strengths: [
      {
        text: "The collection link declares a same-site destination in the HTML.",
        sources: [action],
      },
    ],
    scope: { pages: 1, sources: 2, controls: 1, forms: 1, truncated: false },
    verification: { checked: 2, retained: 2, withheld: 0 },
    unassessed: [
      "Actual clicks, successful submissions and conversion performance",
    ],
  };
  report.quickWins = [
    {
      id: "qw-headline",
      action: "Make the headline specific to Saturday collection",
      impact: "May help readers identify the offer sooner.",
      effort: "Low",
      category: "messaging",
      pageUrl: url,
      relatedIssue: report.messaging[0],
      messagingEvidence: [heading, copy],
    },
    {
      id: "qw-description",
      action: "Review the page description in its collection context",
      impact:
        "May give search engines a more specific page summary to consider.",
      effort: "Low",
      category: "seo",
      pageUrl: url,
      relatedIssue: report.seo[0],
      seoEvidence: [metadata],
    },
    {
      id: "qw-action",
      action: "Replace the broad collection action label",
      impact:
        "May clarify what visitors will find at the collection destination.",
      effort: "Medium",
      category: "conversion",
      pageUrl: url,
      relatedIssue: report.conversion[0],
      conversionEvidence: [action],
    },
  ];
  report.quickWinsSelection = {
    method: "verified-shortlist-v1",
    reviewed: 3,
    retained: 3,
    highEffortExcluded: 0,
    unlinkedExcluded: 0,
    unsupportedExcluded: 0,
    duplicatesExcluded: 0,
    overflowExcluded: 0,
  };
  report.topIssues = report.messaging.slice(0, 1);
  return report;
}
