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
import type { SecurityAudit } from "../src/lib/types";
import { audit, readyAudit, url } from "./security-fixtures";
import { securityRefreshSchema } from "../src/lib/security-refresh";
import {
  securityCheckIdentity,
  securityPlan,
  securityStepKey,
} from "../src/lib/security-presentation";
import { dashboardFixture } from "./dashboard-fixtures";
import { dashboardModel } from "../src/lib/dashboard";
let Section: typeof import("../src/components/SecuritySection").default;
let TabPanel: typeof import("../src/components/TabPanel").default;
let PrintReport: typeof import("../src/components/PrintReport").default;
before(async () => {
  Section = (await import("../src/components/SecuritySection")).default;
  TabPanel = (await import("../src/components/TabPanel")).default;
  PrintReport = (await import("../src/components/PrintReport")).default;
});
afterEach(cleanup);
const mount = (data: SecurityAudit | undefined = audit) =>
  render(createElement(Section, { audit: data, url, generatedFixSteps: {} }));
const showSignals = (view: ReturnType<typeof mount>) => {
  fireEvent.click(view.getByRole("button", { name: "Page signals" }));
  return within(view.getByRole("region", { name: "Page signals" }));
};

test("security presents scoped observations and evidence rather than a fabricated security score", () => {
  const view = mount();
  assert.ok(view.getByRole("heading", { name: "Configuration review plan" }));
  assert.ok(view.getByText("Results collected"));
  assert.equal(view.queryByRole("meter"), null);
  assert.ok(view.getByText("18"));
  const signals = showSignals(view);
  assert.ok(signals.getByText("9 of 9 signals shown"));
  assert.ok(signals.getByRole("heading", { name: "Content Security Policy" }));
  assert.ok(
    signals.getByRole("heading", { name: "Response cookie attributes" }),
  );
  assert.equal(view.queryByText("Cookie consent behavior"), null);
});

test("signal filtering separates review tasks from observed declarations", () => {
  const view = mount();
  const signals = showSignals(view);
  fireEvent.click(
    signals.getByRole("checkbox", { name: "Has review steps 5" }),
  );
  assert.ok(signals.getByText("5 of 9 signals shown"));
  assert.equal(
    signals.queryByRole("heading", { name: "Page connection" }),
    null,
  );
  assert.ok(signals.getByRole("heading", { name: "Content Security Policy" }));
  const absentWithSteps = signals
    .getByRole("heading", { name: "Content-type sniffing control" })
    .closest("li")!;
  assert.ok(within(absentWithSteps).getByText("Not observed"));
  assert.ok(
    within(absentWithSteps).getByRole("button", { name: "View review steps" }),
  );
  fireEvent.click(
    signals.getByRole("button", { name: "Clear signal filters" }),
  );
  fireEvent.click(signals.getByRole("button", { name: "Observed 3" }));
  assert.ok(signals.getByText("3 of 9 signals shown"));
  assert.ok(signals.getByRole("heading", { name: "Page connection" }));
  assert.equal(
    signals.queryByRole("heading", { name: "Content Security Policy" }),
    null,
  );
});

test("page selection uses that page's collected evidence and resets the signal filter", () => {
  const view = mount();
  const signals = showSignals(view);
  fireEvent.click(
    signals.getByRole("checkbox", { name: "Has review steps 5" }),
  );
  fireEvent.change(
    signals.getByRole("combobox", { name: "Collected security page" }),
    { target: { value: `${url}about` } },
  );
  assert.ok(signals.getAllByText("Response headers not collected").length);
  assert.ok(signals.getByText("9 of 9 signals shown"));
  assert.equal(signals.queryByText("default-src 'self'"), null);
  fireEvent.click(
    signals.getByRole("checkbox", { name: "Has review steps 0" }),
  );
  assert.ok(view.getByText("No signals match these filters"));
});

