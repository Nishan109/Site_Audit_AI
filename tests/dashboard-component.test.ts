import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import {
  render,
  cleanup,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import type { ReportSection } from "../src/components/navigation";
import { dashboardFixture, observation } from "./dashboard-fixtures";
import { dashboardEvidence } from "../src/lib/dashboard-evidence";
let Dashboard: typeof import("../src/components/DashboardOverview").default;
let Header: typeof import("../src/components/ReportHeader").default;
let PrintReport: typeof import("../src/components/PrintReport").default;
let Evidence: typeof import("../src/components/AuditEvidence").default;
let Log: typeof import("../src/components/AgentLog").default;
before(async () => {
  Dashboard = (await import("../src/components/DashboardOverview")).default;
  Header = (await import("../src/components/ReportHeader")).default;
  PrintReport = (await import("../src/components/PrintReport")).default;
  Evidence = (await import("../src/components/AuditEvidence")).default;
  Log = (await import("../src/components/AgentLog")).default;
});
afterEach(cleanup);

test("snapshot retains the cited aggregate and complete finding count, with findings before assessments", () => {
  const view = render(createElement(Dashboard, { result: dashboardFixture() }));
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "76");
  assert.ok(view.getByText("5 of 5 category assessments available"));
  assert.ok(
    view.getByText(
      "6 distinct supported findings across the five perspectives.",
    ),
  );
  assert.equal(view.getAllByRole("article").length, 5);
  assert.ok(view.getByRole("button", { name: "Show all 6 findings" }));
  const findings = view.getByRole("region", { name: "Findings to work on" });
  const categories = view.getByRole("complementary", {
    name: "Five perspectives",
  });
  assert.ok(findings.compareDocumentPosition(categories) & 4);
  assert.ok(!view.queryByText("Only the saved shortlist"));
});

test("priority, category and local search intersect without changing overall report counts", () => {
  const view = render(createElement(Dashboard, { result: dashboardFixture() }));
  fireEvent.click(view.getByRole("button", { name: "Show all 6 findings" }));
  assert.equal(view.getAllByRole("article").length, 6);
  fireEvent.click(view.getByRole("button", { name: "High 2" }));
  assert.equal(view.getAllByRole("article").length, 2);
  fireEvent.change(view.getByLabelText("Review area"), {
    target: { value: "ux" },
  });
  assert.equal(view.getAllByRole("article").length, 1);
  assert.ok(
    within(view.getByRole("article")).getByRole("heading", {
      name: "Label the collection control",
    }),
  );
  fireEvent.change(view.getByLabelText("Search findings in this report"), {
    target: { value: "absent phrase" },
  });
  assert.ok(view.getByText("No findings match these filters."));
  assert.equal(view.queryAllByRole("article").length, 0);
  assert.ok(
    view.getByRole("button", { name: "Show all 6 supported findings" }),
  );
  fireEvent.click(view.getAllByRole("button", { name: "Clear filters" })[0]);
  assert.equal(view.getAllByRole("article").length, 5);
  assert.equal(
    (view.getByLabelText("Search findings in this report") as HTMLInputElement)
      .value,
    "",
  );
});

test("the first recommendation uses retained priority, evidence and fix steps", () => {
  const view = render(createElement(Dashboard, { result: dashboardFixture() }));
  const start = within(
    view.getByRole("region", { name: "Clarify the main promise" }),
  );
  assert.ok(
    start.getByText("Sourdough bread for Saturday collection in Bath."),
  );
  assert.ok(start.getByText("Review clarify the main promise"));
  assert.equal(
    start.getByRole("link").getAttribute("href"),
    "https://bakery.example/",
  );
});

test("the recommendation falls back to Medium priority and does not invent missing fix steps", () => {
  const data = dashboardFixture();
  data.messaging = data.messaging.filter((item) => item.priority !== "High");
  data.ux = [];
  data.seo[0].fixSteps = undefined;
  const view = render(createElement(Dashboard, { result: data }));
  const start = within(
    view.getByRole("region", { name: "Review the page description" }),
  );
  assert.ok(start.getByText("Medium priority"));
  assert.ok(!start.queryByText("Suggested first step"));
  assert.ok(start.getByText(/Inspect the source evidence/));
});

