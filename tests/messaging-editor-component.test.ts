import "./component-environment";
import { afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  within,
  waitFor,
} from "@testing-library/react";
import { specialistFixture } from "./review-workspace-fixtures";
import { reviewIssues } from "../src/lib/review-workspace";
import type { FixStep } from "../src/lib/types";
let Messaging: typeof import("../src/components/MessagingSection").default;
let TabPanel: typeof import("../src/components/TabPanel").default;
before(async () => {
  Messaging = (await import("../src/components/MessagingSection")).default;
  TabPanel = (await import("../src/components/TabPanel")).default;
});
afterEach(cleanup);

test("long queues reveal more findings and keep a later selected record visible after filters reset", async () => {
  const { props, result } = setup();
  const issues = Array.from({ length: 7 }, (_, index) => ({
    ...result.messaging[0],
    title: `Queue finding ${index + 1}`,
  }));
  const view = render(createElement(Messaging, { ...props, issues }));
  const queue = within(
    view.getByRole("group", { name: "Select a copy finding" }),
  );
  assert.equal(queue.getAllByRole("button").length, 5);
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Show all 7 findings" })),
  );
  assert.equal(queue.getAllByRole("button").length, 7);
  await waitFor(() =>
    assert.ok(
      document.activeElement ===
        queue.getByRole("button", {
          name: "Select finding 6: Queue finding 6",
        }),
      "Show all should focus the first newly revealed finding",
    ),
  );
  fireEvent.click(
    queue.getByRole("button", { name: "Select finding 7: Queue finding 7" }),
  );
  fireEvent.click(view.getByRole("button", { name: "High 7" }));
  fireEvent.click(view.getByRole("button", { name: "Reset filters" }));
  assert.equal(
    queue
      .getByRole("button", { name: "Select finding 7: Queue finding 7" })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(view.getByRole("heading", { name: "Queue finding 7" }));
  assert.equal(
    view.queryByRole("button", { name: "Show all 7 findings" }),
    null,
  );
});
function setup() {
  const result = specialistFixture();
  return {
    result,
    props: {
      url: result.url,
      analysis: result.messagingAnalysis,
      issues: result.messaging,
      collectedPages: result.pagesAnalyzed!.map((page) => page.url),
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    },
  };
}

test("initial selection follows priority even without a wording option, and normal interactions never start AI requests", (t) => {
  const { result, props } = setup();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({});
  });
  const first = { ...result.messaging[0], copySuggestion: undefined };
  const view = render(
    createElement(Messaging, {
      ...props,
      issues: [result.messaging[1], first],
    }),
  );
  assert.ok(view.getByRole("heading", { name: first.title }));
  assert.ok(view.getByText("No wording draft was included in this review."));
  assert.equal(view.queryByRole("textbox", { name: /Wording draft/ }), null);
  const queue = within(
    view.getByRole("group", { name: "Select a copy finding" }),
  );
  assert.equal(
    queue.getAllByRole("button")[0].getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(
    queue.getByRole("button", {
      name: `Select finding 2: ${result.messaging[1].title}`,
    }),
  );
  assert.ok(
    view.getByRole("textbox", {
      name: `Wording draft for ${result.messaging[1].title}`,
    }),
  );
  fireEvent.change(view.getByRole("textbox", { name: /Wording draft/ }), {
    target: { value: "A manual revision." },
  });
  fireEvent.click(view.getByRole("button", { name: "High 1" }));
  assert.equal(calls, 0);
});

