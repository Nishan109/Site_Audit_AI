import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { uxWorkspaceFixture } from "./ux-workspace-fixtures";
import { uxActionPlan, uxAssessment } from "../src/lib/ux-presentation";
import { reviewIssues } from "../src/lib/review-workspace";
import { dashboardModel } from "../src/lib/dashboard";
import type { UXAnalysis } from "../src/lib/ux";
import type { FixStep } from "../src/lib/types";
let Section: typeof import("../src/components/UXSection").default;
let TabPanel: typeof import("../src/components/TabPanel").default;
let PrintReport: typeof import("../src/components/PrintReport").default;
before(async () => {
  Section = (await import("../src/components/UXSection")).default;
  TabPanel = (await import("../src/components/TabPanel")).default;
  PrintReport = (await import("../src/components/PrintReport")).default;
});
afterEach(cleanup);
function props(report = uxWorkspaceFixture()) {
  return {
    analysis: report.uxAnalysis,
    issues: report.ux,
    url: report.url,
    collectedPages: [report.url],
    generatedFixSteps: {} as Record<string, FixStep[]>,
    onFixStepsLoaded: () => {},
  };
}
const activeTitle = (container: HTMLElement) =>
  container.querySelector("[data-active-finding] h3")?.textContent;

test("UX selection and priority/area filters keep counts stable and reset filtered emptiness", () => {
  const report = uxWorkspaceFixture(),
    view = render(createElement(Section, props(report)));
  assert.equal(activeTitle(view.container), report.ux[0].title);
  fireEvent.click(
    view.getByRole("button", {
      name: `Select UX finding 2: ${report.ux[1].title}`,
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "High 2" }));
  assert.equal(activeTitle(view.container), report.ux[1].title);
  fireEvent.change(view.getByLabelText("UX review area"), {
    target: { value: "controls" },
  });
  assert.equal(activeTitle(view.container), report.ux[0].title);
  fireEvent.click(view.getByRole("button", { name: "Medium 2" }));
  assert.ok(
    view.getByRole("heading", { name: "No findings match these filters" }),
  );
  assert.ok(view.getByText(/Showing 0 of 6 findings/));
  const snapshot = view.getByRole("region", {
    name: "User experience review snapshot",
  });
  assert.equal(snapshot.querySelector("dd")?.textContent, "6");
  fireEvent.click(view.getAllByRole("button", { name: "Reset filters" })[0]);
  assert.equal(activeTitle(view.container), report.ux[0].title);
});

test("UX full queue, narrow-screen selector, and explicit detail focus use the same stable identity", () => {
  const report = uxWorkspaceFixture(),
    view = render(createElement(Section, props(report)));
  assert.equal(
    view.getAllByRole("button", { name: /^Select UX finding/ }).length,
    5,
  );
  fireEvent.click(view.getByRole("button", { name: "Show all 6 findings" }));
  fireEvent.click(
    view.getByRole("button", {
      name: `Select UX finding 6: ${report.ux[5].title}`,
    }),
  );
  assert.equal(activeTitle(view.container), report.ux[5].title);
  fireEvent.click(view.getByRole("button", { name: "Go to finding details" }));
  assert.ok(
    document.activeElement ===
      view.container.querySelector("[data-active-finding]"),
    "Detail action focuses the active article",
  );
  fireEvent.click(view.getByRole("button", { name: "Show first 5" }));
  assert.equal(activeTitle(view.container), report.ux[0].title);
  const key = reviewIssues(report.ux)[4].key;
  fireEvent.change(view.getByLabelText("Choose a UX finding"), {
    target: { value: key },
  });
  assert.equal(activeTitle(view.container), report.ux[4].title);
});

