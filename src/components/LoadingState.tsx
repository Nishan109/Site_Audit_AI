"use client";

import { useEffect, useRef, useState } from "react";
import {
  REVIEW_PHASES,
  REVIEW_QUIET_MS,
  REVIEW_STAGES,
  reviewClock,
  reviewDuration,
  type ReviewProgress,
  type StageProgress,
} from "@/lib/review-progress";
import Icon from "./Icon";
import styles from "./LoadingState.module.css";

type Stage = (typeof REVIEW_STAGES)[number];

function action(stage: Stage, progress?: StageProgress) {
  if (progress?.relatedPages === undefined) return stage[2];
  if (progress.relatedPages === 0)
    return "Submitted page read. Finishing evidence collection.";
  return `Submitted page read. Reading ${progress.relatedPages} related ${progress.relatedPages === 1 ? "page" : "pages"}.`;
}

function outcome(
  stage: Stage,
  progress: NonNullable<StageProgress["settled"]>,
) {
  if (progress.status === "unavailable")
    return "Continuing with collected website evidence.";
  if (progress.status === "failed") return "This step could not finish.";
  const count = progress.count;
  if (count === undefined) return "Work completed.";
  if (stage[0] === "evidence")
    return `${count} ${count === 1 ? "page" : "pages"} collected${progress.excluded ? ` · ${progress.excluded} excluded` : ""}.`;
  if (stage[0] === "research")
    return `${count} source ${count === 1 ? "link" : "links"} recorded${progress.queries === undefined ? "" : ` · ${progress.queries} search ${progress.queries === 1 ? "query" : "queries"}`}.`;
  if (stage[0] === "security" || stage[0] === "accessibility")
    return `${count} scoped ${count === 1 ? "check" : "checks"} recorded.`;
  if (stage[0] === "quick-wins")
    return `${count} ${count === 1 ? "suggestion" : "suggestions"} retained.`;
  return `${count} supported ${count === 1 ? "finding" : "findings"} retained.`;
}

function ActivityRow({
  stage,
  progress,
  stale,
}: {
  stage: Stage;
  progress?: StageProgress;
  stale: boolean;
}) {
  const settled = progress?.settled;
  const status = settled?.status ?? (progress ? "running" : "queued");
  const label = {
    complete: "Complete",
    unavailable: "Unavailable",
    failed: "Failed",
    running: stale ? "Last reported running" : "Running",
    queued: "Queued",
  }[status];
  const icon = {
    complete: "check",
    unavailable: "info",
    failed: "close",
    running: "bolt",
    queued: "clock",
  }[status] as "check" | "info" | "close" | "bolt" | "clock";
  return (
    <li
      className={styles.activityRow}
      data-stage={stage[0]}
      data-status={status}
    >
      <span className={styles.stageIcon}>
        <Icon name={icon} width="15" height="15" />
      </span>
      <div className={styles.activityCopy}>
        <strong>{stage[1]}</strong>
        <p>
          {settled
            ? outcome(stage, settled)
            : progress
              ? action(stage, progress)
              : "Waiting to start."}
        </p>
      </div>
      <div className={styles.activityMeta}>
        <span className={styles.stageBadge}>{label}</span>
        {settled && (
          <span className={styles.duration}>
            {reviewDuration(settled.durationMs)}
          </span>
        )}
      </div>
    </li>
  );
}

export function InterruptedReviewActivity({
  progress,
}: {
  progress: ReviewProgress;
}) {
  const reported = REVIEW_STAGES.filter(([id]) => progress.stages[id]);
  if (!reported.length) return null;
  return (
    <details className={`${styles.history} ${styles.interrupted}`}>
      <summary>
        Activity before the review stopped{" "}
        <Icon name="down" width="15" height="15" />
      </summary>
      <ul className={styles.activityList}>
        {reported.map((stage) => (
          <ActivityRow
            key={stage[0]}
            stage={stage}
            progress={progress.stages[stage[0]]}
            stale
          />
        ))}
      </ul>
    </details>
  );
}

