import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type {
  ConversionAnalysis,
  ConversionSource,
} from "../src/lib/conversion";
import { CONVERSION_CRITERIA } from "../src/lib/conversion";
import type { Issue } from "../src/lib/types";
import { conversionPlan } from "../src/lib/conversion-presentation";
import { reviewIssues } from "../src/lib/review-workspace";
import { specialistFixture } from "./review-workspace-fixtures";
import { dashboardModel } from "../src/lib/dashboard";
let Section: typeof import("../src/components/ConversionSection").default;
let IssueCard: typeof import("../src/components/IssueCard").default;
let PrintReport: typeof import("../src/components/PrintReport").default;
before(async () => {
  Section = (await import("../src/components/ConversionSection")).default;
  IssueCard = (await import("../src/components/IssueCard")).default;
  PrintReport = (await import("../src/components/PrintReport")).default;
});
afterEach(cleanup);
const url = "https://portfolio.example/";
const link: ConversionSource = {
  id: "C1-E2",
  pageUrl: url,
  kind: "link",
  location: "main · link 1",
  observation: JSON.stringify({
    name: "Explore projects",
    nameFrom: "element content",
    destination: `${url}projects`,
    href: "/projects",
  }),
};
const copy: ConversionSource = {
  id: "C1-E3",
  pageUrl: url,
  kind: "copy",
  location: "main · introduction",
  observation: JSON.stringify({
    text: "Ada builds reliable cloud infrastructure with Terraform.",
    region: "main",
  }),
};
const form: ConversionSource = {
  id: "C2-E1",
  pageUrl: `${url}contact`,
  kind: "form",
  location: "Form 1",
  observation: JSON.stringify({
    name: "Contact Ada",
    editableQuestions: 2,
    requiredQuestions: 1,
    fieldLabels: [{ name: "Email" }, { name: "Message" }],
    action: "current page or script-controlled",
  }),
};
const analysis: ConversionAnalysis = {
  method: "conversion-evidence-review-v1",
  summary:
    "The portfolio provides project exploration and a contact route; actual conversions were not measured.",
  summarySources: [copy, link],
  goal: {
    text: "Explore Ada’s work or contact Ada about an engineering role.",
    sources: [copy],
  },
  actions: [link],
  forms: [form],
  evidence: [link, copy, form],
  criteria: CONVERSION_CRITERIA.map(({ key }) => ({
    key,
    score: key === "forms" ? null : 80,
    reason:
      key === "forms"
        ? "The form area is not assessed in this test review."
        : "The collected page observations support a limited clarity assessment.",
    sources: [key === "actions" ? link : copy],
  })),
  strengths: [
    {
      text: "The project link clearly names its destination.",
      sources: [link],
    },
  ],
  scope: { pages: 2, controls: 1, forms: 1, sources: 3, truncated: true },
  verification: { checked: 5, retained: 4, withheld: 1 },
  unassessed: [
    "Actual clicks, successful submissions and conversion performance",
  ],
};
const actionIssue: Issue = {
  title: "Clarify the project action label",
  detail:
    "A clearer label is a hypothesis to validate against the existing project destination.",
  priority: "High",
  pageUrl: url,
  evidence: link.observation,
  evidenceType: "conversion-observation",
  conversionCriterion: "actions",
  conversionEvidence: [link],
  fixSteps: [
    {
      title: "Review the existing label",
      description: "Match the wording to the actual project destination.",
    },
    {
      title: "Test the affected route",
      description:
        "Confirm the destination works before publishing the change.",
    },
  ],
};
const decisionIssue: Issue = {
  ...actionIssue,
  title: "Explain the project decision context",
  priority: "Low",
  conversionCriterion: "decision",
  conversionEvidence: [copy],
};
const mount = (
  issues = [decisionIssue, actionIssue],
  report: ConversionAnalysis | undefined = analysis,
) =>
  render(
    createElement(Section, {
      analysis: report,
      issues,
      url,
      collectedPages: [url, form.pageUrl],
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );

test("conversion review shows a scoped clarity score and a hypothesis rather than a measured funnel", () => {
  const view = mount();
  assert.equal(
    view
      .getByRole("meter", { name: "Conversion clarity" })
      .getAttribute("aria-valuenow"),
    "80",
  );
  assert.ok(
    view.getByText("Clicks, submissions, and outcomes were not measured"),
  );
  assert.ok(view.getByText("Likely visitor goal"));
  assert.ok(view.getByText("Report-wide hypothesis"));
  assert.equal(
    view.queryByRole("meter", { name: "Form clarity assessment" }),
    null,
  );
});
test("action previews keep email drafts readable and reveal additional real entry points on request", () => {
  const email = {
    ...link,
    id: "C1-E4",
    observation: JSON.stringify({
      name: "Email Ada",
      destination: "mailto:ada@example.com?subject=Project&body=An%20enquiry",
    }),
  };
  const extra = {
    ...link,
    id: "C1-E5",
    observation: JSON.stringify({
      name: "Browse more projects",
      destination: `${url}more`,
    }),
  };
  const view = mount([], {
    ...analysis,
    actions: [link, email, { ...link, id: "C1-E6" }, extra],
  });
  fireEvent.click(view.getByRole("button", { name: "Actions & forms" }));
  assert.ok(view.getByText("Email ada@example.com · Pre-filled draft"));
  assert.equal(
    view.queryByRole("heading", { name: "Browse more projects" }),
    null,
  );
  fireEvent.click(view.getByRole("button", { name: "Show 1 more action" }));
  assert.ok(view.getByRole("heading", { name: "Browse more projects" }));
  fireEvent.click(view.getByRole("button", { name: "Show fewer actions" }));
  assert.equal(
    view.queryByRole("heading", { name: "Browse more projects" }),
    null,
  );
});
test("page selection shows only actual action and form observations for that page", () => {
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Actions & forms" }));
  assert.ok(view.getByRole("heading", { name: "Explore projects" }));
  assert.ok(view.getByText("No form was recorded in this page sample."));
  assert.ok(view.getByText("Not clicked"));
  fireEvent.change(view.getByRole("combobox", { name: "Page to inspect" }), {
    target: { value: form.pageUrl },
  });
  assert.equal(view.queryByRole("heading", { name: "Explore projects" }), null);
  assert.ok(view.getByRole("heading", { name: "Contact Ada" }));
  assert.ok(view.getByText("Editable questions"));
  assert.ok(view.getByText("No action was selected for review on this page."));
});
test("conversion area filters preserve priority order and source-backed issue identity", () => {
  const view = mount();
  assert.ok(view.getByRole("heading", { name: actionIssue.title }));
  assert.equal(
    view.queryByRole("heading", { name: decisionIssue.title }),
    null,
  );
  fireEvent.change(view.getByLabelText("Finding focus area"), {
    target: { value: "decision" },
  });
  assert.ok(view.getByRole("heading", { name: decisionIssue.title }));
  assert.equal(view.queryByRole("heading", { name: actionIssue.title }), null);
  assert.ok(view.getByText(/1 of 2 findings match these filters/));
});
test("finding details present recorded evidence, fix steps and manual validation separately", () => {
  const view = mount([actionIssue]);
  assert.ok(view.getByText(actionIssue.fixSteps![0].description));
  assert.ok(view.getByText("What the audit observed"));
  assert.ok(view.getByText("Suggested change"));
  assert.ok(view.getByText("How to validate"));
  assert.ok(view.getAllByText("Destination").length);
  assert.ok(view.getAllByText(`${url}projects`).length);
});
test("copy exports all findings despite the active filter, with sources and measurement limits", async () => {
  let text = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        text = value;
      },
    },
  });
  const view = mount();
  fireEvent.change(view.getByLabelText("Finding focus area"), {
    target: { value: "actions" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy Conversion plan" }));
  });
  for (const expected of [
    actionIssue.title,
    decisionIssue.title,
    "SUPPORTING OBSERVATIONS",
    "Terraform",
    "Actual clicks, successful submissions",
    "not a conversion-rate measurement",
  ])
    assert.ok(text.includes(expected), expected);
  assert.ok(view.getByText(/Conversion plan copied/));
});
test("download uses the full plan and clipboard denial gives an honest alternative", async (t) => {
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
    return "blob:conversion";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(
        this.download,
        "portfolio.example-conversion-action-plan.txt",
      );
    },
  );
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy Conversion plan" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  fireEvent.click(
    view.getByRole("button", { name: "Download Conversion plan (.txt)" }),
  );
  const text = await exported!.text();
  assert.ok(text.includes(actionIssue.title));
  assert.ok(text.includes("NOT TESTED"));
  assert.ok(text.includes("STRENGTHS TO PRESERVE"));
});
test("conversion evidence is a structured observation rather than a fabricated page quotation", () => {
  const view = render(
    createElement(IssueCard, { issue: actionIssue, url, index: 0 }),
  );
  fireEvent.click(view.getByText("View conversion evidence"));
  assert.equal(view.container.querySelector("blockquote"), null);
  assert.ok(view.getByText("Explore projects"));
  assert.ok(view.getByText("Not opened or tested"));
});
test("no findings and fully unassessed criteria remain honest and export useful evidence", () => {
  const report = {
    ...analysis,
    goal: null,
    criteria: analysis.criteria.map((item) => ({ ...item, score: null })),
  };
  const view = mount([], report);
  assert.equal(view.queryByRole("meter", { name: "Conversion clarity" }), null);
  assert.ok(view.getByText(/No supported conversion findings in this report/));
  assert.ok(view.getByText(/The main visitor goal could not be established/));
  const plan = conversionPlan(report, [], url);
  assert.ok(plan.includes("Qualitative clarity score: Not assessed"));
  assert.ok(plan.includes("SUPPORTING OBSERVATIONS"));
});