test("UX state and native disclosures survive section navigation and reset for a new report", async () => {
  const report = uxWorkspaceFixture();
  const shared = {
    result: report,
    generatedFixSteps: {},
    onFixStepsLoaded: () => {},
  };
  const view = render(createElement(TabPanel, { ...shared, activeTab: "ux" }));
  const root = () =>
    within(
      view.container.querySelector(
        '[data-review-workspace="ux"]',
      ) as HTMLElement,
    );
  fireEvent.click(root().getByRole("button", { name: "High 2" }));
  fireEvent.click(
    root().getByRole("button", {
      name: `Select UX finding 2: ${report.ux[1].title}`,
    }),
  );
  fireEvent.click(root().getByText("Category assessments and strengths"));
  const detail = root()
    .getByText("Category assessments and strengths")
    .closest("details")!;
  assert.ok(detail.open);
  view.rerender(createElement(TabPanel, { ...shared, activeTab: "seo" }));
  assert.equal(view.queryByRole("button", { name: "Copy UX plan" }), null);
  view.rerender(createElement(TabPanel, { ...shared, activeTab: "ux" }));
  assert.equal(
    root().getByRole("button", { name: "High 2" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    activeTitle(
      view.container.querySelector(
        '[data-review-workspace="ux"]',
      ) as HTMLElement,
    ),
    report.ux[1].title,
  );
  assert.ok(detail.open);
  view.rerender(
    createElement(TabPanel, {
      ...shared,
      result: { ...report, analysisId: "fresh-ux-report" },
      activeTab: "ux",
    }),
  );
  assert.equal(
    root().getByRole("button", { name: "All 6" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    activeTitle(
      view.container.querySelector(
        '[data-review-workspace="ux"]',
      ) as HTMLElement,
    ),
    report.ux[0].title,
  );
  assert.equal(
    root().getByText("Category assessments and strengths").closest("details")!
      .open,
    false,
  );
});

test("UX structured evidence stays visible without plain evidence or steps; generation is explicit and retryable", async (t) => {
  const report = uxWorkspaceFixture();
  report.ux[0].fixSteps = [];
  let calls = 0,
    loadedKey = "";
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(
      JSON.stringify(
        calls === 1
          ? { error: "Provider busy. Retry this finding." }
          : {
              steps: [
                {
                  title: "Use a destination-specific label",
                  description: "Review the label in page context.",
                },
              ],
            },
      ),
      { status: calls === 1 ? 502 : 200 },
    );
  });
  const view = render(
    createElement(Section, {
      ...props(report),
      onFixStepsLoaded: (key) => {
        loadedKey = key;
      },
    }),
  );
  const evidence = within(
    view.getByRole("region", { name: "Observed in the collected page" }),
  );
  assert.ok(evidence.getByText("Explore", { selector: "dd" }));
  assert.ok(evidence.getByText("Not opened or tested", { selector: "dd" }));
  assert.ok(
    evidence.getByText(/JavaScript behavior was not tested/, {
      selector: "dd",
    }),
  );
  assert.equal(view.container.querySelector("blockquote"), null);
  assert.equal(fetch.mock.callCount(), 0);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Generate action plan" })),
  );
  assert.ok(view.getByRole("alert"));
  assert.ok(evidence.getByText("Explore", { selector: "dd" }));
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Retry action plan" })),
  );
  await waitFor(() =>
    assert.ok(
      view.getByRole("heading", { name: "Use a destination-specific label" }),
    ),
  );
  assert.equal(loadedKey, reviewIssues(report.ux)[0].key);
});

test("UX empty, earlier, and untyped saved findings retain honest evidence and browser scope", () => {
  const report = uxWorkspaceFixture();
  const view = render(
    createElement(Section, {
      ...props(report),
      analysis: undefined,
      issues: [],
    }),
  );
  assert.ok(view.getByText(/earlier UX review/));
  assert.ok(
    view.getByRole("heading", {
      name: "No retained UX findings in this report",
    }),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Review assessment coverage" }),
  );
  assert.ok(
    view.getByText("Category assessments and strengths").closest("details")!
      .open,
  );
  view.rerender(
    createElement(Section, {
      ...props(report),
      analysis: { ...report.uxAnalysis!, unassessed: [] },
      issues: [
        {
          ...report.ux[0],
          uxCriterion: undefined,
          uxEvidence: undefined,
          evidence: "Saved HTML observation",
          fixSteps: [],
        },
      ],
    }),
  );
  assert.ok(view.getByText("Saved HTML observation"));
  fireEvent.change(view.getByLabelText("UX review area"), {
    target: { value: "other" },
  });
  assert.ok(view.getByRole("heading", { name: report.ux[0].title }));
  fireEvent.click(view.getByText("Coverage and remaining checks"));
  assert.ok(
    view.getByText("Keyboard behavior, focus order and interactive controls"),
  );
  assert.ok(view.getByText(/Manual follow-up guidance/));
});

