import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement, useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { FixStep } from "../src/lib/types";
import { specialistFixture } from "./review-workspace-fixtures";
import { reviewIssueKey } from "../src/lib/review-workspace";
let Messaging: typeof import("../src/components/MessagingSection").default;
let SEO: typeof import("../src/components/SEOSection").default;
let Conversion: typeof import("../src/components/ConversionSection").default;
let TabPanel: typeof import("../src/components/TabPanel").default;
before(async () => {
  Messaging = (await import("../src/components/MessagingSection")).default;
  SEO = (await import("../src/components/SEOSection")).default;
  Conversion = (await import("../src/components/ConversionSection")).default;
  TabPanel = (await import("../src/components/TabPanel")).default;
});
afterEach(cleanup);
const props = () => {
  const result = specialistFixture();
  return {
    result,
    url: result.url,
    generatedFixSteps: {},
    onFixStepsLoaded: () => {},
  };
};

test("missing steps keep the wording editor; explicit generation can fail and retry without losing evidence", async (t) => {
  const p = props(),
    issue = { ...p.result.messaging[0], fixSteps: undefined };
  let calls = 0;
  const steps = [
    {
      title: "Generated revision",
      description: "Review this page-specific change.",
    },
  ];
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? new Response(JSON.stringify({ error: "Provider unavailable" }), {
          status: 502,
        })
      : new Response(JSON.stringify({ steps }), { status: 200 });
  });
  const loaded: Record<string, FixStep[]> = {};
  const view = render(
    createElement(Messaging, {
      ...p,
      analysis: p.result.messagingAnalysis,
      issues: [issue],
      onFixStepsLoaded: (key, value) => {
        loaded[key] = value;
      },
    }),
  );
  const draft = view.getByRole("textbox", {
    name: `Wording draft for ${issue.title}`,
  });
  fireEvent.change(draft, { target: { value: "My retained draft." } });
  assert.equal(calls, 0);
  fireEvent.click(view.getByText("Implementation steps"));
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Generate action plan" })),
  );
  assert.ok(
    view.getByRole("alert").textContent?.includes("Provider unavailable"),
  );
  assert.equal((draft as HTMLTextAreaElement).value, "My retained draft.");
  assert.ok(view.getAllByText(issue.copySuggestion!.original).length);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Retry action plan" })),
  );
  assert.equal(calls, 2);
  assert.deepEqual(loaded[reviewIssueKey(issue)], steps);
  assert.ok(view.getByText(steps[0].description));
});

test("same-title findings on different pages retain independent generation, draft and detail identity", async (t) => {
  const p = props(),
    first = { ...p.result.messaging[0], fixSteps: undefined },
    second = { ...first, pageUrl: `${p.url}about` };
  const generated = [
    {
      title: "Original page only",
      description: "Only change the original page.",
    },
  ];
  let requestUrl = "";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: RequestInfo | URL, options?: RequestInit) => {
      requestUrl = JSON.parse(String(options?.body)).url;
      return new Response(JSON.stringify({ steps: generated }), {
        status: 200,
      });
    },
  );
  function Host() {
    const [steps, setSteps] = useState<Record<string, FixStep[]>>({});
    return createElement(Messaging, {
      ...p,
      analysis: p.result.messagingAnalysis,
      issues: [first, second],
      generatedFixSteps: steps,
      onFixStepsLoaded: (key, value) =>
        setSteps((previous) => ({ ...previous, [key]: value })),
    });
  }
  const view = render(createElement(Host));
  const rows = view
    .getByRole("group", { name: "Select a copy finding" })
    .querySelectorAll<HTMLElement>("[data-finding-key]");
  assert.notEqual(rows[0].dataset.findingKey, rows[1].dataset.findingKey);
  const firstField = view.getByRole("textbox", {
    name: `Wording draft for ${first.title}`,
  }) as HTMLTextAreaElement;
  const firstId = firstField.id;
  fireEvent.click(view.getByText("Implementation steps"));
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Generate action plan" })),
  );
  assert.equal(requestUrl, first.pageUrl);
  assert.ok(view.getByText(generated[0].description));
  fireEvent.click(
    view.getByRole("button", { name: `Select finding 2: ${second.title}` }),
  );
  assert.equal(view.queryByText(generated[0].description), null);
  fireEvent.click(view.getByText("Implementation steps"));
  assert.ok(view.getByRole("button", { name: "Generate action plan" }));
  const secondField = view.getByRole("textbox", {
    name: `Wording draft for ${second.title}`,
  }) as HTMLTextAreaElement;
  assert.notEqual(firstId, secondField.id);
  fireEvent.change(secondField, {
    target: { value: "Only the second page draft." },
  });
  fireEvent.click(
    view.getByRole("button", { name: `Select finding 1: ${first.title}` }),
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: `Wording draft for ${first.title}`,
      }) as HTMLTextAreaElement
    ).value,
    first.copySuggestion!.replacement,
  );
  assert.ok(view.getByText(generated[0].description));
});

