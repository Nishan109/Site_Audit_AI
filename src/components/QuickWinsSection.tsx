"use client";
import { useState } from "react";
import type { QuickWin, FixStep } from "@/lib/types";
import {
  QUICK_WIN_AREAS,
  type QuickWinArea,
  type QuickWinsSelection,
} from "@/lib/quick-wins";
import {
  orderedQuickWins,
  quickWinKey,
  quickWinsPlan,
} from "@/lib/quick-wins-presentation";
import { issueSteps } from "@/lib/review-workspace";
import type { ReportSection } from "./navigation";
import ReviewEvidence, { ReviewSourceLink } from "./ReviewEvidence";
import { ReviewNotice, usePlanExport } from "./ReviewWorkspace";
import Icon from "./Icon";
import styles from "./ReviewWorkspace.module.css";
interface Props {
  quickWins: QuickWin[];
  url: string;
  selection?: QuickWinsSelection;
  findingCounts?: Partial<Record<QuickWinArea, number>>;
  onNavigate?: (section: ReportSection) => void;
  generatedFixSteps?: Record<string, FixStep[]>;
}
export default function QuickWinsSection({
  quickWins,
  url,
  selection,
  findingCounts = {},
  onNavigate,
  generatedFixSteps = {},
}: Props) {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [area, setArea] = useState<"all" | QuickWinArea>("all"),
    [status, setStatus] = useState<"all" | "todo" | "done">("all"),
    [sort, setSort] = useState<"effort" | "priority">("effort");
  const exporter = usePlanExport();
  const wins = quickWins.filter((win) => win.effort !== "High"),
    completed = wins.filter((win) => done.has(quickWinKey(win))).length;
  const ordered = orderedQuickWins(wins, sort),
    starting = ordered.find(({ key }) => !done.has(key))?.key;
  const visible = ordered.filter(
    ({ win, key }) =>
      (area === "all" || win.category === area) &&
      (status === "all" ||
        (status === "done" ? done.has(key) : !done.has(key))),
  );
  const verified =
    !!selection &&
    wins.every((win) => win.id && win.relatedIssue && win.category);
  const plan = (win?: QuickWin) =>
    quickWinsPlan(win ? [win] : wins, url, done, sort, generatedFixSteps);
  const copy = (win?: QuickWin) =>
    exporter.copy(
      plan(win),
      win
        ? "Task copied with its steps, evidence and manual status."
        : "Full shortlist copied, including hidden tasks, evidence and manual statuses.",
    );
  const toggle = (key: string) => {
    exporter.invalidate();
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <div className={styles.workspace} data-review-workspace="quickwins">
      <div className={styles.tools}>
        <p>A short, evidence-linked queue of smaller-effort improvements.</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => void copy()}
          >
            <Icon name="copy" width="15" height="15" />
            Copy shortlist
          </button>
          <button
            type="button"
            className={styles.button}
            aria-label="Download quick wins shortlist"
            onClick={() =>
              exporter.download(
                plan(),
                `${new URL(url).hostname}-quick-wins.txt`,
              )
            }
          >
            <Icon name="download" width="15" height="15" />
            Download .txt
          </button>
        </div>
      </div>
      {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
      <div className={styles.snapshot} aria-label="Task snapshot">
        {[
          {
            label: "Shortlisted tasks",
            value: wins.length,
            note: verified
              ? "Connected to reviewed findings"
              : "Suggestions from your saved report",
          },
          {
            label: "To do",
            value: wins.length - completed,
            note: "Estimated effort, not a time promise",
          },
          {
            label: "Marked done by you",
            value: completed,
            note: "Manual status · not re-tested",
          },
        ].map((metric) => (
          <div className={styles.metric} key={metric.label}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <strong className={styles.metricValue}>{metric.value}</strong>
            <span className={styles.metricNote}>{metric.note}</span>
          </div>
        ))}
      </div>
      <div className={styles.progress}>
        <progress
          aria-label="Tasks manually marked done"
          max={wins.length || 1}
          value={completed}
        />
        <span>
          {completed} of {wins.length} marked done
        </span>
        <span>
          Marking done does not re-test a fix or change your audit score.
        </span>
      </div>
      <section aria-label="Quick wins implementation queue">
        <div className={styles.sectionHeading}>
          <div>
            <h3>
              Your improvement queue <span>{wins.length}</span>
            </h3>
            <p>Expected benefits · not measured results</p>
          </div>
        </div>
        {!!wins.length && (
          <>
            <div className={styles.toolbar}>
              <div
                className={styles.filters}
                role="group"
                aria-label="Filter tasks by manual status"
              >
                {[
                  { key: "all", label: "All tasks", count: wins.length },
                  {
                    key: "todo",
                    label: "To do",
                    count: wins.length - completed,
                  },
                  { key: "done", label: "Marked done", count: completed },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    aria-pressed={status === item.key}
                    onClick={() => setStatus(item.key as typeof status)}
                  >
                    {item.label}
                    <span>{item.count}</span>
                  </button>
                ))}
              </div>
              <label className={styles.selectLabel}>
                Order by
                <select
                  aria-label="Order quick wins"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as typeof sort)
                  }
                >
                  <option value="effort">Lower effort first</option>
                  <option value="priority">Finding priority</option>
                </select>
              </label>
            </div>
            <div className={styles.toolbar}>
              <label className={styles.selectLabel}>
                Review area
                <select
                  aria-label="Quick wins review area"
                  value={area}
                  onChange={(event) =>
                    setArea(event.target.value as typeof area)
                  }
                >
                  <option value="all">All areas</option>
                  {QUICK_WIN_AREAS.filter((item) =>
                    wins.some((win) => win.category === item.key),
                  ).map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.resultCount}>
                <span role="status">
                  {visible.length} of {wins.length} tasks shown
                </span>
                {(area !== "all" || status !== "all") && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      setArea("all");
                      setStatus("all");
                    }}
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        <ol className={styles.queue} aria-label="Quick wins tasks">
          {visible.map(({ win, key }) => {
            const isDone = done.has(key),
              category = QUICK_WIN_AREAS.find(
                (item) => item.key === win.category,
              ),
              steps = win.relatedIssue
                ? issueSteps(win.relatedIssue, generatedFixSteps)
                : [];
            return (
              <li key={key}>
                <article className={styles.task} data-done={isDone}>
                  <div className={styles.findingMeta}>
                    <span>{category?.label || "Saved suggestion"}</span>
                    <span className={styles.effort} data-effort={win.effort}>
                      {win.effort} estimated effort
                    </span>
                    {win.relatedIssue && (
                      <span
                        className={styles.priority}
                        data-priority={win.relatedIssue.priority}
                      >
                        {win.relatedIssue.priority} priority
                      </span>
                    )}
                    {key === starting && (
                      <span className={styles.recommended}>
                        <Icon name="sparkle" width="13" height="13" />
                        Start here
                      </span>
                    )}
                    {isDone && (
                      <span className={styles.doneTag}>
                        Marked done · not re-tested
                      </span>
                    )}
                  </div>
                  <h4>{win.action}</h4>
                  <p>
                    <strong style={{ fontWeight: 500 }}>
                      Why it may help:{" "}
                    </strong>
                    {win.impact}
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <ReviewSourceLink url={win.pageUrl} />
                  </div>
                  <details className={styles.taskDetails}>
                    <summary>View steps & evidence</summary>
                    <div>
                      {win.relatedIssue ? (
                        <div className={styles.taskParent}>
                          <span>Underlying finding</span>
                          <strong>{win.relatedIssue.title}</strong>
                          <p>{win.relatedIssue.detail}</p>
                          {onNavigate && win.category && (
                            <button
                              type="button"
                              className={styles.textButton}
                              onClick={() => onNavigate(win.category!)}
                            >
                              Open {category?.label} review
                              <Icon name="arrow" width="13" height="13" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className={styles.metricNote}>
                          This saved suggestion has no linked finding. Run a
                          fresh audit to verify its context.
                        </p>
                      )}
                      {!!steps.length && (
                        <section>
                          <h5 className={styles.detailHeading}>
                            Steps from the underlying finding
                          </h5>
                          <ol className={styles.steps}>
                            {steps.map((step, index) => (
                              <li key={index}>
                                <div>
                                  <h5>{step.title}</h5>
                                  <p>{step.description}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </section>
                      )}
                      <section>
                        <h5 className={styles.detailHeading}>
                          Supporting evidence
                        </h5>
                        {!win.messagingEvidence?.length &&
                          !win.uxEvidence?.length &&
                          !win.seoEvidence?.length &&
                          !win.conversionEvidence?.length && (
                            <p className={styles.metricNote}>
                              Saved evidence · its type and linked finding were
                              not recorded. Run a fresh audit for the verified
                              shortlist.
                            </p>
                          )}
                        <ReviewEvidence
                          copy={win.messagingEvidence}
                          ux={win.uxEvidence}
                          seo={win.seoEvidence}
                          conversion={win.conversionEvidence}
                          plain={win.evidence}
                          pageUrl={win.pageUrl}
                          observation
                        />
                      </section>
                      <p className={styles.metricNote}>
                        Confirm the change fits the page, test the affected
                        behavior, then assess its effect with real data.
                      </p>
                    </div>
                  </details>
                  <div className={styles.taskActions}>
                    <button
                      type="button"
                      className={styles.complete}
                      aria-pressed={isDone}
                      aria-label={`${isDone ? "Mark as to do" : "Mark done"}: ${win.action}`}
                      onClick={() => toggle(key)}
                    >
                      <span>
                        <Icon name="check" width="14" height="14" />
                      </span>
                      {isDone ? "Marked done by you" : "Mark done"}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      aria-label={`Copy task: ${win.action}`}
                      onClick={() => void copy(win)}
                    >
                      <Icon name="copy" width="14" height="14" />
                      Copy task
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
        {!!wins.length && !visible.length && (
          <div className={styles.empty}>
            <h4>No tasks match these filters</h4>
            <p>
              {completed === wins.length
                ? "Your tasks are marked done locally. Re-test the affected pages to confirm the changes."
                : "Try another area or manual status to see the rest of your shortlist."}
            </p>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setArea("all");
                setStatus("all");
              }}
            >
              Show all tasks
            </button>
          </div>
        )}
        {!wins.length && (
          <div className={styles.empty}>
            <h4>No smaller-effort quick wins were supported in this sample.</h4>
            <p>
              Review the full findings for larger changes or questions that need
              live testing.
            </p>
            {onNavigate && (
              <button
                type="button"
                className={styles.button}
                onClick={() => onNavigate("overview")}
              >
                Explore all findings
                <Icon name="arrow" width="13" height="13" />
              </button>
            )}
          </div>
        )}
      </section>
      <p className={styles.metricNote}>
        Manual progress stays while you switch report sections. A new audit or
        page reload clears it. Download your shortlist to keep a record.
      </p>
      <details className={styles.support}>
        <summary>How this shortlist was selected</summary>
        <p>
          Fresh audits include only independently reviewed suggestions connected
          to retained findings, with source evidence and implementation steps.
          Lower estimated effort comes first, then finding priority. One task
          per finding is shortlisted; larger-effort work stays in the full
          audit.
        </p>
        {selection && (
          <dl className={styles.evidenceItem}>
            {[
              { label: "Reviewed suggestions", value: selection.reviewed },
              { label: "Included in the shortlist", value: selection.retained },
              {
                label: "Larger-effort work excluded",
                value: selection.highEffortExcluded,
              },
              {
                label: "Unlinked or unsupported suggestions excluded",
                value:
                  selection.unlinkedExcluded + selection.unsupportedExcluded,
              },
              {
                label: "Duplicate tasks excluded",
                value: selection.duplicatesExcluded,
              },
              {
                label: "Beyond the six-task limit",
                value: selection.overflowExcluded,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "6px 0",
                }}
              >
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p>
          Effort estimates do not include knowledge of your codebase. No uplift
          or completion time has been measured. Manual completion is your
          record, not an automated re-audit.
        </p>
        {onNavigate && (
          <div className={styles.areaLinks}>
            {QUICK_WIN_AREAS.map((item) => (
              <button
                type="button"
                className={styles.button}
                key={item.key}
                onClick={() => onNavigate(item.key)}
              >
                {item.label} · {findingCounts[item.key] ?? 0} retained findings
              </button>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
