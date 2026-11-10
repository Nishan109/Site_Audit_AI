import type {
  InitialReviewTiming,
  ReviewStageEvent,
  ReviewStageId,
  ReviewStageOutcome,
} from "../review-progress";

export function auditActivity(
  signal: AbortSignal,
  emit?: (event: ReviewStageEvent) => void,
) {
  const started = performance.now();
  const stages: InitialReviewTiming["stages"] = [];

  return {
    async run<T>(
      stage: ReviewStageId,
      operation: () => T | Promise<T>,
      outcome: (result: T) => ReviewStageOutcome = () => ({
        status: "complete",
      }),
    ): Promise<T> {
      signal.throwIfAborted();
      const start = performance.now();
      emit?.({ type: "stage_started", stage });
      try {
        const result = await operation();
        signal.throwIfAborted();
        const details = outcome(result);
        const durationMs = Math.round(performance.now() - start);
        if (details.status !== "failed")
          stages.push({ stage, durationMs, status: details.status });
        emit?.({ ...details, type: "stage_settled", stage, durationMs });
        return result;
      } catch (error) {
        if (!signal.aborted)
          emit?.({
            type: "stage_settled",
            stage,
            status: "failed",
            durationMs: Math.round(performance.now() - start),
          });
        throw error;
      }
    },
    timing(): InitialReviewTiming {
      return { durationMs: Math.round(performance.now() - started), stages };
    },
  };
}