test("exact page cross-links, same-title findings and generated steps survive filters", () => {
  const firstPage = `${url}?view=recent`;
  const secondPage = `${url}?view=archive`;
  const sparsePage = `${url}contact`;
  const firstSource = { ...link, pageUrl: firstPage };
  const secondSource = {
    ...link,
    pageUrl: secondPage,
    observation: JSON.stringify({ name: "Explore archive", href: "#archive" }),
  };
  const issues = [
    { ...actionIssue, pageUrl: firstPage, conversionEvidence: [firstSource] },
    {
      ...actionIssue,
      pageUrl: secondPage,
      conversionEvidence: [secondSource],
      priority: "Low" as const,
    },
  ];
  const [first, second] = reviewIssues(issues);
  const report = {
    ...analysis,
    evidence: [firstSource, secondSource],
    actions: [firstSource, secondSource],
  };
  const collectedPages = [firstPage, secondPage, sparsePage];
  const generated = {
    [first.key]: [
      { title: "Recent fix", description: "Update the recent action." },
    ],
    [second.key]: [
      { title: "Archive fix", description: "Update the archive action." },
    ],
  };
  const view = render(
    createElement(Section, {
      analysis: report,
      issues,
      url,
      collectedPages,
      generatedFixSteps: generated,
      onFixStepsLoaded: () => {},
    }),
  );
  fireEvent.change(view.getByLabelText("Select a finding"), {
    target: { value: second.key },
  });
  assert.ok(view.getByText("Archive fix"));
  fireEvent.click(view.getByRole("button", { name: "Inspect source page" }));
  const picker = view.getByRole("combobox", {
    name: "Page to inspect",
  }) as HTMLSelectElement;
  assert.equal(picker.value, secondPage);
  assert.ok(view.getByRole("heading", { name: "Explore archive" }));
  assert.equal(
    view.getByRole("link", { name: "Open audited page" }).getAttribute("href"),
    secondPage,
  );
  fireEvent.click(
    view.getByRole("button", { name: "View findings for this page" }),
  );
  assert.equal(
    (view.getByRole("combobox", {
      name: "Finding source page",
    }) as HTMLSelectElement).value,
    secondPage,
  );
  assert.ok(view.getByText("1 of 2 findings match these filters"));
  assert.ok(view.getByText("Archive fix"));
  fireEvent.click(view.getByRole("button", { name: "Actions & forms" }));
  fireEvent.change(picker, { target: { value: sparsePage } });
  fireEvent.click(
    view.getByRole("button", { name: "View findings for this page" }),
  );
  assert.ok(view.getByText("No supported findings for this page"));
  fireEvent.click(view.getByRole("button", { name: "Clear filters" }));
  assert.ok(view.getByText("Archive fix"));
  const plan = conversionPlan(report, issues, url, generated, collectedPages);
  assert.ok(plan.includes(`${link.id} · ${firstPage}`));
  assert.ok(plan.includes(`${link.id} · ${secondPage}`));
  assert.ok(plan.includes("Recent fix") && plan.includes("Archive fix"));
});