test("review tasks are prioritized, filterable and retain deterministic implementation steps", () => {
  const view = mount();
  const plan = within(
    view.getByRole("region", { name: "Configuration review plan" }),
  );
  const headings = plan.getAllByRole("heading", { level: 4 });
  assert.equal(headings[0].textContent, "HTTP resource references");
  assert.equal(headings.length, 1);
  fireEvent.change(plan.getByLabelText("Review area"), {
    target: { value: "cookies" },
  });
  assert.ok(view.getByText("1 of 5 reviews match these filters"));
  assert.ok(plan.getByRole("heading", { name: "Response cookie attributes" }));
  fireEvent.click(plan.getByText("How to verify the change"));
  assert.ok(
    plan.getByRole("heading", {
      name: "Confirm cross-site cookie requirements",
    }),
  );
});

test("a signal's review link restores hidden tasks before targeting the review steps", () => {
  const view = mount();
  fireEvent.change(view.getByLabelText("Review area"), {
    target: { value: "cookies" },
  });
  const signals = showSignals(view);
  const card = signals
    .getByRole("heading", { name: "HTTP resource references" })
    .closest("li")!;
  fireEvent.click(
    within(card).getByRole("button", { name: "View review steps" }),
  );
  assert.ok(view.getByRole("heading", { name: "HTTP resource references" }));
  assert.equal(
    (view.getByLabelText("Review area") as HTMLSelectElement).value,
    "",
  );
  assert.equal(
    document.activeElement?.getAttribute("data-active-security-task"),
    "assets",
  );
  fireEvent.click(view.getByRole("button", { name: "Inspect source signal" }));
  assert.equal(
    document.activeElement?.textContent,
    "HTTP resource references evidence",
  );
});

test("copy retains every page, hidden review tasks and their actual evidence without cookie values", async () => {
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  const view = mount();
  fireEvent.change(view.getByLabelText("Review area"), {
    target: { value: "cookies" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy security plan" }));
  });
  for (const text of [
    "Content Security Policy",
    "HTTP resource references",
    `${url}about`,
    "max-age=0",
    "NOT TESTED",
    "not confirmed network requests",
  ])
    assert.ok(copied.includes(text), text);
  for (const secret of [
    "PRIVATE_COOKIE_VALUE",
    "PRIVATE_COOKIE_NAME",
    "PRIVATE_ASSET_TOKEN",
  ])
    assert.equal(copied.includes(secret), false, secret);
  assert.ok(view.getByText(/Security plan copied/));
});

test("download contains the real scoped plan and clipboard denial does not claim success", async (t) => {
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
    return "blob:security-review";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "bakery.example-security-review.txt");
    },
  );
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy security plan" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  assert.equal(view.queryByText(/has been copied/), null);
  fireEvent.click(
    view.getByRole("button", { name: "Download security plan (.txt)" }),
  );
  const text = await exported!.text();
  assert.ok(text.includes("SameSite=None without Secure: 1"));
  assert.ok(text.includes("No overall security score"));
  assert.ok(text.includes("NOT TESTED"));
});

test("no additional actions does not become a security clearance and scope still exports", () => {
  const view = mount(readyAudit);
  assert.ok(
    view.getByRole("heading", {
      name: "No configuration reviews in this sample",
    }),
  );
  assert.ok(view.getByRole("button", { name: "Inspect page signals" }));
  assert.equal(view.queryByText(/No issues detected/), null);
  assert.ok(
    view.getByRole("button", { name: "Download security plan (.txt)" }),
  );
});

