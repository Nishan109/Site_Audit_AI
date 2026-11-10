import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import type { AEOAnalysis } from "../src/lib/types";
import { aiVisibilityPlan } from "../src/lib/ai-visibility-presentation";
import { dashboardModel } from "../src/lib/dashboard";
import { reviewIssues } from "../src/lib/review-workspace";
import { dashboardFixture } from "./dashboard-fixtures";
import {
  analysis,
  review,
  source,
  markup,
  lowIssue,
  highIssue,
  otherSource,
} from "./ai-visibility-fixtures";
let Section: typeof import("../src/components/AIVisibilitySection").default;
let Observations: typeof import("../src/components/AIVisibilityEvidence").AIVisibilityObservations;
let TabPanel: typeof import("../src/components/TabPanel").default;
let PrintReport: typeof import("../src/components/PrintReport").default;
before(async () => {
  Section = (await import("../src/components/AIVisibilitySection")).default;
  Observations = (await import("../src/components/AIVisibilityEvidence"))
    .AIVisibilityObservations;
  TabPanel = (await import("../src/components/TabPanel")).default;
  PrintReport = (await import("../src/components/PrintReport")).default;
});
afterEach(cleanup);
const collectedPages = review.pages.map(({ url, title }) => ({
  url,
  title,
  fetchedAt: "2026-11-07T10:00:00Z",
}));
const mount = (
  data: AEOAnalysis | undefined = analysis,
  pages = collectedPages,
) =>
  render(
    createElement(Section, {
      analysis: data,
      url: source.pageUrl,
      collectedPages: pages,
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );

test("AI visibility shows cited content readiness, actual measurement limits and an unscored criterion", () => {
  const view = mount();
  assert.equal(
    view
      .getByRole("meter", { name: "Content readiness" })
      .getAttribute("aria-valuenow"),
    "80",
  );
  assert.equal(
    view.queryByRole("meter", {
      name: "Attribution & supporting detail assessment",
    }),
    null,
  );
  assert.ok(view.getAllByText("Not assessed").length);
  assert.ok(
    view.getByText("Live AI appearances and citations were not measured"),
  );
  assert.ok(view.getByRole("heading", { name: highIssue.title }));
  assert.equal(view.queryByText("FAQ Presence"), null);
  assert.equal(view.queryByText("Structured Data Score"), null);
});

test("the page selector switches real excerpts and markup observations without carrying over another page's types", () => {
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Page evidence" }));
  const evidence = within(view.getByRole("region", { name: "Page evidence" }));
  assert.ok(view.getByRole("heading", { name: "Acorn Bakery in Bath" }));
  assert.ok(evidence.getAllByText("Bakery").length);
  fireEvent.click(
    evidence.getByRole("button", { name: "Show all 4 collected excerpts" }),
  );
  assert.ok(evidence.getByText("Additional bakery excerpt 3."));
  fireEvent.change(
    evidence.getByRole("combobox", { name: "Page to inspect" }),
    { target: { value: otherSource.pageUrl } },
  );
  assert.ok(view.getByRole("heading", { name: "About the Acorn team" }));
  assert.ok(view.getAllByText(otherSource.text).length);
  assert.equal(evidence.queryAllByText("Bakery").length, 0);
  assert.ok(evidence.getByText("Not collected for this page."));
  assert.equal(evidence.queryByText("JSON-LD blocks"), null);
  assert.equal(
    view.queryByRole("heading", { name: "Acorn Bakery in Bath" }),
    null,
  );
});

test("findings prioritize concrete issues, filter by area and expose the existing implementation plan", () => {
  const view = mount();
  assert.ok(view.getByRole("heading", { name: highIssue.title }));
  assert.equal(view.queryByRole("heading", { name: lowIssue.title }), null);
  fireEvent.change(view.getByLabelText("Readiness criterion"), {
    target: { value: "answers" },
  });
  assert.equal(view.queryByRole("heading", { name: highIssue.title }), null);
  assert.ok(view.getByRole("heading", { name: lowIssue.title }));
  assert.ok(view.getByText("1 of 2 findings match these filters"));
  fireEvent.click(view.getByText("How to check it"));
  assert.ok(view.getByRole("heading", { name: lowIssue.fixSteps![0].title }));
  assert.ok(view.getByText(/Verify every new factual claim before publishing/));
});

test("copy exports every finding and source, even while one area is filtered out", async () => {
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
  fireEvent.change(view.getByLabelText("Readiness criterion"), {
    target: { value: "answers" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy readiness plan" }));
  });
  for (const value of [
    lowIssue.title,
    highIssue.title,
    source.pageUrl,
    source.text,
    "Live AI appearances, citations and crawler access were not measured",
    "NOT MEASURED",
  ])
    assert.ok(copied.includes(value), value);
  assert.ok(view.getByText(/Readiness plan copied/));
});

test("download uses the real plan and a clipboard failure offers an alternative without claiming success", async (t) => {
  let blob: Blob | undefined;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  t.mock.method(URL, "createObjectURL", (value: Blob | MediaSource) => {
    blob = value as Blob;
    return "blob:readiness";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "bakery.example-ai-content-readiness.txt");
    },
  );
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy readiness plan" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  assert.equal(view.queryByText(/has been copied/), null);
  fireEvent.click(
    view.getByRole("button", { name: "Download readiness plan (.txt)" }),
  );
  const text = await blob!.text();
  assert.ok(text.includes(lowIssue.title));
  assert.ok(text.includes(source.text));
  assert.ok(text.includes("NOT MEASURED"));
});

test("entirely unassessed content has no invented zero score and discloses withheld assessments", () => {
  const view = mount({
    ...analysis,
    overallScore: null,
    review: {
      ...review,
      criteria: review.criteria.map((item) => ({ ...item, score: null })),
      assessmentValidation: {
        summaryWithheld: true,
        withheldCriteria: ["answers", "identity", "support", "structure"],
      },
    },
  });
  assert.equal(view.queryByRole("meter", { name: "Content readiness" }), null);
  assert.ok(view.getByText(/0 of 4 areas assessed/));
  assert.ok(
    view.getByText(/Some explanations could not be verified and were withheld/),
  );
  assert.ok(view.getByRole("heading", { name: highIssue.title }));
});

test("earlier reports suppress speculative FAQ and schema scores and request a new evidence review", () => {
  const view = mount({
    ...analysis,
    review: undefined,
    structuredDataScore: 94,
    faqPresenceScore: 12,
  });
  assert.ok(view.getByText(/Use Run again above/));
  assert.equal(view.queryByRole("meter"), null);
  assert.equal(view.queryByText("94"), null);
  assert.equal(view.queryByText("12"), null);
});

test("copy evidence is a real quotation; markup observations are readable values rather than fabricated page quotations", () => {
  const view = render(
    createElement(Observations, { sources: [source, markup] }),
  );
  const quotes = view.container.querySelectorAll("blockquote");
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].textContent, source.text);
  assert.ok(view.getByText("JSON-LD types"));
  assert.ok(view.getByText("Bakery"));
  assert.ok(view.getByText(/claims have not been independently verified/i));
});

