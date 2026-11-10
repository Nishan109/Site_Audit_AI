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
import type { PageSpeedReport } from "../src/lib/pagespeed";
import { pageSpeedPlan } from "../src/lib/pagespeed-presentation";
import { parsePageSpeed } from "../src/lib/pagespeed-measurement";
import { payload, report, url } from "./pagespeed-fixtures";
let Section: typeof import("../src/components/PageSpeedSection").default;
before(async () => {
  Section = (await import("../src/components/PageSpeedSection")).default;
});
afterEach(cleanup);
const mount = (data?: PageSpeedReport) =>
  render(
    createElement(Section, {
      url,
      reports: data ? { [data.strategy]: data } : undefined,
    }),
  );
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("an unmeasured page offers device selection and a real Google link without invented grades or metrics", () => {
  const view = mount();
  assert.ok(view.getByRole("button", { name: "Test mobile" }));
  assert.equal(view.queryByRole("meter"), null);
  const target = new URL(
    view
      .getByRole("link", { name: "Open in PageSpeed Insights" })
      .getAttribute("href")!,
  );
  assert.equal(target.hostname, "pagespeed.web.dev");
  assert.equal(target.searchParams.get("url"), url);
  assert.equal(target.searchParams.get("form_factor"), "mobile");
  assert.equal(
    view.queryByRole("button", { name: "Download results (.txt)" }),
    null,
  );
});

test("a genuine response separates field metrics from the lab run and preserves precise INP units", () => {
  const view = mount(report());
  assert.equal(
    view
      .getByRole("meter", { name: "Mobile Lighthouse performance score" })
      .getAttribute("aria-valuenow"),
    "82",
  );
  fireEvent.click(view.getByRole("button", { name: "Real-user data" }));
  const field = within(view.getByRole("region", { name: "Real-user data" }));
  assert.ok(field.getByText("190 ms"));
  assert.ok(field.getByText("2.30 s"));
  assert.ok(field.getByText("0.08"));
  fireEvent.click(view.getByRole("button", { name: "Lab measurements" }));
  const lab = within(view.getByRole("region", { name: "Lab measurements" }));
  assert.ok(lab.getByText("3.10 s"));
  assert.ok(lab.getByText("350 ms"));
  assert.ok(lab.getByText(/Total Blocking Time measures lab blocking/));
});

test("missing field data remains neutral and a lab score cannot create a Core Web Vitals pass", () => {
  const data = report();
  data.field = {
    ...data.field,
    scope: "unavailable",
    id: null,
    assessment: "unavailable",
    ...Object.fromEntries(
      ["lcp", "cls", "inp", "fcp", "ttfb"].map((key) => [
        key,
        { value: null, unit: key === "cls" ? "" : "ms", rating: "unavailable" },
      ]),
    ),
  };
  const view = mount(data);
  assert.ok(view.getByText("Core Web Vitals assessment is unavailable."));
  assert.ok(view.getByText("No field data supplied"));
  fireEvent.click(view.getByRole("button", { name: "Real-user data" }));
  const field = within(view.getByRole("region", { name: "Real-user data" }));
  assert.equal(field.queryByText("Poor"), null);
  assert.equal(field.queryByText(/in the good range/), null);
  assert.ok(field.getByText("Real-user measurements are unavailable."));
  assert.equal(field.queryAllByRole("article").length, 0);
});

test("origin-level field data is clearly distinguished from this page's lab test", () => {
  const data = report();
  data.field.scope = "origin";
  data.field.id = "https://bakery.example";
  const view = mount(data);
  assert.ok(view.getByText("Origin-level data"));
  fireEvent.click(view.getByRole("button", { name: "Real-user data" }));
  assert.ok(
    view.getByText(/These results cover the origin, not just this page/),
  );
});

