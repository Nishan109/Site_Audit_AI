import { z } from "zod";

export const REVIEW_STREAM = "application/x-ndjson";
export const REVIEW_PROTOCOL_VERSION = 1;
export const REVIEW_HEARTBEAT_MS = 10_000;
export const REVIEW_QUIET_MS = 25_000;

export const REVIEW_PHASES = [
  {
    id: "collection",
    label: "Collect evidence",
    stages: [
      [
        "evidence",
        "Website evidence",
        "Reading the submitted page and eligible related pages",
      ],
      ["research", "Web research", "Looking for relevant web sources"],
    ],
  },
  {
    id: "specialists",
    label: "Review content",
    stages: [
      [
        "messaging",
        "Messaging",
        "Reviewing the page’s offer, audience, and wording",
      ],
      [
        "ux",
        "User experience",
        "Reviewing navigation and structure in the collected HTML",
      ],
      [
        "seo",
        "Search optimization",
        "Reviewing headings, metadata, and other search signals",
      ],
      [
        "conversion",
        "Conversion",
        "Reviewing action labels and decision clarity",
      ],
      [
        "ai-visibility",
        "AI visibility",
        "Reviewing content readiness and supporting evidence",
      ],
      [
        "strategy",
        "Strategy",
        "Building a SWOT from evidence and available research",
      ],
    ],
  },
  {
    id: "report",
    label: "Prepare report",
    stages: [
      ["quick-wins", "Quick wins", "Selecting evidence-backed quick wins"],
      [
        "validate",
        "Report validation",
        "Checking the report data against its schema",
      ],
      [
        "security",
        "Security checks",
        "Reviewing collected headers and HTML security signals",
      ],
      [
        "accessibility",
        "Accessibility checks",
        "Reviewing accessibility signals in the collected HTML",
      ],
      ["assemble", "Report assembly", "Preparing the completed report"],
    ],
  },
] as const;

export const REVIEW_STAGES = REVIEW_PHASES.flatMap((phase) => [
  ...phase.stages,
]);
const stageId = z.enum(REVIEW_STAGES.map(([id]) => id));
export type ReviewStageId = z.infer<typeof stageId>;

const milliseconds = z.number().int().nonnegative();
const stageOutcome = z.object({
  status: z.enum(["complete", "unavailable", "failed"]),
  count: z.number().int().nonnegative().optional(),
  excluded: z.number().int().nonnegative().optional(),
  queries: z.number().int().nonnegative().optional(),
});
export type ReviewStageOutcome = z.infer<typeof stageOutcome>;

const stageStarted = z.object({
  type: z.literal("stage_started"),
  stage: stageId,
});
const stageUpdated = z.object({
  type: z.literal("stage_updated"),
  stage: z.literal("evidence"),
  relatedPages: z.number().int().min(0).max(2),
});
const stageSettled = stageOutcome.extend({
  type: z.literal("stage_settled"),
  stage: stageId,
  durationMs: milliseconds,
});

export const reviewEventPayload = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run_started") }),
  stageStarted,
  stageUpdated,
  stageSettled,
  z.object({ type: z.literal("heartbeat") }),
  z.object({
    type: z.literal("run_completed"),
    report: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("run_failed"),
    code: z.string().max(80),
    error: z.string().min(1).max(2000),
  }),
]);

export const reviewEventEnvelope = z.object({
  version: z.literal(REVIEW_PROTOCOL_VERSION),
  runId: z.string().min(1).max(80),
  sequence: z.number().int().positive(),
  elapsedMs: milliseconds,
});

export type ReviewEvent = z.infer<typeof reviewEventEnvelope> &
  z.infer<typeof reviewEventPayload>;
export type ReviewStageEvent =
  | z.infer<typeof stageStarted>
  | z.infer<typeof stageUpdated>
  | z.infer<typeof stageSettled>;
export type InitialReviewTiming = {
  durationMs: number;
  stages: {
    stage: ReviewStageId;
    durationMs: number;
    status: "complete" | "unavailable";
  }[];
};

export type StageProgress = {
  startedMs: number;
  relatedPages?: number;
  settled?: ReviewStageOutcome & { durationMs: number };
};

export type ReviewProgress = {
  startedAt: number;
  receivedAt?: number;
  serverElapsedMs: number;
  stages: Partial<Record<ReviewStageId, StageProgress>>;
};

export function applyReviewEvent(
  progress: ReviewProgress,
  event: ReviewEvent,
  receivedAt: number,
): ReviewProgress {
  const next = { ...progress, receivedAt, serverElapsedMs: event.elapsedMs };
  if (event.type === "stage_started" && !progress.stages[event.stage])
    return {
      ...next,
      stages: {
        ...progress.stages,
        [event.stage]: { startedMs: event.elapsedMs },
      },
    };
  if (event.type !== "stage_updated" && event.type !== "stage_settled")
    return next;
  const stage = progress.stages[event.stage];
  if (!stage || stage.settled) return next;
  return {
    ...next,
    stages: {
      ...progress.stages,
      [event.stage]:
        event.type === "stage_updated"
          ? { ...stage, relatedPages: event.relatedPages }
          : { ...stage, settled: event },
    },
  };
}

export function reviewClock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function reviewDuration(ms: number) {
  if (ms < 1000) return "< 1s";
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