test("drafts remain independent across selection and filters and the full export includes intentionally emptied hidden edits", async () => {
  const { result, props } = setup();
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  const view = render(createElement(Messaging, props));
  fireEvent.change(view.getByRole("textbox", { name: /Wording draft/ }), {
    target: { value: "First revised draft." },
  });
  fireEvent.click(
    view.getByRole("button", {
      name: `Select finding 2: ${result.messaging[1].title}`,
    }),
  );
  fireEvent.change(view.getByRole("textbox", { name: /Wording draft/ }), {
    target: { value: "" },
  });
  assert.equal(
    (view.getByRole("button", { name: "Copy wording" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.click(view.getByRole("button", { name: "High 1" }));
  assert.equal(
    (
      view.getByRole("textbox", {
        name: /Wording draft/,
      }) as HTMLTextAreaElement
    ).value,
    "First revised draft.",
  );
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Copy full plan" })),
  );
  for (const expected of [
    "First revised draft.",
    "(Draft is empty)",
    result.messaging[2].title,
    "Your edited draft · not reviewed by AI",
  ])
    assert.ok(copied.includes(expected), expected);
  fireEvent.click(view.getByRole("button", { name: "Reset filters" }));
  fireEvent.click(
    view.getByRole("button", {
      name: `Select finding 2: ${result.messaging[1].title}`,
    }),
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: /Wording draft/,
      }) as HTMLTextAreaElement
    ).value,
    "",
  );
});

test("exact duplicate records have separate selection, drafts and generated steps in the UI and plan", async (t) => {
  const { result, props } = setup(),
    first = { ...result.messaging[0], fixSteps: undefined },
    records = reviewIssues([first, first]);
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      steps: [
        {
          title: "First record only",
          description: "Generated for the first selected record.",
        },
      ],
    }),
  );
  function Host() {
    const [generated, setGenerated] = useState<Record<string, FixStep[]>>({});
    return createElement(Messaging, {
      ...props,
      issues: [first, first],
      generatedFixSteps: generated,
      onFixStepsLoaded: (key, steps) =>
        setGenerated((previous) => ({ ...previous, [key]: steps })),
    });
  }
  const view = render(createElement(Host));
  fireEvent.change(view.getByRole("textbox", { name: /Wording draft/ }), {
    target: { value: "First duplicate draft." },
  });
  fireEvent.click(view.getByText("Implementation steps"));
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Generate action plan" })),
  );
  assert.ok(view.getByText("Generated for the first selected record."));
  fireEvent.change(view.getByLabelText("Choose a messaging finding"), {
    target: { value: records[1].key },
  });
  assert.equal(
    view.queryByText("Generated for the first selected record."),
    null,
  );
  fireEvent.click(view.getByText("Implementation steps"));
  assert.ok(view.getByRole("button", { name: "Generate action plan" }));
  assert.equal(
    (
      view.getByRole("textbox", {
        name: /Wording draft/,
      }) as HTMLTextAreaElement
    ).value,
    first.copySuggestion!.replacement,
  );
  fireEvent.change(view.getByRole("textbox", { name: /Wording draft/ }), {
    target: { value: "Second duplicate draft." },
  });
  await act(async () =>
    fireEvent.click(view.getByRole("button", { name: "Copy full plan" })),
  );
  assert.ok(copied.includes("First duplicate draft."));
  assert.ok(copied.includes("Second duplicate draft."));
  assert.equal(
    copied.split("Generated for the first selected record.").length - 1,
    1,
  );
});

test("current/draft comparison precedes supporting evidence and steps, while longer original copy remains available intact", () => {
  const { result, props } = setup(),
    original = "The full collected original wording remains unchanged. ".repeat(
      8,
    );
  const first = {
    ...result.messaging[0],
    copySuggestion: { ...result.messaging[0].copySuggestion!, original },
  };
  const view = render(createElement(Messaging, { ...props, issues: [first] }));
  const panel = view.container.querySelector("[data-active-finding]")!,
    comparison = panel.querySelector("section[aria-label^='Wording option']")!,
    steps = view.getByText("Implementation steps");
  assert.ok(comparison.compareDocumentPosition(steps) & 4);
  assert.equal(comparison.querySelector("blockquote")!.textContent, original);
  const expand = view.getByRole("button", { name: "Read full current copy" });
  assert.equal(expand.getAttribute("aria-expanded"), "false");
  fireEvent.click(expand);
  assert.equal(
    view
      .getByRole("button", { name: "Show less current copy" })
      .getAttribute("aria-expanded"),
    "true",
  );
  assert.equal(comparison.querySelector("blockquote")!.textContent, original);
  fireEvent.click(view.getByRole("button", { name: "Edit draft" }));
  assert.ok(
    document.activeElement ===
      view.getByRole("textbox", { name: /Wording draft/ }),
    "Edit draft focuses the textarea",
  );
});

