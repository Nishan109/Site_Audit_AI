import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import {
  SEO_CRITERIA,
  type SEOAnalysis,
  type SEOPage,
  type SEOSource,
} from "../src/lib/seo";
import type { Issue } from "../src/lib/types";
import { seoObservationRows, seoPlan } from "../src/lib/seo-presentation";
import { dashboardModel } from "../src/lib/dashboard";
import { specialistFixture } from "./review-workspace-fixtures";
let Section: typeof import("../src/components/SEOSection").default;
let IssueCard: typeof import("../src/components/IssueCard").default;
let PrintReport: typeof import("../src/components/PrintReport").default;
before(async () => {
  Section = (await import("../src/components/SEOSection")).default;
  IssueCard = (await import("../src/components/IssueCard")).default;
  PrintReport = (await import("../src/components/PrintReport")).default;
});
afterEach(cleanup);
const page: SEOPage = {
  url: "https://bakery.example/",
  titles: ["Acorn Bakery in Bath"],
  descriptions: [
    "Sourdough bread and rye loaves for Saturday collection in Bath.",
  ],
  canonicals: [
    { href: "/", resolved: "https://bakery.example/", method: "HTML" },
  ],
  directives: [],
  headersChecked: true,
  responseStatus: 200,
  headings: [{ level: 1, text: "Sourdough collection" }],
  internalLinks: [],
  structured: {
    jsonLdBlocks: 0,
    invalidJsonLd: 0,
    jsonLdTypes: [],
    microdataTypes: [],
    rdfaTypes: [],
  },
  content: ["Saturday collection at Acorn Bakery in Bath."],
  language: "en",
  truncated: false,
};
const second: SEOPage = {
  ...page,
  url: "https://bakery.example/about",
  titles: ["About Acorn Bakery"],
  descriptions: [],
  headersChecked: false,
  responseStatus: null,
};
const metadata: SEOSource = {
  id: "S1-E1",
  pageUrl: page.url,
  kind: "metadata",
  label: "Titles and meta descriptions",
  observation: JSON.stringify({
    titles: page.titles,
    descriptions: page.descriptions,
  }),
};
const canonical: SEOSource = {
  id: "S1-E2",
  pageUrl: page.url,
  kind: "canonical",
  label: "Canonical declarations",
  observation: JSON.stringify({
    declarations: page.canonicals,
    headersChecked: true,
  }),
};
const analysis: SEOAnalysis = {
  method: "page-seo-review-v1",
  summary:
    "The collected bakery pages have specific titles and canonical signals; actual search indexing was not tested.",
  summarySources: [metadata],
  criteria: SEO_CRITERIA.map(({ key }) => ({
    key,
    score: key === "structured" ? null : 80,
    reason:
      key === "structured"
        ? "No structured data was collected for this limited syntax review."
        : "The collected metadata supports this limited on-page assessment.",
    sources: [key === "discovery" ? canonical : metadata],
  })),
  strengths: [
    {
      text: "The page title identifies the bakery and its location.",
      sources: [metadata],
    },
  ],
  pages: [page, second],
  evidence: [metadata, canonical],
  checks: [
    {
      id: "canonical-1",
      key: "discovery",
      label: "Canonical declaration",
      pageUrl: page.url,
      status: "observed",
      detail:
        "A canonical preference was observed; Google's selected canonical was not checked.",
      sourceIds: [canonical.id],
    },
  ],
  scope: { pages: 2, sources: 14, headersChecked: 1, truncated: false },
  verification: { checked: 4, retained: 3, withheld: 1 },
  unassessed: [
    "Actual search rankings and indexing",
    "Rich-result eligibility and full-domain crawling",
  ],
};
const metadataIssue: Issue = {
  title: "Clarify the bakery page summary",
  priority: "High",
  detail:
    "The description could state the specific collection context more clearly.",
  pageUrl: page.url,
  evidenceType: "seo-observation",
  evidence: metadata.observation,
  seoCriterion: "metadata",
  seoEvidence: [metadata],
  fixSteps: [
    {
      title: "Review the description",
      description:
        "Use a factual page-specific summary of the actual offering.",
    },
    {
      title: "Inspect the resulting HTML",
      description: "Confirm the published description matches the page.",
    },
  ],
};
const otherIssue: Issue = {
  ...metadataIssue,
  title: "Confirm the intended canonical target",
  priority: "Low",
  seoCriterion: "discovery",
  seoEvidence: [canonical],
};
const mount = (
  issues = [otherIssue, metadataIssue],
  review: SEOAnalysis = analysis,
) =>
  render(
    createElement(Section, {
      analysis: review,
      issues,
      url: page.url,
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );

test("SEO shows a scoped score, unassessed structured data and a clearly illustrative search listing", () => {
  const view = mount();
  fireEvent.click(
    view.getByRole("button", { name: "Page signals" }),
  );
  assert.ok(view.getByText("Illustrative search listing"));
  assert.ok(view.getByText(/Google may choose different wording/));
  assert.ok(view.getByText("Not assessed"));
  assert.ok(view.getByText(/Counts are informational/));
  assert.equal(
    view
      .getByRole("meter", { name: "On-page SEO assessment" })
      .getAttribute("aria-valuenow"),
    "80",
  );
  assert.equal(
    view.queryByRole("meter", { name: "Structured data assessment" }),
    null,
  );
  assert.equal(view.queryByText("Passed"), null);
});

test("page selector updates the real title/description and preserves missing-header limits", () => {
  const view = mount();
  fireEvent.click(
    view.getByRole("button", { name: "Page signals" }),
  );
  assert.ok(view.getByRole("heading", { name: page.titles[0] }));
  fireEvent.change(
    view.getByRole("combobox", { name: "SEO page to inspect" }),
    { target: { value: second.url } },
  );
  assert.ok(view.getByRole("heading", { name: second.titles[0] }));
  assert.ok(view.getByText(/No meta description was collected/));
  fireEvent.click(view.getByText("Canonical & directives", { exact: true }));
  assert.ok(view.getByText("HTTP status"));
  assert.ok(view.getAllByText("Response headers").length);
  assert.ok(view.getAllByText("Not collected").length >= 2);
  assert.equal(view.queryByRole("heading", { name: page.titles[0] }), null);
});

test("SEO filters findings by their retained area and keeps highest priorities first", () => {
  const view = mount();
  assert.ok(view.getByRole("heading", { name: metadataIssue.title }));
  const queue = view.getAllByRole("button", { name: /^Select SEO finding/ });
  assert.ok(queue[0].textContent?.includes(metadataIssue.title));
  assert.ok(queue[1].textContent?.includes(otherIssue.title));
  fireEvent.change(view.getByLabelText("SEO finding focus area"), {
    target: { value: "metadata" },
  });
  assert.ok(view.getByRole("heading", { name: metadataIssue.title }));
  assert.equal(view.queryByRole("heading", { name: otherIssue.title }), null);
  assert.ok(view.getByText(/1 of 2 findings match these filters/));
});

test("SEO evidence is an observation with readable values, not a fabricated website quotation", () => {
  const view = render(
    createElement(IssueCard, { issue: metadataIssue, url: page.url, index: 0 }),
  );
  fireEvent.click(view.getByText("View SEO evidence"));
  assert.equal(view.container.querySelector("blockquote"), null);
  assert.ok(view.getByText("Title elements"));
  assert.ok(view.getByText(page.titles[0]));
});

test("copy plan includes filtered-out issues, real observations and untested limits", async () => {
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  const view = mount();
  fireEvent.change(view.getByLabelText("SEO finding focus area"), {
    target: { value: "metadata" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy SEO plan" }));
  });
  for (const text of [
    metadataIssue.title,
    otherIssue.title,
    page.url,
    "Actual search rankings and indexing",
    "not a search-ranking, indexing or rich-result eligibility measurement",
  ])
    assert.ok(copied.includes(text));
});

test("SEO download contains the actual plan and copy denial does not report false success", async (t) => {
  let exported: Blob | undefined;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    exported = blob as Blob;
    return "blob:seo-plan";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "bakery.example-seo-action-plan.txt");
    },
  );
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy SEO plan" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  fireEvent.click(
    view.getByRole("button", { name: "Download SEO plan (.txt)" }),
  );
  const text = await exported!.text();
  assert.ok(text.includes(metadataIssue.title));
  assert.ok(text.includes("NOT TESTED"));
});