export default function LoadingState({
  url,
  progress,
  onCancel,
}: {
  url: string;
  progress: ReviewProgress;
  onCancel: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(progress.startedAt);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const tick = () => setNow(performance.now());
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const elapsed = Math.max(0, now - progress.startedAt);
  const stale =
    now - (progress.receivedAt ?? progress.startedAt) >= REVIEW_QUIET_MS;
  const connection =
    progress.receivedAt === undefined
      ? stale
        ? "Live stage details unavailable"
        : "Connecting"
      : stale
        ? "Waiting for an update"
        : "Live activity";
  const active = REVIEW_STAGES.filter(
    ([id]) => progress.stages[id] && !progress.stages[id]?.settled,
  );
  const completed = REVIEW_STAGES.filter(
    ([id]) => progress.stages[id]?.settled,
  ).sort(([a], [b]) => {
    const first = progress.stages[a]!;
    const second = progress.stages[b]!;
    return (
      second.startedMs +
      second.settled!.durationMs -
      first.startedMs -
      first.settled!.durationMs
    );
  });
  const evidenceCount = progress.stages.evidence?.settled?.count;
  const limitedResearch =
    progress.stages.research?.settled?.status === "unavailable";
  const excludedPages = progress.stages.evidence?.settled?.excluded ?? 0;
  const address = url.replace(/^https?:\/\//i, "");
  const pathStart = address.search(/[/?#]/);
  const announcement = active.length
    ? `${connection}. ${active.map((stage) => stage[1]).join(" and ")}. ${limitedResearch ? "Web research unavailable. Continuing with collected pages." : ""}`
    : connection;
  return (
    <section
      className={styles.workspace}
      aria-labelledby="review-loading-title"
      data-review-progress
    >
      <div className={styles.intro}>
        <div className={styles.eyebrow}>
          <Icon name="chart" width="15" height="15" /> Website review
        </div>
        <h1 id="review-loading-title" ref={heading} tabIndex={-1}>
          Reviewing your website
        </h1>
        <p className={styles.address}>
          <Icon name="globe" width="16" height="16" />
          <span>
            <strong>
              {pathStart < 0 ? address : address.slice(0, pathStart)}
            </strong>
            {pathStart >= 0 && address.slice(pathStart)}
          </span>
        </p>
      </div>
      <p className="sr-only" role="status">
        {announcement}
      </p>

      <div className={styles.overview}>
        <section
          className={styles.current}
          aria-labelledby="review-active-title"
        >
          <header className={styles.panelHeader}>
            <h2 id="review-active-title">
              {stale && active.length
                ? "Last reported activity"
                : "Currently working on"}
            </h2>
            <span
              className={styles.connection}
              data-live={connection === "Live activity"}
            >
              <span aria-hidden="true" />
              {connection}
            </span>
          </header>
          {active.length ? (
            <ul className={styles.activeList}>
              {active.map((stage) => {
                const item = progress.stages[stage[0]]!;
                const stageElapsed = Math.max(
                  0,
                  progress.serverElapsedMs -
                    item.startedMs +
                    Math.max(0, now - (progress.receivedAt ?? now)),
                );
                return (
                  <li key={stage[0]}>
                    <span className={styles.activeIcon}>
                      <Icon
                        name={stage[0] === "evidence" ? "file" : "bolt"}
                        width="17"
                        height="17"
                      />
                    </span>
                    <div>
                      <strong>{stage[1]}</strong>
                      <p>{action(stage, item)}</p>
                    </div>
                    {!stale && (
                      <span
                        className={styles.runningTime}
                        title="Approximate stage elapsed time"
                      >
                        {reviewClock(stageElapsed)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.starting}>
              <span className={styles.activeIcon}>
                <Icon name="clock" width="18" height="18" />
              </span>
              <p>
                {progress.receivedAt === undefined
                  ? "Waiting for the first update from the review service."
                  : "Waiting for the next stage update."}
              </p>
            </div>
          )}
          {evidenceCount !== undefined && (
            <p className={styles.coverage}>
              <Icon name="file" width="14" height="14" />
              {evidenceCount} {evidenceCount === 1 ? "page" : "pages"} collected
            </p>
          )}
          {(limitedResearch || excludedPages > 0) && (
            <p className={styles.limitation}>
              <Icon name="info" width="15" height="15" />
              <span>
                {limitedResearch &&
                  "Web research unavailable. Continuing with collected pages."}
                {excludedPages > 0 &&
                  ` ${excludedPages} related ${excludedPages === 1 ? "page could" : "pages could"} not be read.`}
              </span>
            </p>
          )}
        </section>

        <aside className={styles.timing} aria-labelledby="review-timing-title">
          <h2 id="review-timing-title">
            <Icon name="clock" width="17" height="17" /> Time elapsed
          </h2>
          <p className={styles.clock} data-review-elapsed>
            {reviewClock(elapsed)}
          </p>
          <p className={styles.timingNote}>
            Finish time varies with the website and review workload. Keep this
            page open.
          </p>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel review
          </button>
        </aside>
      </div>

      <ol className={styles.phases} aria-label="Review phases">
        {REVIEW_PHASES.map((phase, index) => {
          const entries = phase.stages.map(([id]) => progress.stages[id]);
          const failed = entries.some(
            (item) => item?.settled?.status === "failed",
          );
          const settled = entries.every((item) => item?.settled);
          const limited = entries.some(
            (item) =>
              item?.settled?.status === "unavailable" ||
              (item?.settled?.excluded ?? 0) > 0,
          );
          const started = entries.some(Boolean);
          const state = failed
            ? "failed"
            : settled
              ? limited
                ? "limited"
                : "complete"
              : started
                ? "running"
                : "queued";
          const label = {
            failed: "Failed",
            limited: "Complete with limits",
            complete: "Complete",
            running: stale ? "Awaiting update" : "In progress",
            queued: "Queued",
          }[state];
          return (
            <li key={phase.id} className={styles.phase} data-state={state}>
              <span className={styles.phaseNumber}>
                {settled && !failed ? (
                  <Icon
                    name={limited ? "info" : "check"}
                    width="16"
                    height="16"
                  />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <div>
                <strong>{phase.label}</strong>
                <p>{label}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <section
        className={styles.activity}
        aria-labelledby="review-activity-title"
      >
        <header className={styles.panelHeader}>
          <div>
            <h2 id="review-activity-title">Agent and check activity</h2>
            <p>Recent outcomes and recorded stage durations</p>
          </div>
          {completed.length > 0 && (
            <span className={styles.activityCount}>
              {completed.length} finished
            </span>
          )}
        </header>
        {completed.length > 0 ? (
          <ul className={styles.activityList} aria-label="Recent activity">
            {completed.slice(0, 3).map((stage) => (
              <ActivityRow
                key={stage[0]}
                stage={stage}
                progress={progress.stages[stage[0]]}
                stale={stale}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.emptyActivity}>
            Finished stages will appear here as they report back.
          </p>
        )}
        <details className={styles.history}>
          <summary>
            All activity <Icon name="down" width="15" height="15" />
          </summary>
          {REVIEW_PHASES.map((phase) => (
            <div key={phase.id} className={styles.historyGroup}>
              <h3>{phase.label}</h3>
              <ul className={styles.activityList}>
                {phase.stages.map((stage) => (
                  <ActivityRow
                    key={stage[0]}
                    stage={stage}
                    progress={progress.stages[stage[0]]}
                    stale={stale}
                  />
                ))}
              </ul>
            </div>
          ))}
        </details>
      </section>
    </section>
  );
}