test("filtering retains full counts and selects a matching record without losing finding identity", () => {
  const p = props(),
    view = render(
      createElement(Messaging, {
        ...p,
        analysis: p.result.messagingAnalysis,
        issues: p.result.messaging,
      }),
    );
  const low = p.result.messaging[2],
    high = p.result.messaging[0];
  fireEvent.click(
    view.getByRole("button", { name: `Select finding 3: ${low.title}` }),
  );
  assert.ok(view.getByRole("heading", { name: low.title }));
  const key = view.container
    .querySelector("[data-active-finding]")!
    .getAttribute("data-active-finding");
  fireEvent.click(view.getByRole("button", { name: "High 1" }));
  assert.equal(view.queryByRole("heading", { name: low.title }), null);
  assert.ok(view.getByRole("heading", { name: high.title }));
  assert.ok(
    within(view.getByLabelText("Messaging review snapshot")).getByText("3"),
  );
  fireEvent.click(view.getByRole("button", { name: "Reset filters" }));
  assert.ok(view.getByRole("heading", { name: high.title }));
  fireEvent.click(
    view.getByRole("button", { name: `Select finding 3: ${low.title}` }),
  );
  assert.equal(
    view.container
      .querySelector("[data-active-finding]")!
      .getAttribute("data-active-finding"),
    key,
  );
});

test("longer finding lists reveal retained records without changing full counts", () => {
  const p = props(),
    issues = Array.from({ length: 7 }, (_, index) => ({
      ...p.result.seo[0],
      title: `Finding ${index}`,
      detail: `Retained description ${index}`,
    }));
  const view = render(
    createElement(SEO, { ...p, analysis: p.result.seoAnalysis, issues }),
  );
  const queue = () =>
    view.getAllByRole("button", { name: /^Select SEO finding/ });
  assert.equal(queue().length, 5);
  fireEvent.click(view.getByRole("button", { name: "Show all 7 findings" }));
  assert.equal(queue().length, 7);
  fireEvent.click(
    view.getByRole("button", { name: "Select SEO finding 7: Finding 6" }),
  );
  assert.ok(view.getByRole("heading", { name: "Finding 6" }));
  fireEvent.click(view.getByRole("button", { name: "Show fewer findings" }));
  assert.equal(queue().length, 5);
  assert.ok(view.getByRole("heading", { name: "Finding 6" }));
  assert.ok(within(view.getByLabelText("Review snapshot")).getByText("7"));
});

test("SEO and Conversion retain filters, selected inspector pages and disclosures on a round trip, then reset", () => {
  const p = props(),
    result = p.result,
    second = `${p.url}about`;
  result.pagesAnalyzed!.push({ ...result.pagesAnalyzed![0], url: second });
  result.seoAnalysis!.pages.push({
    ...result.seoAnalysis!.pages[0],
    url: second,
    titles: ["About the bakery"],
  });
  result.conversionAnalysis!.evidence.push({
    ...result.conversionAnalysis!.evidence[0],
    id: "second-link",
    pageUrl: second,
  });
  const view = render(
    createElement(TabPanel, { ...p, result, activeTab: "seo" }),
  );
  fireEvent.change(view.getByLabelText("SEO finding focus area"), {
    target: { value: "metadata" },
  });
  fireEvent.click(
    view.getByRole("button", { name: "Page signals" }),
  );
  const seoInspector = view.getByRole("region", {
    name: "Collected page signals",
  });
  fireEvent.change(view.getByLabelText("SEO page to inspect"), {
    target: { value: second },
  });
  fireEvent.click(within(seoInspector).getByText("Canonical & directives"));
  view.rerender(
    createElement(TabPanel, { ...p, result, activeTab: "conversion" }),
  );
  fireEvent.change(view.getByLabelText("Finding focus area"), {
    target: { value: "actions" },
  });
  fireEvent.click(view.getByRole("button", { name: "Actions & forms" }));
  fireEvent.change(view.getByRole("combobox", { name: "Page to inspect" }), {
    target: { value: second },
  });
  view.rerender(createElement(TabPanel, { ...p, result, activeTab: "seo" }));
  assert.equal(
    (view.getByLabelText("SEO finding focus area") as HTMLSelectElement).value,
    "metadata",
  );
  assert.equal(
    (view.getByLabelText("SEO page to inspect") as HTMLSelectElement).value,
    second,
  );
  assert.equal(
    view
      .getByRole("button", { name: "Page signals" })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    within(seoInspector).getByText("Canonical & directives").closest("details")!
      .open,
    true,
  );
  fireEvent.click(
    view.getByRole("button", { name: "Findings 2" }),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Page signals" }),
  );
  assert.equal(
    (view.getByLabelText("SEO page to inspect") as HTMLSelectElement).value,
    second,
  );
  view.rerender(
    createElement(TabPanel, { ...p, result, activeTab: "conversion" }),
  );
  assert.equal(
    (view.getByRole("combobox", { name: "Page to inspect" }) as HTMLSelectElement)
      .value,
    second,
  );
  assert.equal(
    (view.getByLabelText("Finding focus area") as HTMLSelectElement)
      .value,
    "actions",
  );
  const fresh = { ...result, analysisId: "new-report" };
  view.rerender(
    createElement(TabPanel, { ...p, result: fresh, activeTab: "seo" }),
  );
  assert.equal(
    (view.getByLabelText("SEO finding focus area") as HTMLSelectElement).value,
    "all",
  );
  assert.equal(
    (view.getByLabelText("SEO page to inspect") as HTMLSelectElement).value,
    p.url,
  );
  assert.equal(
    view
      .getByRole("button", { name: "Page signals" })
      .getAttribute("aria-pressed"),
    "false",
  );
  view.rerender(
    createElement(TabPanel, { ...p, result: fresh, activeTab: "conversion" }),
  );
  assert.equal(view.getByRole("button", { name: "Actions & forms" }).getAttribute("aria-pressed"), "false");
  assert.equal((view.getByLabelText("Finding focus area") as HTMLSelectElement).value, "");
  fireEvent.click(view.getByRole("button", { name: "Actions & forms" }));
  assert.equal((view.getByRole("combobox", { name: "Page to inspect" }) as HTMLSelectElement).value, p.url);
});