const payload = (data = audit) =>
  securityRefreshSchema.parse({
    requestedUrl: url,
    url,
    checkedAt: "2026-11-07T12:00:00.000Z",
    audit: {
      ...data,
      requestedUrl: url,
      checkedAt: "2026-11-07T12:00:00.000Z",
    },
  });
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test("an earlier report automatically collects and displays real security results without a full AI rerun", async (t) => {
  const pending = deferred();
  const requests: RequestInit[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(input, "/api/security-checks");
      requests.push(init!);
      return pending.promise;
    },
  );
  let updated = 0;
  const view = render(
    createElement(Section, {
      audit: { ...audit, overallScore: 100, review: undefined },
      url,
      generatedFixSteps: {},
      onSecurityUpdated: () => {
        updated++;
      },
    }),
  );
  assert.ok(view.getByText("Checking your website’s security signals"));
  assert.equal(
    view.queryByRole("button", { name: "Download review scope" }),
    null,
  );
  assert.equal(view.queryByRole("meter"), null);
  assert.equal(view.queryByText("100"), null);
  await waitFor(() => assert.equal(requests.length, 1));
  assert.equal(requests[0].method, "POST");
  assert.deepEqual(JSON.parse(requests[0].body as string), { url });
  assert.equal(requests[0].cache, "no-store");
  await act(async () => {
    pending.resolve(Response.json(payload()));
  });
  await waitFor(() => assert.ok(view.getByText("Results collected")));
  assert.equal(updated, 1);
  assert.equal(
    view.queryByText("Checking your website’s security signals"),
    null,
  );
  assert.ok(
    view.getByRole("button", { name: "Download security plan (.txt)" }),
  );
});

test("a failed initial security collection offers retry and then displays the successful results", async (t) => {
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++attempts === 1
      ? Response.json(
          { error: "The website could not be read." },
          { status: 422 },
        )
      : Response.json(payload()),
  );
  const view = mount({ ...audit, review: undefined });
  await waitFor(() => assert.ok(view.getByRole("alert")));
  assert.ok(view.getByText("The website could not be read."));
  assert.equal(
    view.queryByRole("button", { name: "Download security plan (.txt)" }),
    null,
  );
  fireEvent.click(view.getByRole("button", { name: "Retry security checks" }));
  await waitFor(() => assert.ok(view.getByText("Results collected")));
  assert.equal(attempts, 2);
  assert.equal(view.queryByRole("alert"), null);
});

test("manual refresh retains old results during collection and replaces them with the new evidence", async (t) => {
  const pending = deferred();
  t.mock.method(globalThis, "fetch", async () => pending.promise);
  const view = mount();
  const signals = showSignals(view);
  fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  assert.ok(signals.getByText("9 of 9 signals shown"));
  assert.ok(
    (
      view.getByRole("button", {
        name: "Refreshing checks…",
      }) as HTMLButtonElement
    ).disabled,
  );
  await act(async () => {
    pending.resolve(Response.json(payload(readyAudit)));
  });
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "Review plan 0" })),
  );
  assert.ok(view.getByRole("region", { name: "Page signals" }));
  assert.ok(view.getByRole("button", { name: "Refresh checks" }));
});

test("an incomplete refresh response cannot erase a previously collected report", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ requestedUrl: url, audit: { review: { pages: [] } } }),
  );
  const view = mount();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  });
  assert.ok(view.getByRole("alert"));
  assert.ok(view.getByText(/response was incomplete/));
  assert.ok(view.getByRole("heading", { name: "HTTP resource references" }));
  assert.ok(
    view.getByText("Your last collected results are still shown below."),
  );
});

test("unmount aborts collection and a late response cannot update a different report", async (t) => {
  const pending = deferred();
  let signal: AbortSignal | undefined;
  let updated = false;
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
      audit: undefined,
      url,
      generatedFixSteps: {},
      onSecurityUpdated: () => {
        updated = true;
      },
    }),
  );
  assert.ok(view.getByText("Checking your website’s security signals"));
  await act(async () => {});
  assert.ok(signal);
  view.unmount();
  assert.equal(signal?.aborted, true);
  await act(async () => {
    pending.resolve(Response.json(payload()));
  });
  assert.equal(updated, false);
});

