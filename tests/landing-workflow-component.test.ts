import "./component-environment";
import { after, afterEach, before, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { dashboardFixture } from "./dashboard-fixtures";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-public";

let Home: typeof import("../src/components/AuditWorkspace").default;
before(async () => {
  Home = (await import("../src/components/AuditWorkspace")).default;
});
after(async () => {
  const { createClient } = await import("../src/lib/supabase/client");
  await createClient().auth.dispose();
});
afterEach(cleanup);
function mockApi(t: TestContext, handler: typeof fetch) {
  return t.mock.method(
    globalThis,
    "fetch",
    (url: RequestInfo | URL, init?: RequestInit) =>
      url === "/api/account"
        ? Promise.resolve(
            Response.json({ id: "00000000-0000-4000-8000-000000000001" }),
          )
        : handler(url, init),
  );
}

test("the real page posts the entered URL and restores it after a provider error", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  const network = mockApi(
    t,
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(_url, "/api/analyze");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        url: "https://example.com/pricing",
      });
      return Response.json(
        { error: "The provider is temporarily unavailable. Please retry." },
        { status: 503 },
      );
    },
  );
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "  https://example.com/pricing  " } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  assert.ok(view.getByRole("heading", { name: "Reviewing your website" }));
  assert.equal(
    view.queryByRole("navigation", { name: "Landing page navigation" }),
    null,
  );
  await waitFor(() =>
    assert.match(
      view.getByRole("alert").textContent!,
      /provider is temporarily unavailable/,
    ),
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: "Your website address",
      }) as HTMLInputElement
    ).value,
    "https://example.com/pricing",
  );
  assert.equal(
    network.mock.calls.filter((call) => call.arguments[0] !== "/api/account")
      .length,
    1,
  );
  fireEvent.click(view.getByRole("button", { name: "Dismiss error" }));
  assert.equal(view.queryByRole("alert"), null);
});

test("canceling the running request returns to the entered URL without accepting a late report", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  let signal: AbortSignal | undefined;
  let finish: (response: Response) => void = () => {};
  mockApi(t, async (_url: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal as AbortSignal;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "example.com" } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  fireEvent.click(view.getByRole("button", { name: "Cancel review" }));
  assert.equal(signal?.aborted, true);
  assert.equal(
    (
      view.getByRole("textbox", {
        name: "Your website address",
      }) as HTMLInputElement
    ).value,
    "example.com",
  );
  finish(Response.json(dashboardFixture()));
  await waitFor(() =>
    assert.ok(view.getByRole("form", { name: "Start a website review" })),
  );
  assert.ok(!view.queryByText("Export report", { exact: true }));
});

test("a website timeout exposes a retry for the same submitted page and can recover", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  const requests: string[] = [];
  mockApi(t, async (_url: RequestInfo | URL, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)).url);
    return requests.length === 1
      ? Response.json(
          {
            code: "WEBSITE_TIMEOUT",
            error: "This page could not be read within the retry deadline.",
          },
          { status: 504 },
        )
      : Response.json({
          ...dashboardFixture(),
          url: "https://woxora.com/ebooks",
        });
  });
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "https://woxora.com/ebooks" } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "Retry this page" })),
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: "Your website address",
      }) as HTMLInputElement
    ).value,
    "https://woxora.com/ebooks",
  );
  fireEvent.click(view.getByRole("button", { name: "Retry this page" }));
  await waitFor(() =>
    assert.ok(view.getByText("Export report", { exact: true })),
  );
  assert.deepEqual(requests, [
    "https://woxora.com/ebooks",
    "https://woxora.com/ebooks",
  ]);
  assert.ok(!view.queryByRole("alert"));
});

