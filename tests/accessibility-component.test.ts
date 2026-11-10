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
import type { AccessibilityAudit } from "../src/lib/types";
import {
  audit,
  readyAudit,
  payload,
  url,
  pages,
} from "./accessibility-fixtures";
import { buildAccessibilityAudit } from "../src/lib/server/accessibility";
let Section: typeof import("../src/components/AccessibilitySection").default;
before(async () => {
  Section = (await import("../src/components/AccessibilitySection")).default;
});
afterEach(cleanup);
const mount = (data: AccessibilityAudit = audit) =>
  render(createElement(Section, { audit: data, url }));
const openChecks = (view: ReturnType<typeof mount>) => {
  fireEvent.click(
    view.getByRole("button", { name: "Page checks" }),
  );
  return within(view.getByRole("region", { name: "Page checks" }));
};
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("accessibility displays nine evidence checks and separates manual testing from HTML observations", () => {
  const view = mount();
  assert.ok(view.getByRole("region", { name: "Prioritized review tasks" }));
  assert.equal(view.queryByRole("region", { name: "Page checks" }), null);
  assert.ok(view.getByText("Requires browser testing"));
  assert.equal(view.queryByRole("meter"), null);
  const signals = openChecks(view);
  assert.ok(signals.getByText("9 of 9 scoped checks shown"));
  assert.equal(signals.getAllByRole("heading", { level: 4 }).length, 9);
  assert.ok(signals.getByRole("heading", { name: /Form field labels/ }));
  assert.ok(view.getByText("Contrast & visual states"));
});

test("status and page filters use the selected page's own observations", () => {
  const view = mount();
  const checks = openChecks(view);
  const status = checks.getByRole("combobox", { name: "Check status" });
  fireEvent.change(status, { target: { value: "review" } });
  assert.ok(checks.getByText("5 of 9 scoped checks shown"));
  fireEvent.change(checks.getByRole("combobox", { name: "Page to inspect" }), {
    target: { value: `${url}about` },
  });
  assert.ok(checks.getByText("9 of 9 scoped checks shown"));
  assert.equal(checks.queryByText(/source: placeholder only/), null);
  fireEvent.change(status, { target: { value: "review" } });
  assert.ok(checks.getByText("No checks match this status"));
  fireEvent.click(checks.getByRole("button", { name: "Reset status filter" }));
  assert.equal(document.activeElement, status);
});

test("prioritized tasks expose practical steps, evidence and the human verification requirement", () => {
  const view = mount();
  const plan = within(
    view.getByRole("region", { name: "Prioritized review tasks" }),
  );
  assert.ok(
    plan.getByRole("heading", { name: "Form field labels" }),
  );
  fireEvent.change(plan.getByLabelText("Review area"), {
    target: { value: "forms" },
  });
  assert.ok(plan.getByText("1 of 5 review tasks match"));
  assert.ok(plan.getByText("Provide an appropriate persistent name"));
  assert.ok(plan.getByRole("heading", { name: "How to verify in a browser" }));
  fireEvent.click(plan.getByRole("button", { name: "Inspect source check" }));
  const checks = within(view.getByRole("region", { name: "Page checks" }));
  const field = checks.getByRole("button", {
    name: /Form field labels Review/,
  });
  assert.equal(field.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, field);
  fireEvent.click(checks.getByRole("button", { name: "View review steps" }));
  assert.equal(
    document.activeElement,
    plan.getByRole("heading", { name: "Form field labels" }),
  );
});

test("copy exports every page, filtered-out tasks and manual testing without form-field values", async () => {
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
  fireEvent.change(view.getByLabelText("Review area"), {
    target: { value: "forms" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy review plan" }));
  });
  for (const value of [
    "Image alternatives",
    "Form field labels",
    `${url}about`,
    "Screen-reader names",
    "NOT TESTED",
  ])
    assert.ok(text.includes(value), value);
  assert.equal(text.includes("PRIVATE_VALUE"), false);
  assert.ok(view.getByText("Accessibility review plan copied."));
});

test("downloads contain actual evidence and clipboard denial offers a truthful alternative", async (t) => {
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
    return "blob:accessibility";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "bakery.example-accessibility-review.txt");
    },
  );
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy review plan" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  fireEvent.click(
    view.getByRole("button", { name: "Download review plan (.txt)" }),
  );
  assert.ok((await blob!.text()).includes("OBSERVATIONS AND SOURCE EVIDENCE"));
});

test("older reports automatically load fresh accessibility results rather than a scope-only dead end", async (t) => {
  const pending = deferred();
  let updated = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(input, "/api/accessibility-checks");
      assert.equal(init?.cache, "no-store");
      return pending.promise;
    },
  );
  const view = render(
    createElement(Section, {
      audit: { ...audit, overallScore: 100, review: undefined },
      url,
      onAccessibilityUpdated: () => {
        updated++;
      },
    }),
  );
  assert.ok(view.getByText(/Collecting public page HTML/));
  assert.equal(
    view.queryByRole("button", { name: "Download review plan (.txt)" }),
    null,
  );
  await act(async () => {
    pending.resolve(Response.json(payload()));
  });
  await waitFor(() =>
    assert.ok(view.getByRole("region", { name: "Prioritized review tasks" })),
  );
  assert.equal(updated, 1);
  assert.equal(view.queryByText("100"), null);
});