test("valid zero has a zero-valued meter while unassessed results have no assessment meter", () => {
  const p = props(),
    analysis = p.result.conversionAnalysis!;
  const view = render(
    createElement(Conversion, {
      ...p,
      issues: [],
      collectedPages: p.result.pagesAnalyzed?.map(({ url }) => url),
      analysis: {
        ...analysis,
        criteria: analysis.criteria.map((item) => ({ ...item, score: 0 })),
      },
    }),
  );
  assert.equal(
    view
      .getByRole("meter", { name: "Conversion clarity" })
      .getAttribute("aria-valuenow"),
    "0",
  );
  view.rerender(
    createElement(Conversion, {
      ...p,
      issues: [],
      collectedPages: p.result.pagesAnalyzed?.map(({ url }) => url),
      analysis: {
        ...analysis,
        criteria: analysis.criteria.map((item) => ({ ...item, score: null })),
      },
    }),
  );
  assert.equal(
    view.queryByRole("meter", { name: "Conversion clarity" }),
    null,
  );
  assert.ok(view.getAllByText("Not assessed").length);
});

test("download-start failure is actionable and never reports successful saving", (t) => {
  t.mock.method(URL, "createObjectURL", () => {
    throw new Error("Unavailable");
  });
  const p = props(),
    view = render(
      createElement(SEO, {
        ...p,
        issues: p.result.seo,
        analysis: p.result.seoAnalysis,
      }),
    );
  fireEvent.click(
    view.getByRole("button", { name: "Download SEO plan (.txt)" }),
  );
  assert.ok(
    view
      .getAllByRole("status")
      .some((element) =>
        element.textContent?.includes("download could not start"),
      ),
  );
  assert.equal(view.queryByText(/Download started/), null);
});

test("leaving a report cancels pending step generation and late replies cannot update the new report", async (t) => {
  let signal: AbortSignal | undefined, resolve!: (value: Response) => void;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: RequestInfo | URL, options?: RequestInit) => {
      signal = options?.signal as AbortSignal;
      return new Promise<Response>((done) => {
        resolve = done;
      });
    },
  );
  const p = props(),
    loaded: string[] = [],
    issue = { ...p.result.messaging[0], fixSteps: undefined };
  const view = render(
    createElement(Messaging, {
      ...p,
      issues: [issue],
      analysis: p.result.messagingAnalysis,
      onFixStepsLoaded: (key) => loaded.push(key),
    }),
  );
  fireEvent.click(view.getByText("Implementation steps"));
  fireEvent.click(view.getByRole("button", { name: "Generate action plan" }));
  assert.equal(signal?.aborted, false);
  view.unmount();
  assert.equal(signal?.aborted, true);
  await act(async () =>
    resolve(
      new Response(
        JSON.stringify({
          steps: [
            {
              title: "Too late",
              description: "Do not attach to another report.",
            },
          ],
        }),
        { status: 200 },
      ),
    ),
  );
  assert.deepEqual(loaded, []);
});