test("partial assessments keep their denominator visible and do not reuse saved totals", () => {
  const data = dashboardFixture();
  data.messagingAnalysis = undefined;
  data.seoAnalysis = undefined;
  const view = render(createElement(Dashboard, { result: data }));
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "70");
  assert.ok(view.getByText("3 of 5 category assessments available"));
});

test("the report header opens the single coverage disclosure and focuses its summary", () => {
  const data = dashboardFixture();
  const view = render(
    createElement(
      "div",
      null,
      createElement(Header, { result: data, onRerun: () => {} }),
      createElement(Evidence, { result: data, onResearchUpdated: () => {} }),
    ),
  );
  const details = view.container.querySelector(
    "#report-evidence",
  ) as HTMLDetailsElement;
  let scrolled = false;
  details.scrollIntoView = () => {
    scrolled = true;
  };
  fireEvent.click(
    view.getByRole("button", {
      name: "1 collected page · 2 unique source links",
    }),
  );
  assert.equal(details.open, true);
  assert.equal(scrolled, true);
  assert.ok(document.activeElement === details.querySelector("summary"));
});

test("structured evidence is retained when a plain evidence string is absent", () => {
  const data = dashboardFixture();
  data.ux[0].evidence = undefined;
  data.ux[0].uxEvidence = [
    { ...observation, observation: "A collected control has no visible name." },
  ];
  assert.equal(
    dashboardEvidence(data.ux[0])[0].text,
    "A collected control has no visible name.",
  );
  const view = render(createElement(Dashboard, { result: data }));
  fireEvent.change(view.getByLabelText("Review area"), {
    target: { value: "ux" },
  });
  const article = within(view.getByRole("article"));
  fireEvent.click(article.getByText("View details", { exact: true }));
  assert.ok(article.getByText("A collected control has no visible name."));
  assert.ok(article.getByText("HTML observation"));
});

test("category and separate-check actions open their existing workspaces", async () => {
  const selected: ReportSection[] = [];
  const view = render(
    createElement(Dashboard, {
      result: dashboardFixture(),
      onNavigate: (value) => selected.push(value),
    }),
  );
  fireEvent.click(
    within(
      view.getByRole("complementary", { name: "Five perspectives" }),
    ).getByRole("button", { name: "Open Search optimization review" }),
  );
  for (const name of [
    "Open Quick wins",
    "Open Security signals",
    "Open Accessibility signals",
    "Open PageSpeed insights",
  ])
    fireEvent.click(view.getByRole("button", { name }));
  assert.deepEqual(selected, [
    "seo",
    "quickwins",
    "security",
    "accessibility",
    "performance",
  ]);
  const first = within(view.getAllByRole("article")[0]);
  fireEvent.click(first.getByText("View details", { exact: true }));
  await waitFor(() =>
    assert.ok(
      first.getByRole("button", { name: "Open Messaging & copy review" }),
    ),
  );
  fireEvent.click(
    first.getByRole("button", { name: "Open Messaging & copy review" }),
  );
  assert.equal(selected.at(-1), "messaging");
});

test("missing assessments have no fabricated meter, while a real zero remains zero", () => {
  const data = dashboardFixture();
  data.messagingAnalysis = undefined;
  data.uxAnalysis = undefined;
  data.seoAnalysis = undefined;
  data.conversionAnalysis = undefined;
  data.aeoAnalysis = undefined;
  data.messaging = [];
  data.ux = [];
  data.seo = [];
  data.conversion = [];
  const view = render(createElement(Dashboard, { result: data }));
  assert.ok(!view.queryByRole("meter"));
  assert.ok(view.getByText("0 of 5 category assessments available"));
  assert.ok(view.getByText(/An empty list is not confirmation/));
  assert.ok(view.getByRole("button", { name: "Review coverage" }));
  data.messagingAnalysis = dashboardFixture().messagingAnalysis;
  data.messagingAnalysis!.criteria.forEach((item) => (item.score = 0));
  view.rerender(createElement(Dashboard, { result: { ...data } }));
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "0");
});