test("a plan with no findings still exports strengths, collected metadata and factual page checks", () => {
  const plan = seoPlan(analysis, [], page.url);
  for (const value of [
    "No supported on-page fixes",
    "STRENGTHS TO PRESERVE",
    "OBSERVED PAGE SIGNALS",
    "SUPPORTING OBSERVATIONS",
    page.titles[0],
    page.descriptions[0],
    canonical.pageUrl,
    "Actual search rankings and indexing",
  ])
    assert.ok(plan.includes(value));
});

test("an unverified assessment stays unscored while verified findings and its limitation remain visible and exportable", () => {
  const partial: SEOAnalysis = {
    ...analysis,
    assessmentValidation: {
      reassessed: true,
      summaryWithheld: false,
      withheldCriteria: ["metadata"],
    },
    criteria: analysis.criteria.map((item) =>
      item.key === "metadata"
        ? {
            ...item,
            score: null,
            reason:
              "This area's AI explanation could not be verified against the collected evidence. No numeric score is included.",
          }
        : { ...item, score: item.score === null ? null : 70 },
    ),
  };
  const view = mount(undefined, partial);
  assert.ok(
    view
      .getAllByRole("status")
      .some((status) =>
        status.textContent?.includes("only verified areas contribute"),
      ),
  );
  assert.equal(
    view.queryByRole("meter", { name: "Titles & descriptions assessment" }),
    null,
  );
  assert.equal(
    view
      .getByRole("meter", { name: "On-page SEO assessment" })
      .getAttribute("aria-valuenow"),
    "70",
  );
  assert.ok(view.getByRole("heading", { name: metadataIssue.title }));
  const plan = seoPlan(partial, [metadataIssue], page.url);
  assert.ok(plan.includes("Unverified explanations were withheld"));
  assert.ok(plan.includes("Titles & descriptions: Not assessed"));
  assert.ok(plan.includes("Qualitative on-page score: 70"));
  assert.ok(plan.includes(metadataIssue.title));
});