test("a successful review leaves the landing page and exposes the real report actions", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  const fixture = dashboardFixture();
  const network = mockApi(t, async (url: RequestInfo | URL) => {
    assert.equal(url, "/api/analyze");
    return Response.json(fixture);
  });
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: fixture.url } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  await waitFor(() =>
    assert.ok(view.getByText("Export report", { exact: true })),
  );
  assert.equal(
    view.queryByRole("form", { name: "Start a website review" }),
    null,
  );
  assert.equal(
    view.queryByRole("button", { name: "Explore an example report" }),
    null,
  );
  const nav = view.getByRole("navigation", { name: "Report navigation" });
  fireEvent.click(within(nav).getByRole("button", { name: "Quick wins" }));
  assert.ok(view.getByRole("heading", { name: /Quick wins/ }));
  assert.equal(
    network.mock.calls.filter((call) => call.arguments[0] !== "/api/account")
      .length,
    1,
  );
});

test("the page displays streamed parallel stages and waits for the terminal report", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  let output!: ReadableStreamDefaultController<Uint8Array>;
  let sequence = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      output = controller;
    },
  });
  const send = (type: string, fields = {}) =>
    output.enqueue(
      new TextEncoder().encode(
        JSON.stringify({
          version: 1,
          runId: "test-run",
          sequence: ++sequence,
          elapsedMs: sequence * 1000,
          type,
          ...fields,
        }) + "\n",
      ),
    );
  const network = mockApi(
    t,
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(
        new Headers(init?.headers).get("Accept"),
        "application/x-ndjson",
      );
      return new Response(stream, {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    },
  );
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "bakery.example/?edition=archive" } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  await act(async () => {
    send("run_started");
    send("stage_started", { stage: "evidence" });
    send("stage_settled", {
      stage: "evidence",
      status: "complete",
      count: 1,
      durationMs: 1000,
    });
    send("stage_started", { stage: "research" });
    send("stage_settled", {
      stage: "research",
      status: "unavailable",
      durationMs: 1000,
    });
    send("stage_started", { stage: "messaging" });
    send("stage_started", { stage: "ux" });
  });
  const active = within(
    view.getByRole("region", { name: "Currently working on" }),
  );
  assert.ok(active.getByText("Messaging"));
  assert.ok(active.getByText("User experience"));
  assert.ok(active.getByText(/Web research unavailable/));
  assert.ok(view.getByText("Complete with limits"));
  assert.equal(view.queryByText("Export report", { exact: true }), null);
  await act(async () => {
    send("stage_settled", {
      stage: "messaging",
      status: "complete",
      count: 0,
      durationMs: 2000,
    });
  });
  assert.equal(active.queryByText("Messaging"), null);
  assert.ok(active.getByText("User experience"));
  assert.ok(view.getAllByText("0 supported findings retained.").length);
  await act(async () => {
    send("run_completed", { report: dashboardFixture() });
    output.close();
  });
  await waitFor(() =>
    assert.ok(view.getByText("Export report", { exact: true })),
  );
  assert.equal(document.activeElement?.id, "report-title");
  assert.equal(
    network.mock.calls.filter((call) => call.arguments[0] !== "/api/account")
      .length,
    1,
  );
});

test("a connection ending before the report offers a same-address retry", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  const addresses: string[] = [];
  mockApi(t, async (_url: RequestInfo | URL, init?: RequestInit) => {
    addresses.push(JSON.parse(String(init?.body)).url);
    return addresses.length === 1
      ? new Response(
          '{"version":1,"runId":"test-run","sequence":1,"elapsedMs":0,"type":"run_started"}\n',
          {
            headers: { "Content-Type": "application/x-ndjson" },
          },
        )
      : Response.json(dashboardFixture());
  });
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "bakery.example/?edition=archive" } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  await waitFor(() =>
    assert.match(
      view.getByRole("alert").textContent!,
      /connection ended before the report/,
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Retry this page" }));
  await waitFor(() =>
    assert.ok(view.getByText("Export report", { exact: true })),
  );
  assert.deepEqual(addresses, [
    "bakery.example/?edition=archive",
    "bakery.example/?edition=archive",
  ]);
});

