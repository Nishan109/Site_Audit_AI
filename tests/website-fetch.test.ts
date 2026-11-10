import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ClientRequest, RequestOptions } from "node:http";
import { createWebsiteReader } from "../src/lib/server/website-fetch";
import { AuditError } from "../src/lib/server/errors";

type Action = {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  stall?: boolean;
  error?: string;
  partial?: boolean;
  delay?: number;
};
function harness(
  actions: Action[],
  resolveHost = async () => [
    { address: "1.1.1.1", family: 4 },
  ],
) {
  const calls: { url: string; options: RequestOptions }[] = [];
  const requestSignals: AbortSignal[] = [];
  const sendRequest = (
    url: URL,
    options: RequestOptions,
    receive: (res: IncomingMessage) => void,
  ) => {
    calls.push({ url: url.href, options });
    const action = actions[calls.length - 1] || {};
    const req = new EventEmitter();
    const signal = options.signal!;
    requestSignals.push(signal);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const aborted = () => {
      clearTimeout(timer);
      req.emit(
        "error",
        Object.assign(new Error("Request aborted"), { code: "ABORT_ERR" }),
      );
    };
    const finish = () => signal.removeEventListener("abort", aborted);
    const stream = new EventEmitter();
    const response = Object.assign(stream, {
      statusCode: action.status ?? 200,
      headers: { "content-type": "text/html", ...action.headers },
      complete: !action.partial,
      destroy(error?: Error) {
        finish();
        if (error) stream.emit("error", error);
        return stream;
      },
    });
    const request = Object.assign(req, {
      end() {
        signal.addEventListener("abort", aborted, { once: true });
        if (action.stall) return;
        timer = setTimeout(() => {
          if (action.error) {
            finish();
            req.emit(
              "error",
              Object.assign(new Error("Network failure"), {
                code: action.error,
              }),
            );
            return;
          }
          receive(response as unknown as IncomingMessage);
          response.emit(
            "data",
            Buffer.from(
              action.body ?? "<main><h1>Fresh public content</h1></main>",
            ),
          );
          response.emit("end");
          finish();
        }, action.delay ?? 0);
      },
    });
    return request as unknown as ClientRequest;
  };
  const read = createWebsiteReader({
    resolveHost,
    sendRequest,
    attemptTimeoutsMs: [25, 60],
    totalTimeoutMs: 120,
    retryDelayMs: 1,
  });
  return { read, calls, requestSignals };
}

test("a stalled first request is aborted and retried once against the original page", async () => {
  const h = harness([
    { stall: true },
    { body: "<main>Fresh retry content</main>" },
  ]);
  const page = await h.read(
    "https://example.com/ebooks?edition=2",
    AbortSignal.timeout(1000),
  );
  assert.equal(page.html, "<main>Fresh retry content</main>");
  assert.equal(h.calls.length, 2);
  assert.equal(h.requestSignals[0].aborted, true);
  assert.ok(
    h.calls.every(
      (call) => call.url === "https://example.com/ebooks?edition=2",
    ),
  );
});

test("a slow successful second attempt gets the longer deadline without a third request", async () => {
  const h = harness([{ error: "ECONNRESET" }, { delay: 35 }]);
  const page = await h.read(
    "https://example.com/ebooks",
    AbortSignal.timeout(1000),
  );
  assert.match(page.html, /Fresh public content/);
  assert.equal(h.calls.length, 2);
});

test("DNS and redirects are validated again and the request stays pinned to a public address", async () => {
  const h = harness([{ status: 302, headers: { location: "/ebooks" } }, {}]);
  const page = await h.read(
    "https://example.com/start",
    AbortSignal.timeout(1000),
  );
  assert.equal(page.url, "https://example.com/ebooks");
  assert.equal(h.calls[0].options.agent, false);
  assert.equal(h.calls[0].options.family, 4);
  assert.ok(h.calls[0].options.lookup);
  assert.ok(!("rejectUnauthorized" in h.calls[0].options));
});

test("retry cannot bypass a changed private DNS answer", async () => {
  let resolutions = 0;
  const h = harness([{ error: "ECONNRESET" }], async () => [
    { address: ++resolutions === 1 ? "1.1.1.1" : "127.0.0.1", family: 4 },
  ]);
  await assert.rejects(
    h.read("https://example.com", AbortSignal.timeout(1000)),
    (error) => error instanceof AuditError && error.code === "INVALID_URL",
  );
  assert.equal(h.calls.length, 1);
});

