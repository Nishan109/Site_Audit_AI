import { randomUUID } from "node:crypto";
import {
  REVIEW_HEARTBEAT_MS,
  REVIEW_PROTOCOL_VERSION,
  REVIEW_STREAM,
  type ReviewStageEvent,
} from "../review-progress";
import type { AuditResult } from "../types";
import type { analyzeWebsite } from "./audit";
import {
  AuditError,
  auditErrorDetails,
  errorResponse,
  readBody,
} from "./errors";
import { normalizeUrl } from "./url";

const headers = { "Cache-Control": "no-store", Vary: "Accept" };
const reviewDeadline = () =>
  new AuditError(
    "This review took longer than expected. You can retry the same page.",
    504,
    "ANALYSIS_TIMEOUT",
  );
type TerminalEvent =
  | { type: "run_completed"; report: AuditResult }
  | { type: "run_failed"; code: string; error: string };
type Payload =
  ReviewStageEvent | TerminalEvent | { type: "run_started" | "heartbeat" };
type CompleteReport = (report: AuditResult, signal: AbortSignal) => Promise<AuditResult>;

function streamAudit(
  url: string,
  requestSignal: AbortSignal,
  analyze: typeof analyzeWebsite,
  timeoutMs: number,
  complete?: CompleteReport,
) {
  let cancel: (fromReader?: boolean) => void = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      if (requestSignal.aborted) {
        stream.close();
        return;
      }
      const work = new AbortController();
      const encoder = new TextEncoder();
      const runId = randomUUID();
      const started = performance.now();
      let sequence = 0;
      let closed = false;

      function send(payload: Payload) {
        if (closed) return;
        stream.enqueue(
          encoder.encode(
            JSON.stringify({
              ...payload,
              version: REVIEW_PROTOCOL_VERSION,
              runId,
              sequence: ++sequence,
              elapsedMs: Math.floor(performance.now() - started),
            }) + "\n",
          ),
        );
      }

      function close(fromReader = false) {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(deadline);
        requestSignal.removeEventListener("abort", disconnect);
        if (!fromReader) stream.close();
      }

      function disconnect() {
        cancel();
      }

      cancel = (fromReader) => {
        close(fromReader);
        work.abort(requestSignal.reason);
      };

      const heartbeat = setInterval(
        () => send({ type: "heartbeat" }),
        REVIEW_HEARTBEAT_MS,
      );
      const deadline = setTimeout(() => {
        const reason = new DOMException(
          "Review deadline reached",
          "TimeoutError",
        );
        const { code, error } = auditErrorDetails(reviewDeadline());
        send({ type: "run_failed", code, error });
        close();
        work.abort(reason);
      }, timeoutMs);
      requestSignal.addEventListener("abort", disconnect, { once: true });
      send({ type: "run_started" });

      void (async () => {
        try {
          let report = await analyze(url, work.signal, send);
          work.signal.throwIfAborted();
          // The bounded storage operation has its own deadline. A slow save
          // must not turn a finished analysis into a provider timeout.
          clearTimeout(deadline);
          if (complete) report = await complete(report, work.signal);
          work.signal.throwIfAborted();
          send({ type: "run_completed", report });
        } catch (failure) {
          if (!closed) {
            const { code, error } = auditErrorDetails(failure);
            send({ type: "run_failed", code, error });
          }
        } finally {
          close();
          work.abort();
        }
      })();
    },
    cancel() {
      cancel(true);
    },
  });
  return new Response(body, {
    headers: { ...headers, "Content-Type": `${REVIEW_STREAM}; charset=utf-8` },
  });
}

export async function auditResponse(
  request: Request,
  analyze: typeof analyzeWebsite,
  timeoutMs = 160_000,
  complete?: CompleteReport,
) {
  try {
    const body = await readBody(request);
    const url = normalizeUrl(body.url);
    request.signal.throwIfAborted();
    const streaming = request.headers
      .get("Accept")
      ?.split(",")
      .some(
        (value) => value.split(";")[0].trim().toLowerCase() === REVIEW_STREAM,
      );
    if (streaming) return streamAudit(url, request.signal, analyze, timeoutMs, complete);
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([request.signal, deadline]);
    try {
      let report = await analyze(url, signal);
      signal.throwIfAborted();
      if (complete) report = await complete(report, request.signal);
      request.signal.throwIfAborted();
      return Response.json(report, { headers });
    } catch (error) {
      throw deadline.aborted && !request.signal.aborted
        ? reviewDeadline()
        : error;
    }
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Vary", "Accept");
    return response;
  }
}