test("request failure replaces the idle card with actionable quota recovery and no duplicate run prompt", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        error: "Google temporarily limited PageSpeed requests.",
        code: "PAGESPEED_QUOTA",
        keyConfigured: false,
      },
      { status: 429 },
    ),
  );
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Test mobile" }));
  await waitFor(() => assert.ok(view.getByRole("alert")));
  assert.ok(view.getByText("Google’s request limit paused this test."));
  assert.equal(view.queryByText("Your mobile test is ready."), null);
  assert.equal(view.queryByRole("meter"), null);
  assert.ok(view.getByRole("button", { name: "Retry mobile" }));
  assert.ok(view.getByRole("link", { name: "Open in PageSpeed Insights" }));
  assert.ok(view.getByText(/Configure the server’s PAGESPEED_API_KEY/));
});

test("server retry-after instructions disable retries across devices until the requested delay", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json(
      {
        error: "Google temporarily limited requests.",
        code: "PAGESPEED_QUOTA",
        retryAfterSeconds: 60,
      },
      { status: 429 },
    );
  });
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Test mobile" }));
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "Retry in 60s" })),
  );
  assert.ok(
    (view.getByRole("button", { name: "Retry in 60s" }) as HTMLButtonElement)
      .disabled,
  );
  fireEvent.click(view.getByRole("button", { name: "Desktop" }));
  fireEvent.click(view.getByRole("button", { name: "Retry in 60s" }));
  assert.equal(calls, 1);
});

test("Lighthouse import works during a Google cooldown and preserves lab provenance in exports", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { code: "PAGESPEED_QUOTA", retryAfterSeconds: 60, keyConfigured: false },
      { status: 429 },
    ),
  );
  const onUpdated = t.mock.fn<(value: PageSpeedReport) => void>();
  const view = render(createElement(Section, { url, onUpdated }));
  fireEvent.click(view.getByRole("button", { name: "Test mobile" }));
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "Retry in 60s" })),
  );
  assert.ok(view.getByText("Measure with Chrome Lighthouse"));
  const input = view.getByLabelText("Lighthouse JSON file");
  fireEvent.change(input, {
    target: {
      files: [
        {
          size: 100,
          text: async () => JSON.stringify(payload.lighthouseResult),
        },
      ],
    },
  });
  await waitFor(() => assert.ok(view.getByText("Imported Lighthouse JSON")));
  assert.equal(fetch.mock.callCount(), 1);
  const imported = onUpdated.mock.calls[0].arguments[0];
  assert.equal(imported.performanceScore, 82);
  assert.match(
    pageSpeedPlan([imported]),
    /Source: Imported Lighthouse JSON \(lab only\)/,
  );
  assert.equal(imported.field.inp.value, null);
  fireEvent.change(input, {
    target: { files: [{ size: 100, text: async () => "not JSON" }] },
  });
  await waitFor(() =>
    assert.ok(view.getByText("Choose a valid Lighthouse JSON report.")),
  );
  assert.equal(onUpdated.mock.callCount(), 1);
  assert.ok(view.getByRole("meter"));
});

test("failed reruns retain the original result and its timestamp without claiming a refresh", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: "Google is unavailable.", code: "PAGESPEED_UNAVAILABLE" },
      { status: 502 },
    ),
  );
  const view = mount(report());
  fireEvent.click(view.getByRole("button", { name: "Retest mobile" }));
  await waitFor(() => assert.ok(view.getByRole("alert")));
  assert.equal(
    view
      .getByRole("meter", { name: "Mobile Lighthouse performance score" })
      .getAttribute("aria-valuenow"),
    "82",
  );
  assert.ok(view.getByText(/earlier mobile result remains available/));
  assert.ok(view.getByText("Previous result"));
});