test("overview filters and expanded findings survive section navigation and reset on a new audit", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  let audits = 0;
  mockApi(t, async () =>
    Response.json({
      ...dashboardFixture(),
      analysisId: `round-trip-${++audits}`,
    }),
  );
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "https://bakery.example/" } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  await waitFor(() => assert.ok(view.getByRole("button", { name: "High 2" })));
  fireEvent.click(view.getByRole("button", { name: "High 2" }));
  fireEvent.change(view.getByLabelText("Review area"), {
    target: { value: "ux" },
  });
  fireEvent.change(view.getByLabelText("Search findings in this report"), {
    target: { value: "collection" },
  });
  const row = within(view.getByRole("article"));
  fireEvent.click(row.getByText("View details", { exact: true }));
  await waitFor(() =>
    assert.ok(row.getByText("Hide details", { exact: true })),
  );
  const nav = within(
    view.getByRole("navigation", { name: "Report navigation" }),
  );
  fireEvent.click(nav.getByRole("button", { name: "Quick wins" }));
  fireEvent.click(nav.getByRole("button", { name: "Overview" }));
  assert.equal(
    (view.getByLabelText("Search findings in this report") as HTMLInputElement)
      .value,
    "collection",
  );
  assert.equal(
    (view.getByLabelText("Review area") as HTMLSelectElement).value,
    "ux",
  );
  assert.equal(view.getAllByRole("article").length, 1);
  assert.ok(
    within(view.getByRole("article")).getByText("Hide details", {
      exact: true,
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "Run again" }));
  await waitFor(() => assert.ok(view.getByRole("button", { name: "All 6" })));
  assert.equal(
    (view.getByLabelText("Search findings in this report") as HTMLInputElement)
      .value,
    "",
  );
  assert.equal(
    view.getByRole("button", { name: "All 6" }).getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(!view.queryByRole("button", { name: "Hide details" }));
  assert.equal(audits, 2);
});

test("research retry retains findings after failure and updates shared coverage after success", async (t) => {
  t.mock.method(window, "scrollTo", () => {});
  let researches = 0;
  mockApi(t, async (url: RequestInfo | URL) => {
    if (url === "/api/analyze") return Response.json(dashboardFixture());
    assert.equal(url, "/api/research");
    if (++researches === 1)
      return Response.json(
        { error: "Research provider busy." },
        { status: 503 },
      );
    return Response.json({
      provider: "test provider",
      modelUsed: "test-model",
      summary: "Recorded research context for the reviewed bakery.",
      searchedAt: "2026-11-08T08:00:00.000Z",
      sources: ["https://research.example/bakery"],
      queries: ["bakery alternatives"],
    });
  });
  const view = render(
    createElement(Home, {
      account: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "fixture@example.com",
      },
    }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: "Your website address" }),
    { target: { value: "https://bakery.example/" } },
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "Retry web research" })),
  );
  fireEvent.click(view.getByRole("button", { name: "Retry web research" }));
  await waitFor(() =>
    assert.ok(view.getByRole("alert").textContent?.includes("provider busy")),
  );
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "76");
  fireEvent.click(view.getByRole("button", { name: "Retry web research" }));
  await waitFor(() =>
    assert.ok(
      view
        .getAllByRole("status")
        .some((item) => item.textContent?.includes("Web research updated")),
    ),
  );
  const coverage = view.container.querySelector(
    "#report-evidence",
  ) as HTMLDetailsElement;
  coverage.open = true;
  assert.ok(
    view.getByText("Recorded research context for the reviewed bakery."),
  );
  assert.ok(view.getByText("Research recorded"));
  assert.equal(view.getByRole("meter").getAttribute("aria-valuenow"), "76");
  assert.equal(view.getAllByRole("article").length, 5);
  assert.ok(!view.queryByRole("button", { name: "Retry web research" }));
});
