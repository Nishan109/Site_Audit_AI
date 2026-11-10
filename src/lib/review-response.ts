import { z } from "zod";
import {
  REVIEW_STREAM,
  reviewEventEnvelope,
  reviewEventPayload,
  type ReviewEvent,
} from "./review-progress";
import type { AuditResult } from "./types";

export class ReviewResponseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export const reportSchema = z.object({
  dataSource: z.literal("live"),
  url: z.httpUrl(),
  analyzedAt: z.string(),
  scores: z.record(z.string(), z.unknown()),
  pagesAnalyzed: z
    .array(
      z.object({
        url: z.httpUrl(),
        title: z.string(),
        fetchedAt: z.string(),
        contentHash: z.string(),
      }),
    )
    .min(1),
  topIssues: z.array(z.unknown()),
  messaging: z.array(z.unknown()),
  ux: z.array(z.unknown()),
  seo: z.array(z.unknown()),
  conversion: z.array(z.unknown()),
  quickWins: z.array(z.unknown()),
  sources: z.array(z.string()),
  searchQueries: z.array(z.string()),
  agentSteps: z.array(z.unknown()),
});
const errorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
const lineLimit = 8 * 1024 * 1024;

function validatedReport(value: unknown): AuditResult {
  if (!reportSchema.safeParse(value).success)
    throw new ReviewResponseError(
      "The report could not be verified. Please try again.",
      "INVALID_REPORT",
    );
  return value as AuditResult;
}

function interrupted() {
  return new ReviewResponseError(
    "The connection ended before the report arrived. You can retry the same page.",
    "REVIEW_CONNECTION_LOST",
  );
}

function invalidProgress() {
  return new ReviewResponseError(
    "The review returned an unreadable update. You can retry the same page.",
    "INVALID_REVIEW_PROGRESS",
  );
}

export async function readReviewResponse(
  response: Response,
  signal: AbortSignal,
  onProgress: (event: ReviewEvent) => void,
): Promise<AuditResult> {
  signal.throwIfAborted();
  const contentType = response.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (!response.ok || contentType !== REVIEW_STREAM) {
    const value: unknown = await response.json().catch(() => {
      signal.throwIfAborted();
      throw interrupted();
    });
    signal.throwIfAborted();
    if (!response.ok) {
      const failure = errorSchema.safeParse(value);
      throw new ReviewResponseError(
        failure.success
          ? failure.data.error
          : "The review service is unavailable. Please try again.",
        (failure.success && failure.data.code) || "ANALYSIS_FAILED",
      );
    }
    return validatedReport(value);
  }

  const reader = response.body?.getReader();
  if (!reader) throw interrupted();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let runId = "";
  let sequence = 0;
  let elapsedMs = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });

  function consume(line: string) {
    if (!line.trim()) return;
    if (line.length > lineLimit) throw invalidProgress();
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw invalidProgress();
    }
    const envelope = reviewEventEnvelope.safeParse(value);
    const payload = reviewEventPayload.safeParse(value);
    if (!envelope.success || !payload.success) throw invalidProgress();
    const event = { ...envelope.data, ...payload.data };
    if (runId && event.runId !== runId) throw invalidProgress();
    if (event.sequence <= sequence) return;
    if (
      (!runId && event.type !== "run_started") ||
      (runId && event.type === "run_started") ||
      event.elapsedMs < elapsedMs
    )
      throw invalidProgress();
    runId = event.runId;
    sequence = event.sequence;
    elapsedMs = event.elapsedMs;
    if (event.type === "run_failed")
      throw new ReviewResponseError(event.error, event.code);
    if (event.type === "run_completed") return validatedReport(event.report);
    onProgress(event);
  }

  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read().catch(() => {
        throw interrupted();
      });
      signal.throwIfAborted();
      try {
        buffer += decoder.decode(value, { stream: !done });
      } catch {
        throw invalidProgress();
      }
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const report = consume(buffer.slice(0, newline));
        if (report) return report;
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (buffer.length > lineLimit) throw invalidProgress();
      if (done) {
        const report = consume(buffer);
        if (report) return report;
        throw interrupted();
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
    reader.releaseLock();
  }
}