test("exact check identity survives query variants, same titles, and refreshed page ordering", async (t) => {
  const snapshot = structuredClone(audit);
  const review = snapshot.review!;
  const [first, about] = review.pages;
  const archive = structuredClone(first);
  archive.url = `${url}?edition=archive`;
  archive.title = "Archived collection";
  archive.checks = archive.checks.map((check) => ({
    ...check,
    id: `archive-${check.id}`,
    pageUrl: archive.url,
  }));
  const csp = archive.checks.find((check) => check.key === "csp")!;
  csp.observations.push({
    label: "Archive response sample",
    value: "Archive-specific observation",
  });
  review.pages = [first, archive, about];
  review.scope = {
    pages: 3,
    checks: 27,
    headersCollected: 2,
    actions: 10,
    sampled: false,
  };
  const saved = {
    [securityStepKey(csp)]: [
      {
        title: "Archive-specific step",
        description: "Check the archived response.",
      },
    ],
    [csp.title]: [
      { title: "Unscoped step", description: "A different page's suggestion." },
    ],
  };
  const updated = structuredClone(snapshot);
  updated.review!.pages = [first, about, archive].map((page, index) => ({
    ...page,
    checks: page.checks.map((check) => ({
      ...check,
      id: `security-${index + 1}-${check.key}`,
    })),
  }));
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(payload(updated)),
  );
  const view = render(
    createElement(Section, { audit: snapshot, url, generatedFixSteps: saved }),
  );
  fireEvent.change(view.getByLabelText("Select a review task"), {
    target: { value: securityCheckIdentity(csp) },
  });
  assert.ok(view.getByRole("heading", { name: "Archive-specific step" }));
  assert.equal(view.queryByRole("heading", { name: "Unscoped step" }), null);
  fireEvent.click(view.getByRole("button", { name: "Inspect source signal" }));
  const signals = within(view.getByRole("region", { name: "Page signals" }));
  const picker = signals.getByRole("combobox", {
    name: "Collected security page",
  }) as HTMLSelectElement;
  assert.equal(picker.value, archive.url);
  assert.ok(signals.getByText("Archive-specific observation"));
  assert.equal(
    document.activeElement?.textContent,
    "Content Security Policy evidence",
  );
  fireEvent.click(signals.getByRole("button", { name: "Review 4" }));
  fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  await waitFor(() => assert.ok(view.getByText(/Security refresh ·/)));
  assert.equal(picker.value, archive.url);
  assert.equal(
    signals
      .getByRole("button", { name: "Review 4" })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(signals.getByText("Archive-specific observation"));
  fireEvent.click(
    within(
      signals
        .getByRole("heading", { name: "Content Security Policy" })
        .closest("li")!,
    ).getByRole("button", { name: "View review steps" }),
  );
  assert.ok(view.getByRole("heading", { name: "Archive-specific step" }));
  const text = securityPlan(snapshot, url, saved);
  assert.ok(text.includes("Archive-specific step"));
  assert.ok(!text.includes("Unscoped step"));
  const changed = {
    ...csp,
    observations: [{ label: "Policy", value: "Changed response" }],
  };
  assert.notEqual(securityStepKey(changed), securityStepKey(csp));
});

test("hidden Security checks does not collect and the same report retains its selected signal", async (t) => {
  const result = dashboardFixture();
  result.securityAudit = audit;
  const network = t.mock.method(globalThis, "fetch", async () =>
    Response.json(payload()),
  );
  const props = { result, generatedFixSteps: {}, onFixStepsLoaded: () => {} };
  const view = render(createElement(TabPanel, { ...props, activeTab: "ux" }));
  await act(async () => {});
  assert.equal(network.mock.callCount(), 0);
  view.rerender(createElement(TabPanel, { ...props, activeTab: "security" }));
  const signals = showSignals(view);
  fireEvent.change(
    signals.getByRole("combobox", { name: "Collected security page" }),
    { target: { value: `${url}about` } },
  );
  const row = signals
    .getByRole("heading", { name: "Content Security Policy" })
    .closest("li")!;
  fireEvent.click(within(row).getByRole("button", { name: "View evidence" }));
  view.rerender(createElement(TabPanel, { ...props, activeTab: "ux" }));
  view.rerender(createElement(TabPanel, { ...props, activeTab: "security" }));
  assert.equal(
    (
      signals.getByRole("combobox", {
        name: "Collected security page",
      }) as HTMLSelectElement
    ).value,
    `${url}about`,
  );
  assert.ok(
    signals.getByRole("heading", { name: "Content Security Policy evidence" }),
  );
  assert.equal(network.mock.callCount(), 0);
  const fresh = {
    ...result,
    analysisId: "new-security-report",
    securityAudit: undefined,
  };
  view.rerender(
    createElement(TabPanel, { ...props, result: fresh, activeTab: "ux" }),
  );
  await act(async () => {});
  assert.equal(network.mock.callCount(), 0);
  view.rerender(
    createElement(TabPanel, { ...props, result: fresh, activeTab: "security" }),
  );
  await waitFor(() => assert.equal(network.mock.callCount(), 1));
  await waitFor(() =>
    assert.ok(view.getByRole("region", { name: "Configuration review plan" })),
  );
  assert.equal(view.queryByRole("region", { name: "Page signals" }), null);
});