test("SEO cross-links preserve query variants and scope reused source IDs to the selected page", () => {
  const variant = {
    ...second,
    url: `${page.url}?edition=archive`,
    titles: ["Archive title", "Alternate archived title"],
  };
  const archiveSource = {
    ...canonical,
    pageUrl: variant.url,
    observation: "Archive-only supporting observation",
  };
  const primarySource = {
    ...canonical,
    observation: "Primary-only supporting observation",
  };
  const archiveIssue = {
    ...otherIssue,
    title: metadataIssue.title,
    pageUrl: variant.url,
    seoEvidence: [archiveSource],
  };
  const report = {
    ...analysis,
    pages: [page, variant],
    evidence: [metadata, primarySource, archiveSource],
    checks: [
      analysis.checks[0],
      { ...analysis.checks[0], pageUrl: variant.url },
    ],
  };
  const view = mount([metadataIssue, archiveIssue], report);
  fireEvent.click(
    view.getByRole("button", {
      name: `Select SEO finding 2: ${archiveIssue.title}`,
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Inspect source page" }));
  const signals = within(
    view.getByRole("region", { name: "Collected page signals" }),
  );
  assert.equal(
    (signals.getByLabelText("SEO page to inspect") as HTMLSelectElement).value,
    variant.url,
  );
  assert.ok(signals.getByRole("heading", { name: "Archive title" }));
  assert.match(
    signals.getByText(/Alternate archived title/).textContent || "",
    /Archive title/,
  );
  fireEvent.click(signals.getByText("Canonical & directives"));
  fireEvent.click(
    signals.getByText("Supporting observations", { exact: true }),
  );
  assert.ok(
    signals.getAllByText("Archive-only supporting observation").length > 0,
  );
  assert.equal(
    signals.queryByText("Primary-only supporting observation"),
    null,
  );
  fireEvent.click(
    signals.getByRole("button", { name: "View findings for this page" }),
  );
  assert.equal(
    (view.getByLabelText("SEO finding page") as HTMLSelectElement).value,
    variant.url,
  );
  assert.equal(
    view.getAllByRole("button", { name: /^Select SEO finding/ }).length,
    1,
  );
  assert.ok(view.getByText(/1 of 2 findings match these filters/));
  const plan = seoPlan(report, [metadataIssue, archiveIssue], page.url);
  assert.match(plan, /Primary-only supporting observation/);
  assert.match(plan, /Archive-only supporting observation/);
});

test("SEO print and text plans retain evidence while excluding withheld and duplicate scores", () => {
  const report = specialistFixture();
  const recorded = report.seoAnalysis!;
  const metadataCriterion = recorded.criteria.find(
    (item) => item.key === "metadata",
  )!;
  const discovery = recorded.criteria.find((item) => item.key === "discovery")!;
  recorded.summary = "Withheld summary text";
  recorded.assessmentValidation = {
    reassessed: true,
    summaryWithheld: true,
    withheldCriteria: ["discovery"],
  };
  discovery.reason = "Withheld discovery explanation";
  recorded.criteria = [
    metadataCriterion,
    {
      ...metadataCriterion,
      score: 300,
      reason: "Ineligible duplicate explanation",
    },
    discovery,
  ];
  report.seo = [];
  const plan = seoPlan(recorded, [], report.url, {}, [report.url]);
  assert.equal(
    dashboardModel(report).categories.find((item) => item.key === "seo")?.score,
    metadataCriterion.score,
  );
  assert.match(plan, /Canonical & indexing signals: Not assessed/);
  assert.doesNotMatch(
    plan,
    /Withheld summary text|Withheld discovery explanation|Ineligible duplicate explanation|300\/100/,
  );
  const view = render(
    createElement(PrintReport, { result: report, generatedFixSteps: {} }),
  );
  assert.ok(view.container.textContent?.includes(plan));
  assert.doesNotMatch(
    view.container.textContent || "",
    /Withheld summary text|Withheld discovery explanation/,
  );
});

test("malformed saved SEO observations can still be inspected and exported", () => {
  const malformed = { ...metadata, observation: "null" };
  assert.deepEqual(seoObservationRows(malformed), [
    { label: "Collected observation", value: "null" },
  ]);
  const issue = {
    ...metadataIssue,
    evidence: undefined,
    fixSteps: undefined,
    seoEvidence: [malformed],
  };
  const view = mount([issue], { ...analysis, pages: [], checks: [] });
  assert.ok(view.getByRole("heading", { name: issue.title }));
  assert.ok(view.getByRole("button", { name: "Generate action plan" }));
  assert.ok(view.getByText("Collected observation"));
  assert.match(
    seoPlan(analysis, [issue], page.url),
    /Collected observation: null/,
  );
});
