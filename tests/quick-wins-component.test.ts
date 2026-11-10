import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  copyWin,
  controlWin,
  controlIssue,
  selection,
  report,
  url,
} from "./quick-wins-fixtures";
import type { QuickWin } from "../src/lib/types";
let Section: typeof import("../src/components/QuickWinsSection").default;
let TabPanel: typeof import("../src/components/TabPanel").default;
before(async () => {
  Section = (await import("../src/components/QuickWinsSection")).default;
  TabPanel = (await import("../src/components/TabPanel")).default;
});
afterEach(cleanup);
const mount = (
  wins: QuickWin[] = [controlWin, copyWin],
  onNavigate?: (
    section: import("../src/components/navigation").ReportSection,
  ) => void,
) =>
  render(
    createElement(Section, {
      quickWins: wins,
      url,
      selection,
      onNavigate,
      findingCounts: { ux: 1, messaging: 1, seo: 0, conversion: 0 },
    }),
  );

test("quick wins explains effort, evidence and manual progress without claiming measured uplift", () => {
  const view = mount();
  assert.ok(view.getByText("Connected to reviewed findings"));
  assert.ok(view.getByText("Expected benefits · not measured results"));
  assert.ok(view.getByText("Low estimated effort"));
  assert.ok(view.getByText("Medium estimated effort"));
  assert.equal(
    view
      .getByRole("progressbar", { name: "Tasks manually marked done" })
      .getAttribute("value"),
    "0",
  );
  assert.ok(view.getByText(/Marking done does not re-test a fix/));
});
test("manual completion is reversible, changes counts and respects status filtering", () => {
  const view = mount();
  fireEvent.click(
    view.getByRole("button", { name: `Mark done: ${copyWin.action}` }),
  );
  assert.equal(
    view
      .getByRole("progressbar", { name: "Tasks manually marked done" })
      .getAttribute("value"),
    "1",
  );
  assert.ok(view.getByText("Marked done · not re-tested"));
  fireEvent.click(view.getByRole("button", { name: "To do 1" }));
  assert.equal(view.queryByRole("heading", { name: copyWin.action }), null);
  assert.ok(view.getByRole("heading", { name: controlWin.action }));
  fireEvent.click(view.getByRole("button", { name: "Marked done 1" }));
  assert.ok(view.getByRole("heading", { name: copyWin.action }));
  fireEvent.click(
    view.getByRole("button", { name: `Mark as to do: ${copyWin.action}` }),
  );
  assert.ok(
    view.getByRole("heading", { name: "No tasks match these filters" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Show all tasks" }));
  assert.ok(view.getByRole("heading", { name: controlWin.action }));
});
test("area filters and priority ordering keep task identity attached to its manual status", () => {
  const view = mount();
  let taskHeadings = view.getAllByRole("heading", { level: 4 });
  assert.equal(taskHeadings[0].textContent, copyWin.action);
  fireEvent.click(
    view.getByRole("button", { name: `Mark done: ${copyWin.action}` }),
  );
  fireEvent.change(view.getByRole("combobox", { name: "Order quick wins" }), {
    target: { value: "priority" },
  });
  taskHeadings = view.getAllByRole("heading", { level: 4 });
  assert.equal(taskHeadings[0].textContent, controlWin.action);
  assert.equal(
    view
      .getByRole("button", { name: `Mark as to do: ${copyWin.action}` })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.change(view.getByLabelText("Quick wins review area"), {target:{value:"ux"}});
  assert.equal(view.queryByRole("heading", { name: copyWin.action }), null);
  assert.ok(view.getByText("1 of 2 tasks shown"));
});
test("tasks expose parent steps and readable HTML observations rather than invented quotations", () => {
  const view = mount([controlWin]);
  assert.ok(view.getByText(controlIssue.title));
  fireEvent.click(view.getByText("View steps & evidence"));
  assert.ok(view.getByText(controlIssue.fixSteps![0].description));
  if (!view.getByText("View steps & evidence").closest("details")?.open) fireEvent.click(view.getByText("View steps & evidence"));
  assert.ok(view.getByText("No name detected in the collected HTML"));
  assert.equal(view.container.querySelector("blockquote"), null);
});
test("copy and download include hidden tasks, sources and actual manual statuses", async (t) => {
  let copied = "",
    exported: Blob | undefined;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    exported = blob as Blob;
    return "blob:quick-wins";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "acorn.example-quick-wins.txt");
    },
  );
  const view = mount();
  fireEvent.click(
    view.getByRole("button", { name: `Mark done: ${copyWin.action}` }),
  );
  fireEvent.change(view.getByLabelText("Quick wins review area"), {target:{value:"ux"}});
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy shortlist" }));
  });
  for (const text of [
    copyWin.action,
    controlWin.action,
    "Marked done by you (not re-tested)",
    "Bread for Saturday collection",
    "No name detected",
    "not a measured duration",
  ])
    assert.ok(copied.includes(text), text);
  fireEvent.click(
    view.getByRole("button", { name: "Download quick wins shortlist" }),
  );
  assert.equal(await exported!.text(), copied);
  await act(async () => {
    fireEvent.click(
      view.getByRole("button", { name: `Copy task: ${controlWin.action}` }),
    );
  });
  assert.ok(copied.includes(controlWin.action));
  assert.equal(copied.includes(copyWin.action), false);
});
test("clipboard denial reports a download alternative without a false success", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy shortlist" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  assert.equal(view.queryByText(/Full shortlist copied/), null);
});
test("related-section navigation and empty-state links go to real report sections", () => {
  const destinations: string[] = [],
    view = mount([controlWin], (section) => destinations.push(section));
  fireEvent.click(
    view.getByRole("button", { name: "Open User experience review" }),
  );
  assert.deepEqual(destinations, ["ux"]);
  view.unmount();
  const empty = mount([], (section) => destinations.push(section));
  assert.ok(
    empty.getByRole("heading", {
      name: "No smaller-effort quick wins were supported in this sample.",
    }),
  );
  fireEvent.click(empty.getByRole("button", { name: "Explore all findings" }));
  assert.deepEqual(destinations, ["ux", "overview"]);
});
test("saved untyped evidence is shown as a saved observation, while larger-effort tasks stay outside the shortlist", () => {
  const saved: QuickWin = {
    action: "Review the saved page label",
    impact: "May clarify the observed action.",
    effort: "Low",
    pageUrl: url,
    evidence: 'Form: {"name":""}',
  };
  const view = mount([saved, { ...copyWin, effort: "High" }]);
  assert.equal(view.queryByRole("heading", { name: copyWin.action }), null);
  if (!view.getByText("View steps & evidence").closest("details")?.open) fireEvent.click(view.getByText("View steps & evidence"));
  assert.ok(view.getByText(/Saved evidence · its type and linked finding/));
  assert.equal(view.container.querySelector("blockquote"), null);
  assert.ok(view.getByText(/This saved suggestion has no linked finding/));
});
test("switching report sections preserves progress and a new audit resets it", () => {
  const result = report();
  const props = { result, generatedFixSteps: {}, onFixStepsLoaded: () => {} };
  const view = render(
    createElement(TabPanel, { ...props, activeTab: "quickwins" }),
  );
  fireEvent.click(
    view.getByRole("button", { name: `Mark done: ${copyWin.action}` }),
  );
  view.rerender(createElement(TabPanel, { ...props, activeTab: "overview" }));
  assert.equal(
    view.queryByRole("button", { name: `Mark as to do: ${copyWin.action}` }),
    null,
  );
  view.rerender(createElement(TabPanel, { ...props, activeTab: "quickwins" }));
  assert.equal(
    view
      .getByRole("button", { name: `Mark as to do: ${copyWin.action}` })
      .getAttribute("aria-pressed"),
    "true",
  );
  view.rerender(
    createElement(TabPanel, {
      ...props,
      result: report("audit-two"),
      activeTab: "quickwins",
    }),
  );
  assert.equal(
    view
      .getByRole("button", { name: `Mark done: ${copyWin.action}` })
      .getAttribute("aria-pressed"),
    "false",
  );
});