test("UX source-eligible weighted assessment and exports agree with dashboard; zero and unavailable remain distinct", () => {
  const report = uxWorkspaceFixture(),
    analysis = report.uxAnalysis!;
  analysis.criteria[0].score = 0;
  analysis.criteria[1].score = 101;
  analysis.criteria[2].sources = [
    {
      ...analysis.criteria[2].sources[0],
      pageUrl: "https://uncollected.example/",
    },
  ];
  analysis.criteria[3].score = null;
  const result = uxAssessment(analysis, [report.url]);
  assert.equal(result.score, 0);
  assert.equal(result.criteria.length, 1);
  assert.equal(
    dashboardModel(report).categories.find((category) => category.key === "ux")
      ?.score,
    result.score,
  );
  const view = render(createElement(Section, props(report)));
  const snapshot = view.getByRole("region", {
    name: "User experience review snapshot",
  });
  assert.ok(snapshot.textContent?.includes("0/100"));
  const text = uxActionPlan(analysis, report.ux, report.url, {}, [report.url]);
  assert.ok(text.includes("HTML-based UX score: 0"));
  assert.ok(text.includes("Controls & next steps: Not assessed"));
  assert.ok(!text.includes("101/100"));
  const uncited = {
    ...analysis,
    criteria: analysis.criteria.map((item) => ({ ...item, sources: [] })),
  };
  assert.equal(uxAssessment(uncited, [report.url]).score, null);
  assert.equal(
    uxAssessment(
      { ...analysis, method: "old-method" } as unknown as UXAnalysis,
      [report.url],
    ).score,
    null,
  );
});

test("UX plan and print include occurrence-specific generated steps and legacy evidence regardless of selection", () => {
  const report = uxWorkspaceFixture();
  report.ux = [
    report.ux[0],
    { ...report.ux[0] },
    {
      ...report.ux[1],
      uxEvidence: undefined,
      evidence: "Legacy recorded field observation",
    },
  ];
  const records = reviewIssues(report.ux);
  const generated = Object.fromEntries(
    records.slice(0, 2).map((record, index) => [
      record.key,
      [
        {
          title: `Unique step ${index + 1}`,
          description: `For occurrence ${index + 1}`,
        },
      ],
    ]),
  );
  const plan = uxActionPlan(
    report.uxAnalysis,
    report.ux,
    report.url,
    generated,
    [report.url],
  );
  const chunks = plan.split(/\n\d+\. /);
  assert.ok(chunks[1].includes("Unique step 1"));
  assert.ok(!chunks[1].includes("Unique step 2"));
  assert.ok(chunks[2].includes("Unique step 2"));
  assert.ok(plan.includes("Legacy recorded field observation"));
  const view = render(
    createElement(PrintReport, {
      result: report,
      generatedFixSteps: generated,
    }),
  );
  assert.ok(view.container.textContent?.includes(plan));
});

test("UX late generation cannot update a disposed report", async (t) => {
  const report = uxWorkspaceFixture();
  report.ux[0].fixSteps = [];
  let respond!: (response: Response) => void,
    saved = 0,
    signal: AbortSignal | null = null;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? null;
      return new Promise<Response>((resolve) => {
        respond = resolve;
      });
    },
  );
  const view = render(
    createElement(Section, {
      ...props(report),
      onFixStepsLoaded: () => {
        saved++;
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Generate action plan" }));
  assert.ok(
    view
      .getByRole("button", { name: "Preparing your plan…" })
      .hasAttribute("disabled"),
  );
  view.unmount();
  assert.ok(signal!.aborted);
  await act(async () =>
    respond(
      new Response(
        JSON.stringify({
          steps: [
            { title: "Late response", description: "Must not be retained" },
          ],
        }),
      ),
    ),
  );
  assert.equal(saved, 0);
});

test("UX download failure clears success and remains actionable", async (t) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => {} },
  });
  t.mock.method(URL, "createObjectURL", () => {
    throw new Error("Unavailable");
  });
  const view = render(createElement(Section, props()));
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Copy UX plan" })),
  );
  assert.ok(view.getByText(/UX action plan copied/));
  fireEvent.click(
    view.getByRole("button", { name: "Download UX plan (.txt)" }),
  );
  assert.ok(view.getByText(/download could not start/));
  assert.equal(view.queryByText(/UX action plan copied/), null);
});