test("exports retain the complete overview independently of active finding filters", async (t) => {
  let copied = "";
  let saved: Blob | undefined;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    saved = blob as Blob;
    return "blob:overview";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "bakery.example-audit-overview.txt");
    },
  );
  const data = dashboardFixture();
  const view = render(
    createElement(
      "div",
      null,
      createElement(Header, { result: data, onRerun: () => {} }),
      createElement(Dashboard, { result: data }),
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "High 2" }));
  const disclosure = view
    .getByText("Export report", { exact: true })
    .closest("details")!;
  disclosure.open = true;
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: /^Copy overview/ }));
  });
  for (const text of [
    "76/100",
    "Explain collection timing",
    "Review the page description",
    "SHA-256",
    "No current results",
  ])
    assert.ok(copied.includes(text), text);
  disclosure.open = true;
  fireEvent.click(view.getByRole("button", { name: /^Download overview/ }));
  assert.equal(await saved!.text(), copied);
  assert.ok(
    view
      .getAllByRole("status")
      .some((item) => item.textContent?.includes("download started")),
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("denied");
      },
    },
  });
  disclosure.open = true;
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: /^Copy overview/ }));
  });
  assert.ok(
    view
      .getAllByRole("status")
      .some((item) =>
        item.textContent?.includes("Download the overview instead"),
      ),
  );
  assert.ok(view.getByRole("button", { name: /^Download overview/ }));
});

test("the export disclosure handles Escape, rerun and the real print action", (t) => {
  let printed = 0;
  let reruns = 0;
  t.mock.method(window, "print", () => {
    printed++;
  });
  const view = render(
    createElement(Header, {
      result: dashboardFixture(),
      onRerun: () => {
        reruns++;
      },
    }),
  );
  const summary = view.getByText("Export report", { exact: true });
  const disclosure = summary.closest("details")!;
  disclosure.open = true;
  fireEvent.keyDown(disclosure, { key: "Escape" });
  assert.equal(disclosure.open, false);
  assert.ok(document.activeElement === summary);
  disclosure.open = true;
  fireEvent.click(view.getByRole("button", { name: /^Print \/ save as PDF/ }));
  assert.equal(printed, 1);
  fireEvent.click(view.getByRole("button", { name: "Run again" }));
  assert.equal(reruns, 1);
});

test("canonical coverage retains deduplicated pages, timestamps, hashes and execution status", () => {
  const data = dashboardFixture();
  data.pagesAnalyzed!.push({ ...data.pagesAnalyzed![0] });
  const view = render(
    createElement(Evidence, { result: data, onResearchUpdated: () => {} }),
  );
  assert.ok(view.getByText("1 collected page · 2 unique source links"));
  assert.ok(view.getByRole("button", { name: "Retry web research" }));
  const details = view.container.querySelector(
    "#report-evidence",
  ) as HTMLDetailsElement;
  details.open = true;
  assert.ok(view.getByText(/not a continuous monitor/));
  assert.equal(
    view.container.querySelector("time")?.getAttribute("dateTime"),
    "2026-11-07T09:59:00.000Z",
  );
  assert.ok(view.getByText("a".repeat(64)));
  assert.ok(view.getByText("No execution records available"));
});

test("PDF retains the shared aggregate and full overview without legacy site grades", () => {
  const view = render(
    createElement(PrintReport, {
      result: dashboardFixture(),
      generatedFixSteps: {},
    }),
  );
  const text = view.container.textContent!;
  for (const item of [
    "Content & clarity assessment",
    "76",
    "Complete dashboard overview & coverage",
    "6 distinct supported findings",
    "Add support for product details",
  ])
    assert.ok(text.includes(item), item);
  for (const item of [
    "EXCELLENT",
    "Grade:",
    "Overall Site Score",
    "Only the saved shortlist",
  ])
    assert.equal(text.includes(item), false, item);
});

test("execution records preserve unknown statuses rather than claiming completion", () => {
  const view = render(
    createElement(Log, {
      agentSteps: [
        { name: "Legacy", detail: "No status recorded." },
        { name: "Evidence", status: "completed", detail: "Collected HTML." },
      ],
      sources: ["https://bakery.example/", "https://bakery.example/#main"],
      searchQueries: [],
    }),
  );
  assert.ok(view.getByText("1 of 2 steps recorded as completed"));
  assert.ok(view.getByText("Status not recorded"));
  assert.ok(view.getByText("1 unique source links recorded for this report."));
});