test("private redirects are blocked before another network request", async () => {
  const h = harness([
    { status: 302, headers: { location: "http://127.0.0.1/secret" } },
  ]);
  await assert.rejects(
    h.read("https://example.com", AbortSignal.timeout(1000)),
    (error) => error instanceof AuditError && error.code === "INVALID_URL",
  );
  assert.equal(h.calls.length, 1);
});

test("a retry can use another validated address without changing the host or disabling TLS", async () => {
  const h = harness([{ error: "ECONNRESET" }, {}], async () => [
    { address: "1.1.1.1", family: 4 },
    { address: "8.8.8.8", family: 4 },
  ]);
  await h.read("https://example.com/ebooks", AbortSignal.timeout(1000));
  const pinned: string[] = [];
  for (const call of h.calls) {
    const lookup = call.options.lookup as (
      host: string,
      options: object,
      callback: (error: Error | null, address: string, family: number) => void,
    ) => void;
    lookup("example.com", {}, (error, address, family) => {
      assert.equal(error, null);
      pinned.push(address);
      assert.equal(family, 4);
    });
    assert.equal(call.url, "https://example.com/ebooks");
    assert.ok(!("rejectUnauthorized" in call.options));
  }
  assert.deepEqual(pinned, ["1.1.1.1", "8.8.8.8"]);
});

test("access blocks, certificate failures, unsupported documents and oversized pages are not retried", async () => {
  for (const action of [
    { status: 403 },
    { status: 429 },
    { error: "CERT_HAS_EXPIRED" },
    { headers: { "content-type": "application/pdf" } },
    { body: "x".repeat(3_000_001) },
  ]) {
    const h = harness([action]);
    await assert.rejects(
      h.read("https://example.com", AbortSignal.timeout(1000)),
    );
    assert.equal(h.calls.length, 1);
  }
});

test("temporary 503 and truncated streams can retry but partial bytes never become evidence", async () => {
  for (const action of [
    { status: 503 },
    { partial: true, body: "partial content" },
  ]) {
    const h = harness([
      action,
      { body: "<main>Complete final response</main>" },
    ]);
    const page = await h.read("https://example.com", AbortSignal.timeout(1000));
    assert.equal(page.html, "<main>Complete final response</main>");
    assert.equal(h.calls.length, 2);
  }
});

test("cancelling a request stops the attempt without starting a retry", async () => {
  const h = harness([{ stall: true }]);
  const controller = new AbortController();
  const pending = h.read("https://example.com", controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort(new Error("User cancelled"));
  await assert.rejects(pending, /User cancelled/);
  assert.equal(h.calls.length, 1);
});

test("DNS resolution is bounded and a cancelled lookup cannot send a later request", async () => {
  const h = harness([], () => new Promise(() => {}));
  const controller = new AbortController();
  const pending = h.read("https://example.com", controller.signal);
  controller.abort(new Error("User cancelled during DNS"));
  await assert.rejects(pending, /User cancelled during DNS/);
  assert.equal(h.calls.length, 0);
});

test("two stalled attempts return an actionable timeout rather than empty success", async () => {
  const h = harness([{ stall: true }, { stall: true }]);
  await assert.rejects(
    h.read("https://example.com", AbortSignal.timeout(1000)),
    (error) =>
      error instanceof AuditError &&
      error.code === "WEBSITE_TIMEOUT" &&
      error.status === 504 &&
      /Try again/.test(error.message),
  );
  assert.equal(h.calls.length, 2);
});

test("the shared deadline bounds repeated redirects and DNS waits across both attempts", async () => {
  let resolutions = 0;
  const read = createWebsiteReader({
    resolveHost: async () => {
      resolutions++;
      return new Promise(() => {});
    },
    attemptTimeoutsMs: [100, 100],
    totalTimeoutMs: 15,
    retryDelayMs: 0,
  });
  await assert.rejects(
    read("https://example.com", AbortSignal.timeout(1000)),
    (error) => error instanceof AuditError && error.code === "WEBSITE_TIMEOUT",
  );
  assert.equal(resolutions, 1);
});