test("a plan with no supported findings still includes strengths, scoped assessments and collected observations", () => {
  const text = aiVisibilityPlan(review, [], source.pageUrl);
  for (const value of [
    "No supported content improvements",
    "STRENGTHS TO PRESERVE",
    "OBSERVED PAGE EVIDENCE",
    "COLLECTED EVIDENCE",
    source.text,
    "Markup inventory: Not collected",
    "NOT MEASURED",
  ])
    assert.ok(text.includes(value), value);
});

test("same-title findings link to an exact query page and return with the correct page filter", () => {
  const archive = `${source.pageUrl}?edition=archive`;
  const sparse = `${source.pageUrl}hours`;
  const alternate = {
    ...source,
    pageUrl: archive,
    text: "Recorded wording for the archive edition.",
  };
  const issues = [
    highIssue,
    {
      ...lowIssue,
      title: highIssue.title,
      pageUrl: archive,
      aiEvidence: [alternate],
    },
  ];
  const data = {
    ...analysis,
    issues,
    review: {
      ...review,
      evidence: [...review.evidence, alternate],
      pages: [
        ...review.pages,
        { ...review.pages[1], url: archive, title: "Archive edition" },
      ],
    },
  };
  const pages = [
    collectedPages[0],
    { ...collectedPages[0], url: archive },
    { ...collectedPages[0], url: sparse },
  ];
  const [, second] = reviewIssues(issues);
  const steps = {
    [second.key]: [
      {
        title: "Archive-specific fix",
        description: "Check the archived wording.",
      },
    ],
  };
  const view = render(
    createElement(Section, {
      analysis: data,
      url: source.pageUrl,
      collectedPages: pages,
      generatedFixSteps: steps,
      onFixStepsLoaded: () => {},
    }),
  );
  fireEvent.change(view.getByLabelText("Select a finding"), {
    target: { value: second.key },
  });
  assert.ok(view.getByRole("heading", { name: "Archive-specific fix" }));
  fireEvent.click(view.getByRole("button", { name: "Inspect source page" }));
  const inspector = within(view.getByRole("region", { name: "Page evidence" }));
  const picker = inspector.getByRole("combobox", {
    name: "Page to inspect",
  }) as HTMLSelectElement;
  assert.equal(picker.value, archive);
  assert.equal(document.activeElement?.textContent, "Page evidence");
  assert.ok(inspector.getByText(alternate.text));
  assert.equal(inspector.queryByText(source.text), null);
  fireEvent.click(
    inspector.getByRole("button", { name: "View findings for this page" }),
  );
  assert.equal(
    (view.getByLabelText("Finding source page") as HTMLSelectElement).value,
    archive,
  );
  assert.ok(view.getByText("1 of 2 findings match these filters"));
  assert.equal(document.activeElement?.textContent, "Supported findings");
  fireEvent.click(view.getByRole("button", { name: "Page evidence" }));
  fireEvent.change(picker, { target: { value: sparse } });
  assert.ok(
    inspector.getByText("No readable wording was collected for this page."),
  );
  fireEvent.click(
    inspector.getByRole("button", { name: "View findings for this page" }),
  );
  assert.ok(view.getByText("No supported findings for this page"));
  const plan = aiVisibilityPlan(
    data.review,
    issues,
    source.pageUrl,
    steps,
    pages,
  );
  assert.ok(plan.includes(`${source.id} · ${source.pageUrl}`));
  assert.ok(plan.includes(`${source.id} · ${archive}`));
  assert.ok(plan.includes("Archive-specific fix"));
});