test("failed collection can be retried and incomplete refreshes retain last collected results", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++calls === 1
      ? Response.json({ error: "Page unavailable" }, { status: 422 })
      : calls === 2
        ? Response.json(payload())
        : Response.json({ audit: {} }),
  );
  const view = mount({ ...audit, review: undefined });
  await waitFor(() => assert.ok(view.getByRole("alert")));
  fireEvent.click(
    view.getByRole("button", { name: "Retry accessibility checks" }),
  );
  await waitFor(() =>
    assert.ok(view.getByRole("region", { name: "Prioritized review tasks" })),
  );
  fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  await waitFor(() => assert.ok(view.getByRole("alert")));
  assert.ok(view.getByRole("region", { name: "Prioritized review tasks" }));
  assert.ok(view.getByText("Your last collected results are still shown."));
});

test("refresh preserves existing observations while pending and an unmounted request cannot overwrite another report", async (t) => {
  const pending = deferred();
  let signal: AbortSignal | undefined,
    updated = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return pending.promise;
    },
  );
  const view = render(
    createElement(Section, {
      audit,
      url,
      onAccessibilityUpdated: () => {
        updated = true;
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  assert.ok(view.getByRole("region", { name: "Prioritized review tasks" }));
  assert.ok(
    (
      view.getByRole("button", {
        name: "Refreshing checks…",
      }) as HTMLButtonElement
    ).disabled,
  );
  view.unmount();
  assert.equal(signal?.aborted, true);
  await act(async () => {
    pending.resolve(Response.json(payload(readyAudit)));
  });
  assert.equal(updated, false);
});

test("no HTML review tasks is not presented as WCAG conformance or a completed manual test", () => {
  const view = render(
    createElement(Section, { audit: readyAudit, url: `${url}about` }),
  );
  assert.ok(
    view.getByRole("heading", {
      name: "No review tasks in the collected sample",
    }),
  );
  assert.ok(view.getByText("Requires browser testing"));
  assert.equal(view.queryByRole("meter"), null);
  fireEvent.click(view.getByRole("button", { name: "Open page checks" }));
  assert.equal(document.activeElement, view.getByRole("heading", { name: "Page checks" }));
});

test("partial and sampled coverage keep unavailable checks separate from inspected HTML", () => {
  const [first, second] = structuredClone(pages);
  first.accessibilitySnapshot!.sampled = true;
  delete second.accessibilitySnapshot;
  const view = mount(buildAccessibilityAudit([first, second]));
  assert.ok(view.getByText("of 2 in scope"));
  assert.ok(view.getByText("Some observations are sampled."));
  const checks = openChecks(view);
  assert.ok(checks.getByText("Sampled evidence"));
  fireEvent.change(checks.getByLabelText("Page to inspect"), {
    target: { value: second.url },
  });
  assert.ok(checks.getByText(/Detailed HTML evidence is unavailable/));
  assert.equal(
    checks.getAllByRole("button", { name: /Not assessed/ }).length,
    9,
  );
  assert.equal(checks.queryByText("Sampled evidence"), null);
});

test("a hidden legacy workspace defers collection and resumes after cancellation on leave", async (t) => {
  const first = deferred();
  const second = deferred();
  const requests: AbortSignal[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    (_input: RequestInfo | URL, init: RequestInit) => {
      requests.push(init.signal!);
      return requests.length === 1 ? first.promise : second.promise;
    },
  );
  const onAccessibilityUpdated = t.mock.fn();
  const element = (active: boolean) =>
    createElement(Section, { active, url, onAccessibilityUpdated });
  const view = render(element(false));
  await act(async () => {});
  assert.equal(requests.length, 0);
  await act(async () => view.rerender(element(true)));
  assert.equal(requests.length, 1);
  view.rerender(element(false));
  assert.equal(requests[0].aborted, true);
  await act(async () => view.rerender(element(true)));
  await act(async () => {
    first.resolve(Response.json(payload()));
  });
  assert.equal(requests.length, 2);
  assert.equal(onAccessibilityUpdated.mock.callCount(), 0);
  await act(async () => {
    second.resolve(Response.json(payload()));
  });
  assert.equal(onAccessibilityUpdated.mock.callCount(), 1);
});

test("client timeout retains the snapshot and does not retry on section re-entry", async (t) => {
  const timeout = new AbortController();
  t.mock.method(AbortSignal, "timeout", () => timeout.signal);
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener(
          "abort",
          () => reject(init.signal!.reason),
          { once: true },
        );
      });
    },
  );
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  await act(async () =>
    timeout.abort(new DOMException("Timeout", "TimeoutError")),
  );
  assert.match(
    view.getByRole("alert").textContent!,
    /took longer than expected/,
  );
  assert.ok(view.getByRole("region", { name: "Prioritized review tasks" }));
  view.rerender(createElement(Section, { active: false, audit, url }));
  view.rerender(createElement(Section, { active: true, audit, url }));
  await act(async () => {});
  assert.equal(fetch.mock.callCount(), 1);
});