test("device requests and cached results stay independent and can be revisited without an extra request", async (t) => {
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      const { strategy } = JSON.parse(init?.body as string);
      assert.equal(strategy, "desktop");
      assert.equal(init?.cache, "no-store");
      const result = report("desktop");
      result.performanceScore = 94;
      return Response.json(result);
    },
  );
  let updated: PageSpeedReport | undefined;
  const view = render(
    createElement(Section, {
      url,
      reports: { mobile: report() },
      onUpdated: (value) => {
        updated = value;
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Desktop" }));
  assert.equal(view.queryByRole("meter"), null);
  fireEvent.click(view.getByRole("button", { name: "Test desktop" }));
  await waitFor(() =>
    assert.ok(
      view.getByRole("meter", { name: "Desktop Lighthouse performance score" }),
    ),
  );
  assert.equal(updated?.strategy, "desktop");
  fireEvent.click(view.getByRole("button", { name: /Mobile/ }));
  assert.equal(
    view
      .getByRole("meter", { name: "Mobile Lighthouse performance score" })
      .getAttribute("aria-valuenow"),
    "82",
  );
  fireEvent.click(view.getByRole("button", { name: /Desktop/ }));
  assert.equal(
    view
      .getByRole("meter", { name: "Desktop Lighthouse performance score" })
      .getAttribute("aria-valuenow"),
    "94",
  );
  assert.equal(calls, 1);
});

test("cancelled tests cannot overwrite a newer device result and duplicate clicks do not burst requests", async (t) => {
  const pending = deferred();
  let calls = 0;
  let signal: AbortSignal | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        signal = init?.signal as AbortSignal;
        return pending.promise;
      }
      return Response.json(report("desktop"));
    },
  );
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Test mobile" }));
  fireEvent.click(view.getByRole("button", { name: "Testing mobile…" }));
  assert.equal(calls, 1);
  fireEvent.click(view.getByRole("button", { name: "Desktop" }));
  assert.equal(signal?.aborted, true);
  fireEvent.click(view.getByRole("button", { name: "Test desktop" }));
  await waitFor(() =>
    assert.ok(
      view.getByRole("meter", { name: "Desktop Lighthouse performance score" }),
    ),
  );
  await act(async () => {
    pending.resolve(Response.json(report()));
  });
  assert.ok(
    view.getByRole("meter", { name: "Desktop Lighthouse performance score" }),
  );
  fireEvent.click(view.getByRole("button", { name: /Mobile/ }));
  assert.equal(view.queryByRole("meter"), null);
});

test("invalid or mismatched success responses do not display a measurement", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ ...report(), url: "https://other.example/" }),
  );
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Test mobile" }));
  await waitFor(() => assert.ok(view.getByRole("alert")));
  assert.equal(view.queryByRole("meter"), null);
  assert.ok(view.getByText(/did not match this page and device/));
});

test("copy and download include the actual measurements, devices, sources and estimate limitations", async (t) => {
  let copied = "";
  let blob: Blob | undefined;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  t.mock.method(URL, "createObjectURL", (value: Blob | MediaSource) => {
    blob = value as Blob;
    return "blob:pagespeed";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "bakery.example-pagespeed-results.txt");
    },
  );
  const view = mount(report());
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy results" }));
  });
  for (const text of [
    "LIGHTHOUSE LAB SCORE: 82/100",
    "Interaction to Next Paint: 190 ms",
    "2026-11-07T12:00:00.000Z",
    "Form factor: mobile",
    "Throttling method: simulate",
    "must not be added together",
    url,
  ])
    assert.ok(copied.includes(text), text);
  fireEvent.click(
    view.getByRole("button", { name: "Download results (.txt)" }),
  );
  assert.equal(await blob!.text(), copied);
});

test("clipboard denial is visible and no-insight runs do not invent a clean performance verdict", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  const data = report();
  data.opportunities = [];
  const view = mount(data);
  fireEvent.click(view.getByRole("button", { name: /Optimization insights/ }));
  assert.ok(
    view.getByRole("heading", {
      name: "No optimization insights were returned for this run.",
    }),
  );
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy results" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  assert.ok(
    pageSpeedPlan([data]).includes(
      "does not establish that no performance issues exist",
    ),
  );
});