test("empty and missing metadata states remain distinct from zero, with an actionable assessment disclosure", () => {
  const { props } = setup(),
    view = render(
      createElement(Messaging, {
        ...props,
        analysis: undefined,
        issues: [],
        collectedPages: undefined,
      }),
    );
  assert.ok(view.getByText("Scope not recorded"));
  assert.equal(view.queryByText("0 pages reviewed"), null);
  assert.equal(
    view.queryByRole("meter", { name: "Messaging and copy assessment" }),
    null,
  );
  assert.ok(
    view.getByRole("heading", {
      name: "No supported copy fixes to prioritize in this sample.",
    }),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Review assessment & scope" }),
  );
  const summary = view.getByText("Assessment details");
  assert.equal(summary.closest("details")!.open, true);
  assert.ok(
    document.activeElement === summary.closest("summary"),
    "Assessment action focuses the opened summary",
  );
  view.rerender(
    createElement(Messaging, {
      ...props,
      issues: [],
      analysis: {
        ...props.analysis!,
        criteria: props.analysis!.criteria.map((item) => ({
          ...item,
          score: 0,
        })),
      },
    }),
  );
  assert.equal(
    view
      .getByRole("meter", { name: "Messaging and copy assessment" })
      .getAttribute("aria-valuenow"),
    "0",
  );
});

test("selection, filters, edited wording and disclosure state survive navigation and reset for a new report", () => {
  const { result } = setup(),
    props = { result, generatedFixSteps: {}, onFixStepsLoaded: () => {} };
  const view = render(
    createElement(TabPanel, { ...props, activeTab: "messaging" }),
  );
  fireEvent.click(
    view.getByRole("button", {
      name: `Select finding 2: ${result.messaging[1].title}`,
    }),
  );
  fireEvent.change(view.getByRole("textbox", { name: /Wording draft/ }), {
    target: { value: "Retained across navigation." },
  });
  fireEvent.click(view.getByRole("button", { name: "Medium 1" }));
  fireEvent.click(view.getByText("View source context"));
  assert.equal(
    view.getByText("View source context").closest("details")!.open,
    true,
  );
  view.rerender(createElement(TabPanel, { ...props, activeTab: "seo" }));
  view.rerender(createElement(TabPanel, { ...props, activeTab: "messaging" }));
  assert.ok(view.getByRole("heading", { name: result.messaging[1].title }));
  assert.equal(
    view.getByRole("button", { name: "Medium 1" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: /Wording draft/,
      }) as HTMLTextAreaElement
    ).value,
    "Retained across navigation.",
  );
  assert.equal(
    view.getByText("View source context").closest("details")!.open,
    true,
  );
  view.rerender(
    createElement(TabPanel, {
      ...props,
      result: { ...result, analysisId: "fresh-messaging-audit" },
      activeTab: "messaging",
    }),
  );
  assert.ok(view.getByRole("heading", { name: result.messaging[0].title }));
  assert.equal(
    view.getByRole("button", { name: "All 3" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: /Wording draft/,
      }) as HTMLTextAreaElement
    ).value,
    result.messaging[0].copySuggestion!.replacement,
  );
  assert.equal(
    view.getByText("View source context").closest("details")!.open,
    false,
  );
});

test("a pending clipboard reply cannot announce another finding's draft after selection changes", async () => {
  const { result, props } = setup();
  let resolve!: () => void;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    },
  });
  const view = render(createElement(Messaging, props));
  fireEvent.click(view.getByRole("button", { name: "Copy wording" }));
  fireEvent.click(
    view.getByRole("button", {
      name: `Select finding 2: ${result.messaging[1].title}`,
    }),
  );
  await act(async () => resolve());
  assert.equal(view.queryByText(/Suggested wording copied/), null);
  fireEvent.click(
    view.getByRole("button", {
      name: `Select finding 1: ${result.messaging[0].title}`,
    }),
  );
  assert.equal(view.queryByText(/Suggested wording copied/), null);
});