test("withheld and invalid numeric rows stay out of the dashboard, workspace and zero-finding print", () => {
  const report = dashboardFixture();
  const first = review.criteria[0];
  const invalidUrl = { ...source, pageUrl: "javascript:alert(1)" };
  const saved = {
    ...review,
    summary: "Unverified summary",
    assessmentValidation: {
      summaryWithheld: true,
      withheldCriteria: ["identity" as const],
    },
    criteria: [
      { ...first, score: 100, sources: [invalidUrl], reason: "Invalid source" },
      { ...first, score: 0 },
      { ...first, score: 95, reason: "Duplicate numeric row" },
      {
        ...first,
        key: "identity" as const,
        score: 90,
        reason: "Withheld numeric row",
      },
      {
        ...first,
        key: "support" as const,
        score: 70,
        sources: [markup],
        reason: "Markup-only score",
      },
      {
        ...first,
        key: "structure" as const,
        score: 60,
        reason: null as unknown as string,
      },
    ],
  };
  report.aeoAnalysis = { ...analysis, issues: [], review: saved };
  const dashboard = dashboardModel(report);
  const category = dashboard.categories.find(({ key }) => key === "aeo")!;
  assert.equal(category.score, 0);
  assert.equal(category.assessed, 1);
  const view = mount(report.aeoAnalysis, dashboard.pages);
  assert.equal(
    view
      .getByRole("meter", { name: "Content readiness" })
      .getAttribute("aria-valuenow"),
    "0",
  );
  assert.ok(view.getByText("No supported content findings in this report"));
  const plan = aiVisibilityPlan(saved, [], report.url, {}, dashboard.pages);
  assert.match(
    plan,
    /Content-readiness score: 0\/100\n1 of 4 criteria assessed/,
  );
  assert.doesNotMatch(
    plan,
    /Unverified summary|Invalid source|Duplicate numeric row|Withheld numeric row|Markup-only score/,
  );
  const printable = render(
    createElement(PrintReport, { result: report, generatedFixSteps: {} }),
  );
  assert.ok(
    [...printable.container.querySelectorAll("pre")].some(
      (item) => item.textContent === plan,
    ),
  );
});

test("report navigation retains the AI visibility selection and a new report resets it", () => {
  const result = dashboardFixture();
  result.aeoAnalysis = structuredClone(analysis);
  result.pagesAnalyzed!.push({
    ...result.pagesAnalyzed![0],
    url: otherSource.pageUrl,
  });
  const props = { result, generatedFixSteps: {}, onFixStepsLoaded: () => {} };
  const view = render(createElement(TabPanel, { ...props, activeTab: "aeo" }));
  const root = within(
    view.container.querySelector<HTMLElement>('[data-review-workspace="aeo"]')!,
  );
  fireEvent.change(root.getByLabelText("Readiness criterion"), {
    target: { value: "identity" },
  });
  fireEvent.click(root.getByRole("button", { name: "Page evidence" }));
  fireEvent.change(root.getByLabelText("Page to inspect"), {
    target: { value: otherSource.pageUrl },
  });
  view.rerender(createElement(TabPanel, { ...props, activeTab: "conversion" }));
  view.rerender(createElement(TabPanel, { ...props, activeTab: "aeo" }));
  assert.equal(
    (root.getByLabelText("Page to inspect") as HTMLSelectElement).value,
    otherSource.pageUrl,
  );
  assert.equal(
    (root.getByLabelText("Readiness criterion") as HTMLSelectElement).value,
    "identity",
  );
  view.rerender(
    createElement(TabPanel, {
      ...props,
      result: { ...result, analysisId: "new-audit" },
      activeTab: "aeo",
    }),
  );
  const fresh = within(
    view.container.querySelector<HTMLElement>('[data-review-workspace="aeo"]')!,
  );
  assert.equal(
    fresh
      .getByRole("button", { name: "Page evidence" })
      .getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(
    (fresh.getByLabelText("Readiness criterion") as HTMLSelectElement).value,
    "",
  );
});

test("saved observations keep malformed technical data readable and unsafe pages inert", () => {
  const view = render(
    createElement(Observations, {
      sources: [
        {
          ...markup,
          text: "Saved markup observation",
          pageUrl: "javascript:alert(1)",
        },
      ],
    }),
  );
  assert.ok(view.getByText("Saved markup observation"));
  assert.ok(view.getByText("Source page unavailable"));
  assert.equal(view.queryByRole("link"), null);
});
