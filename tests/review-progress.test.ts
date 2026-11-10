import assert from "node:assert/strict";
import { test } from "node:test";
import { auditActivity } from "../src/lib/server/audit-activity";
import { auditResponse } from "../src/lib/server/audit-stream";
import { AuditError } from "../src/lib/server/errors";
import {
  applyReviewEvent,
  REVIEW_STREAM,
  type ReviewEvent,
  type ReviewProgress,
} from "../src/lib/review-progress";
import { readReviewResponse } from "../src/lib/review-response";
import { dashboardFixture } from "./dashboard-fixtures";

const report = dashboardFixture();
const signal = () => new AbortController().signal;
const request = (
  accept = REVIEW_STREAM,
  url = "bakery.example/?edition=archive",
  abort = signal(),
) =>
  new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: accept },
    body: JSON.stringify({ url }),
    signal: abort,
  });
const encoder = new TextEncoder();
const wire = (type: string, sequence: number, fields = {}) =>
  JSON.stringify({
    version: 1,
    runId: "fixture-run",
    sequence,
    elapsedMs: sequence * 100,
    type,
    ...fields,
  }) + "\n";
const response = (parts: Uint8Array[]) =>
  new Response(
    new ReadableStream({
      start(stream) {
        parts.forEach((part) => stream.enqueue(part));
        stream.close();
      },
    }),
    { headers: { "Content-Type": REVIEW_STREAM } },
  );

test("the same audit route keeps JSON compatibility and validates bad URLs before starting", async () => {
  let calls = 0;
  const analyze = async (url: unknown) => {
    assert.equal(url, "https://bakery.example/?edition=archive");
    calls++;
    return report;
  };
  const json = await auditResponse(request("application/json"), analyze);
  assert.equal(json.headers.get("Vary"), "Accept");
  assert.equal(json.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await json.json(), report);
  const bad = await auditResponse(
    request(REVIEW_STREAM, "http://localhost"),
    analyze,
  );
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).code, "INVALID_URL");
  assert.equal(calls, 1);
});

test("real stage boundaries can stream parallel activity before the report, with an optional limitation", async () => {
  const messaging = Promise.withResolvers<number>();
  const ux = Promise.withResolvers<number>();
  const parallel = Promise.withResolvers<void>();
  const firstSettled = Promise.withResolvers<void>();
  let invocations = 0;
  const streamed = await auditResponse(request(), async (_url, abort, emit) => {
    invocations++;
    const activity = auditActivity(abort, emit);
    await activity.run(
      "evidence",
      () => 1,
      (count) => ({ status: "complete", count, excluded: 1 }),
    );
    await activity.run(
      "research",
      () => null,
      () => ({ status: "unavailable" }),
    );
    await Promise.all([
      activity.run(
        "messaging",
        () => messaging.promise,
        (count) => ({ status: "complete", count }),
      ),
      activity.run(
        "ux",
        () => ux.promise,
        (count) => ({ status: "complete", count }),
      ),
    ]);
    return { ...report, initialReviewTiming: activity.timing() };
  });
  assert.match(streamed.headers.get("Content-Type")!, /application\/x-ndjson/);
  const events: ReviewEvent[] = [];
  const result = readReviewResponse(streamed, signal(), (event) => {
    events.push(event);
    if (event.type === "stage_started" && event.stage === "ux")
      parallel.resolve();
    if (event.type === "stage_settled" && event.stage === "ux")
      firstSettled.resolve();
  });
  await parallel.promise;
  assert.deepEqual(
    events.slice(-2).map((item) => item.type),
    ["stage_started", "stage_started"],
  );
  assert.equal(events[0].type, "run_started");
  ux.resolve(0);
  await firstSettled.promise;
  const last = events.at(-1);
  assert.ok(
    last?.type === "stage_settled" && last.stage === "ux" && last.count === 0,
  );
  messaging.resolve(2);
  const completed = await result;
  assert.equal(invocations, 1);
  assert.ok(
    completed.initialReviewTiming?.stages.every(
      ({ durationMs }) => durationMs >= 0,
    ),
  );
  assert.ok(
    completed.initialReviewTiming?.stages.some(
      ({ stage, status }) => stage === "research" && status === "unavailable",
    ),
  );
});

test("request abort and reader cancellation both stop downstream work", async () => {
  for (const method of ["request", "reader"]) {
    const controller = new AbortController();
    const aborted = Promise.withResolvers<void>();
    const streamed = await auditResponse(
      request(REVIEW_STREAM, report.url, controller.signal),
      async (_url, work) => {
        await new Promise<void>((_resolve, reject) =>
          work.addEventListener(
            "abort",
            () => {
              aborted.resolve();
              reject(work.reason);
            },
            { once: true },
          ),
        );
        return report;
      },
    );
    const reader = streamed.body!.getReader();
    assert.ok((await reader.read()).value);
    if (method === "request") controller.abort();
    else await reader.cancel();
    await aborted.promise;
    assert.equal((await reader.read()).done, true);
  }
});