test("Inspect insight opens and focuses the exact row while device views stay independent", () => {
  const view = render(
    createElement(Section, {
      url,
      reports: { mobile: report(), desktop: report("desktop") },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Lab measurements" }));
  fireEvent.click(view.getByRole("button", { name: "Inspect insight" }));
  const insights = within(
    view.getByRole("region", { name: "Optimization insights" }),
  );
  const row = insights.getByRole("button", {
    name: /Reduce unused JavaScript/,
  });
  assert.equal(row.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, row);
  fireEvent.click(view.getByRole("button", { name: /Desktop/ }));
  fireEvent.click(view.getByRole("button", { name: "Real-user data" }));
  fireEvent.click(view.getByRole("button", { name: /Mobile/ }));
  assert.equal(
    insights
      .getByRole("button", { name: /Reduce unused JavaScript/ })
      .getAttribute("aria-expanded"),
    "true",
  );
  fireEvent.click(view.getByRole("button", { name: /Desktop/ }));
  assert.ok(view.getByRole("region", { name: "Real-user data" }));
});

test("field-only supporting data is visible without a lab score or empty vitals cards", () => {
  const data = parsePageSpeed(
    {
      loadingExperience: {
        id: url,
        metrics: { EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 780 } },
      },
    },
    { url },
  );
  const view = mount(data);
  const field = within(view.getByRole("region", { name: "Real-user data" }));
  assert.equal(view.queryByRole("meter"), null);
  assert.equal(field.queryAllByRole("article").length, 0);
  assert.equal(field.getByText("780 ms").closest("details")?.open, true);
  assert.ok(field.getByText(/Missing field metrics/));
});

test("a valid zero score is displayed and empty saved measurements leave the device ready", () => {
  const zero = { ...report(), performanceScore: 0 };
  const view = mount(zero);
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "0");
  const empty = parsePageSpeed({}, { url, strategy: "desktop" });
  const another = render(
    createElement(Section, { url, reports: { desktop: empty } }),
  );
  fireEvent.click(
    within(another.container).getByRole("button", { name: "Desktop" }),
  );
  assert.ok(
    within(another.container).getByRole("button", { name: "Test desktop" }),
  );
  assert.equal(
    within(another.container).queryByRole("button", { name: "Copy results" }),
    null,
  );
});

test("a client timeout retains the previous measurement", async (t) => {
  const deadline = new AbortController();
  t.mock.method(AbortSignal, "timeout", () => deadline.signal);
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init: RequestInit) => {
      return new Promise((_resolve, reject) =>
        init.signal!.addEventListener(
          "abort",
          () => reject(init.signal!.reason),
          { once: true },
        ),
      );
    },
  );
  const view = mount(report());
  fireEvent.click(view.getByRole("button", { name: "Retest mobile" }));
  await act(async () =>
    deadline.abort(new DOMException("Timeout", "TimeoutError")),
  );
  assert.match(
    view.getByRole("alert").textContent!,
    /PageSpeed test timed out/,
  );
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "82");
  assert.ok(view.getByText("Previous result"));
});

test("oversized import is rejected before reading and dismissing restores focus", async () => {
  const view = mount(report());
  fireEvent.change(view.getByLabelText("Lighthouse JSON file"), {
    target: {
      files: [
        {
          size: 11 * 1024 * 1024,
          text: async () => {
            throw new Error("Unexpected read");
          },
        },
      ],
    },
  });
  await waitFor(() =>
    assert.match(view.getByRole("alert").textContent!, /up to 10 MB/),
  );
  fireEvent.click(view.getByRole("button", { name: "Dismiss import error" }));
  assert.equal(
    document.activeElement,
    view.getByRole("button", { name: "Import Lighthouse JSON" }),
  );
  assert.ok(view.getByRole("meter"));
});