test("a timeout keeps the last snapshot and offers retry", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Deadline reached", "TimeoutError");
  });
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Refresh checks" }));
  await waitFor(() =>
    assert.match(
      view.getByRole("alert").textContent!,
      /took longer than expected/,
    ),
  );
  assert.ok(view.getByText(/Last successful collection ·/));
  assert.ok(view.getByRole("button", { name: "Retry security checks" }));
  assert.ok(
    view.getByRole("button", { name: "Download security plan (.txt)" }),
  );
});

test("leaving the hidden workspace aborts collection and returning after a failure waits for retry", async (t) => {
  const pending = deferred();
  const signals: AbortSignal[] = [];
  let updates = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, options?: RequestInit) => {
      signals.push(options!.signal as AbortSignal);
      return signals.length === 1
        ? pending.promise
        : Response.json(
            { error: "The website could not be read." },
            { status: 422 },
          );
    },
  );
  const props = {
    url,
    generatedFixSteps: {},
    onSecurityUpdated: () => {
      updates++;
    },
  };
  const view = render(createElement(Section, { ...props, active: true }));
  await act(async () => {});
  assert.equal(signals.length, 1);
  view.rerender(createElement(Section, { ...props, active: false }));
  assert.equal(signals[0].aborted, true);
  await act(async () => {
    pending.resolve(Response.json(payload()));
  });
  assert.equal(updates, 0);
  view.rerender(createElement(Section, { ...props, active: true }));
  await act(async () => {});
  assert.equal(signals.length, 2);
  assert.ok(view.getByRole("alert"));
  view.rerender(createElement(Section, { ...props, active: false }));
  view.rerender(createElement(Section, { ...props, active: true }));
  await act(async () => {});
  assert.equal(signals.length, 2);
  assert.ok(view.getByRole("button", { name: "Retry security checks" }));
});

test("print and dashboard use the same validated snapshot, including zero-task and legacy states", () => {
  const result = dashboardFixture();
  result.securityAudit = readyAudit;
  assert.equal(
    dashboardModel(result).checks.find((check) => check.key === "security")
      ?.available,
    true,
  );
  const view = render(
    createElement(PrintReport, { result, generatedFixSteps: {} }),
  );
  const text = securityPlan(readyAudit, result.url);
  assert.ok(text.includes("Configuration reviews: 0"));
  assert.ok(
    [...view.container.querySelectorAll("pre")].some(
      (item) => item.textContent === text,
    ),
  );
  const legacy = {
    ...result,
    securityAudit: { ...audit, requestedUrl: `${url}unrelated` },
  };
  view.rerender(
    createElement(PrintReport, { result: legacy, generatedFixSteps: {} }),
  );
  assert.equal(
    dashboardModel(legacy).checks.find((check) => check.key === "security")
      ?.available,
    false,
  );
  assert.ok(view.getByText(/Collection scope only/));
  assert.equal(view.queryByText(/PRIORITIZED CONFIGURATION REVIEWS/), null);
});