test("a blocking failure and server deadline produce terminal errors instead of a report", async () => {
  const failure = await auditResponse(request(), async (_url, abort, emit) => {
    await auditActivity(abort, emit).run("evidence", () => {
      throw new AuditError(
        "The submitted page could not be read.",
        422,
        "WEBSITE_UNREACHABLE",
      );
    });
    return report;
  });
  const events: ReviewEvent[] = [];
  await assert.rejects(
    readReviewResponse(failure, signal(), (event) => events.push(event)),
    { code: "WEBSITE_UNREACHABLE" },
  );
  assert.ok(
    events.some(
      (item) => item.type === "stage_settled" && item.status === "failed",
    ),
  );
  const deadline = await auditResponse(
    request(),
    async (_url, abort) => {
      await new Promise<void>((_resolve, reject) =>
        abort.addEventListener("abort", () => reject(abort.reason), {
          once: true,
        }),
      );
      return report;
    },
    5,
  );
  await assert.rejects(
    readReviewResponse(deadline, signal(), () => {}),
    { code: "ANALYSIS_TIMEOUT" },
  );
});

test("a failed run stops its still-active sibling without reporting it as complete", async () => {
  const siblingStopped = Promise.withResolvers<void>();
  const streamed = await auditResponse(
    request(),
    async (_url, signal, emit) => {
      const activity = auditActivity(signal, emit);
      await Promise.all([
        activity.run("messaging", () => {
          throw new AuditError(
            "Messaging review failed.",
            502,
            "ANALYSIS_FAILED",
          );
        }),
        activity.run("ux", async () => {
          await new Promise<void>((resolve) =>
            signal.addEventListener(
              "abort",
              () => {
                siblingStopped.resolve();
                resolve();
              },
              { once: true },
            ),
          );
        }),
      ]);
      return report;
    },
  );
  const events: ReviewEvent[] = [];
  await assert.rejects(
    readReviewResponse(streamed, signal(), (event) => events.push(event)),
    { code: "ANALYSIS_FAILED" },
  );
  await siblingStopped.promise;
  assert.ok(
    events.some((item) => item.type === "stage_started" && item.stage === "ux"),
  );
  assert.ok(
    !events.some(
      (item) => item.type === "stage_settled" && item.stage === "ux",
    ),
  );
});

test("incremental decoding handles split Unicode, coalesced lines and duplicate progress", async () => {
  const final = { ...report, summary: "L’été à Montréal" };
  const bytes = encoder.encode(
    wire("run_started", 1) +
      wire("heartbeat", 2) +
      wire("heartbeat", 2) +
      wire("run_completed", 3, { report: final }),
  );
  const split = bytes.findIndex((byte) => byte === 195) + 1;
  assert.ok(split > 1);
  const types: string[] = [];
  const read = await readReviewResponse(
    response([bytes.slice(0, 3), bytes.slice(3, split), bytes.slice(split)]),
    signal(),
    (event) => types.push(event.type),
  );
  assert.deepEqual(types, ["run_started", "heartbeat"]);
  assert.equal(read.summary, final.summary);
});

test("incomplete or malformed streams cannot become completed reports", async () => {
  for (const [data, code] of [
    [wire("run_started", 1), "REVIEW_CONNECTION_LOST"],
    [wire("run_started", 1) + "{broken}\n", "INVALID_REVIEW_PROGRESS"],
    [wire("run_started", 1, { version: 2 }), "INVALID_REVIEW_PROGRESS"],
    [
      wire("run_started", 1) + wire("heartbeat", 2, { runId: "other" }),
      "INVALID_REVIEW_PROGRESS",
    ],
    [
      wire("run_started", 1) +
        wire("run_completed", 2, { report: { dataSource: "live" } }),
      "INVALID_REPORT",
    ],
  ]) {
    await assert.rejects(
      readReviewResponse(response([encoder.encode(data)]), signal(), () => {}),
      { code },
    );
  }
});

test("heartbeat changes connection timing without starting or settling stages", () => {
  const state: ReviewProgress = {
    startedAt: 10,
    serverElapsedMs: 0,
    stages: {},
  };
  const started = applyReviewEvent(
    state,
    {
      version: 1,
      runId: "run",
      sequence: 2,
      elapsedMs: 20,
      type: "stage_started",
      stage: "messaging",
    },
    30,
  );
  const alive = applyReviewEvent(
    started,
    {
      version: 1,
      runId: "run",
      sequence: 3,
      elapsedMs: 10_020,
      type: "heartbeat",
    },
    10_030,
  );
  assert.equal(alive.stages, started.stages);
  assert.equal(alive.receivedAt, 10_030);
  assert.deepEqual(alive.stages.messaging, { startedMs: 20 });
});