test("a shortlisted form opens its single matching detail and preserves zero and unknown counts", () => {
  const recordedForm = {
    ...form,
    observation: JSON.stringify({
      name: "Contact Ada",
      editableQuestions: 0,
      method: "post",
      form: "form-1",
      value: "PRIVATE-TEST-VALUE",
    }),
  };
  const field: ConversionSource = {
    ...recordedForm,
    id: "C2-E2",
    kind: "field",
    observation: JSON.stringify({
      form: "form-1",
      name: "Message",
      help: ["Keep it brief."],
    }),
  };
  const view = mount([], {
    ...analysis,
    actions: [recordedForm],
    forms: [recordedForm],
    evidence: [field],
  });
  fireEvent.click(view.getByRole("button", { name: "Actions & forms" }));
  fireEvent.change(view.getByRole("combobox", { name: "Page to inspect" }), {
    target: { value: form.pageUrl },
  });
  fireEvent.click(
    view.getByRole("button", { name: "View matching form details" }),
  );
  const details = view.getByText("Form details").closest("details")!;
  assert.ok(details.open);
  assert.equal(document.activeElement, details.querySelector("summary"));
  assert.ok(view.getByText("Unknown"));
  assert.ok(view.getByText("Keep it brief."));
  assert.ok(view.getByText("post"));
  assert.ok(!view.container.textContent!.includes("PRIVATE-TEST-VALUE"));
});

test("zero-finding print uses the full plan and only dashboard-eligible numeric criteria", () => {
  const report = specialistFixture();
  report.conversion = [];
  const current = report.conversionAnalysis!;
  const criterion = { ...current.criteria[0], score: 0 };
  current.criteria = [
    { ...criterion, reason: "Uncited score", score: 100, sources: [] },
    criterion,
    { ...criterion, reason: "Duplicate score", score: 90 },
    {
      ...criterion,
      key: "decision",
      reason: null as unknown as string,
      score: 99,
    },
  ];
  const pages = report.pagesAnalyzed!.map(({ url }) => url);
  const category = dashboardModel(report).categories.find(
    ({ key }) => key === "conversion",
  );
  assert.equal(category?.score, 0);
  const plan = conversionPlan(current, [], report.url, {}, pages);
  assert.match(plan, /Qualitative clarity score: 0\n1 of 4 criteria assessed/);
  assert.doesNotMatch(plan, /Uncited score|Duplicate score|99\/100/);
  const view = render(
    createElement(PrintReport, { result: report, generatedFixSteps: {} }),
  );
  assert.ok(
    [...view.container.querySelectorAll("pre")].some(
      (pre) => pre.textContent === plan,
    ),
  );
});
