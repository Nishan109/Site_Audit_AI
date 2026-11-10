"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AccessibilityAudit } from "@/lib/types";
import {
  ACCESSIBILITY_MANUAL_CHECKS,
  accessibilityActions,
  type AccessibilityArea,
  type AccessibilityCheck,
} from "@/lib/accessibility";
import {
  accessibilityCheckIdentity,
  accessibilityPlan,
} from "@/lib/accessibility-presentation";
import type { AccessibilityRefresh } from "@/lib/accessibility-refresh";
import { reportTime } from "@/lib/dashboard-evidence";
import { sourceURL } from "@/lib/source-url";
import AccessibilityPageChecks, {
  AccessibilityObservations,
  AccessibilityPageSource,
  accessibilityPageLabel,
  type CheckFilter,
} from "./AccessibilityPageChecks";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import { ReviewNotice, usePlanExport } from "./ReviewWorkspace";
import { useAccessibilityResults } from "./useAccessibilityResults";
import shared from "./ReviewWorkspace.module.css";
import layout from "./UXSection.module.css";
import workbench from "./ConversionSection.module.css";
import styles from "./AccessibilitySection.module.css";

const areas: Record<AccessibilityArea, string> = {
  content: "Content & alternatives",
  navigation: "Navigation & names",
  forms: "Form labels",
  semantics: "Structure & relationships",
};
const [, names, , , meaning] = ACCESSIBILITY_MANUAL_CHECKS;
const verification: Record<AccessibilityCheck["key"], typeof names> = {
  language: names,
  title: meaning,
  headings: meaning,
  images: meaning,
  fields: names,
  controls: names,
  links: names,
  references: names,
  regions: meaning,
};

export default function AccessibilitySection({
  audit: supplied,
  url,
  onAccessibilityUpdated,
  active = true,
}: {
  audit?: AccessibilityAudit;
  url: string;
  onAccessibilityUpdated?: (update: AccessibilityRefresh) => void;
  active?: boolean;
}) {
  const id = useId();
  const [view, setView] = useState<"plan" | "checks">("plan");
  const [pageKey, setPageKey] = useState("");
  const [checkFilter, setCheckFilter] = useState<CheckFilter>("all");
  const [openCheck, setOpenCheck] = useState("");
  const [taskKey, setTaskKey] = useState("");
  const [area, setArea] = useState<AccessibilityArea | "">("");
  const [showAll, setShowAll] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState("");
  const checkFocus = useRef<HTMLButtonElement>(null);
  const checksHeading = useRef<HTMLHeadingElement>(null);
  const taskFocus = useRef<HTMLHeadingElement>(null);
  const manualFocus = useRef<HTMLHeadingElement>(null);
  const areaSelect = useRef<HTMLSelectElement>(null);
  const focusTarget = useRef<"check" | "task" | "checks-heading" | null>(null);
  const exporter = usePlanExport();
  const { audit, loading, error, refresh } = useAccessibilityResults(
    url,
    supplied,
    (update) => {
      const next = update.audit.review;
      const priorPage = pageKey;
      const priorTask = taskKey;
      const retainedPage =
        priorPage &&
        next.pages.some((item) => sourceURL(item.url) === priorPage);
      const retainedTask =
        priorTask &&
        accessibilityActions(next).some(
          (item) => accessibilityCheckIdentity(item) === priorTask,
        );
      setPageKey(retainedPage ? priorPage : "");
      setTaskKey(retainedTask ? priorTask : "");
      if (priorPage && !retainedPage) {
        setOpenCheck("");
        setCheckFilter("all");
      }
      setSelectionNotice(
        (priorPage && !retainedPage) || (priorTask && !retainedTask)
          ? "A previous selection is no longer available. Choose from the refreshed results below."
          : "",
      );
      exporter.invalidate();
      onAccessibilityUpdated?.(update);
    },
    active,
  );

  useEffect(() => {
    if (focusTarget.current === "check") checkFocus.current?.focus();
    if (focusTarget.current === "task") taskFocus.current?.focus();
    if (focusTarget.current === "checks-heading")
      checksHeading.current?.focus();
    focusTarget.current = null;
  }, [view]);

  const review = audit?.review;
  const pages = review?.pages ?? [];
  const page =
    pages.find((item) => sourceURL(item.url) === pageKey) ?? pages[0];
  const tasks = review ? accessibilityActions(review) : [];
  const matching = tasks.filter((check) => !area || check.area === area);
  const selected =
    matching.find((check) => accessibilityCheckIdentity(check) === taskKey) ??
    matching[0];
  const selectedIndex = matching.indexOf(selected);
  const visibleTasks = showAll
    ? matching
    : matching.filter(
        (check, index) =>
          index < (selectedIndex >= 5 ? 4 : 5) || check === selected,
      );
  const selectedPage =
    selected &&
    pages.find((item) => sourceURL(item.url) === sourceURL(selected.pageUrl));
  const collectedAt =
    audit?.checkedAt ?? pages.find((item) => item.collected)?.fetchedAt;
  const requested = sourceURL(audit?.requestedUrl ?? url);
  const destination = pages[0] && sourceURL(pages[0].url);
  const manualChecks = review?.notTested.length
    ? review.notTested
    : ACCESSIBILITY_MANUAL_CHECKS;
  const plan = () => accessibilityPlan(audit, url);

  function collect() {
    setSelectionNotice("");
    if (page) setPageKey(sourceURL(page.url) ?? "");
    if (selected) setTaskKey(accessibilityCheckIdentity(selected));
    void refresh();
  }

  function inspect(check: AccessibilityCheck) {
    setPageKey(sourceURL(check.pageUrl) ?? "");
    setOpenCheck(accessibilityCheckIdentity(check));
    if (checkFilter !== "all" && checkFilter !== check.status)
      setCheckFilter("all");
    focusTarget.current = "check";
    setView("checks");
  }

  function viewTask(check: AccessibilityCheck) {
    if (area && area !== check.area) setArea("");
    setTaskKey(accessibilityCheckIdentity(check));
    focusTarget.current = "task";
    setView("plan");
  }

  return (
    <div
      className={`${shared.workspace} ${layout.workspace} ${styles.workspace}`}
      data-review-workspace="accessibility"
    >
      <section
        className={styles.snapshot}
        aria-label="Accessibility collection"
      >
        <div className={styles.snapshotTop}>
          <div className={styles.identity}>
            <span className={workbench.pageIcon}>
              <Icon name="access" />
            </span>
            <div>
              <span className={styles.scopeBadge}>HTML observations</span>
              <p>
                Review what the collected page markup shows and what to verify
                in a browser.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={shared.button}
            disabled={loading}
            onClick={collect}
          >
            <Icon name="refresh" width="15" height="15" />
            {loading
              ? review
                ? "Refreshing checks…"
                : "Collecting checks…"
              : error
                ? "Retry accessibility checks"
                : review
                  ? "Refresh checks"
                  : "Collect accessibility checks"}
          </button>
        </div>
        {review && (
          <dl className={styles.metrics}>
            <div>
              <dt>Pages with HTML evidence</dt>
              <dd>
                {review.scope.collected}
                {review.scope.collected < review.scope.pages && (
                  <small> of {review.scope.pages} in scope</small>
                )}
              </dd>
            </div>
            <div>
              <dt>Review tasks</dt>
              <dd>{tasks.length}</dd>
            </div>
            {collectedAt && (
              <div>
                <dt>
                  {audit.checkedAt
                    ? "Last collected"
                    : "First evidence page fetched"}
                </dt>
                <dd className={styles.timestamp}>
                  <time dateTime={collectedAt}>{reportTime(collectedAt)}</time>
                </dd>
              </div>
            )}
          </dl>
        )}
        {review && audit?.requestedUrl && requested !== destination && (
          <dl className={styles.redirect}>
            <div>
              <dt>Requested page</dt>
              <dd>{requested}</dd>
            </div>
            <div>
              <dt>Final fetched page</dt>
              <dd>{destination}</dd>
            </div>
          </dl>
        )}
        <div className={styles.snapshotFoot}>
          <span>
            {review?.scope.sampled
              ? "Some observations are sampled."
              : "Browser and assistive-technology tests require manual review."}
          </span>
          <a
            href={`#${id}-manual`}
            onClick={() => manualFocus.current?.focus()}
          >
            Manual testing guide <Icon name="down" width="13" height="13" />
          </a>
        </div>
      </section>
      <div className={styles.collectionStatus} role="status">
        {loading &&
          (review
            ? "Refreshing HTML evidence. The last collected results remain available."
            : "Collecting public page HTML. This runs separately from the website audit.")}
        {!loading && selectionNotice}
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <Icon name="info" width="18" height="18" />
          <div>
            <strong>Accessibility results could not be updated.</strong>
            <p>{error}</p>
            {review && <p>Your last collected results are still shown.</p>}
          </div>
        </div>
      )}
      {!review && !loading && (
        <div className={styles.empty}>
          <h3>Accessibility evidence is unavailable</h3>
          <p>
            Collect page HTML to see specific checks and review steps. You can
            use the manual testing guide while collection is unavailable.
          </p>
        </div>
      )}
      {review && page && (
        <>
          <div className={styles.viewBar}>
            <div
              className={workbench.views}
              role="group"
              aria-label="Accessibility workspace views"
            >
              <button
                type="button"
                aria-pressed={view === "plan"}
                aria-controls={`${id}-plan`}
                onClick={() => setView("plan")}
              >
                <Icon name="layers" width="17" height="17" /> Review plan{" "}
                <span>{tasks.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={view === "checks"}
                aria-controls={`${id}-checks`}
                onClick={() => setView("checks")}
              >
                <Icon name="file" width="17" height="17" /> Page checks
              </button>
            </div>
            <div
              className={`${shared.actions} ${styles.exportActions}`}
              role="group"
              aria-label="Export accessibility review plan"
            >
              <button
                type="button"
                className={shared.button}
                onClick={() =>
                  void exporter.copy(
                    plan(),
                    "Accessibility review plan copied.",
                  )
                }
              >
                <Icon name="copy" width="15" height="15" /> Copy review plan
              </button>
              <button
                type="button"
                className={shared.button}
                aria-label="Download review plan (.txt)"
                onClick={() =>
                  exporter.download(
                    plan(),
                    `${requested ? new URL(requested).hostname : "website"}-accessibility-review.txt`,
                  )
                }
              >
                <Icon name="download" width="15" height="15" /> Download review
                plan
              </button>
            </div>
          </div>
          {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
          <section
            id={`${id}-plan`}
            hidden={view !== "plan"}
            aria-labelledby={`${id}-plan-title`}
          >
            <div className={workbench.workArea}>
              <header className={workbench.heading}>
                <h3 id={`${id}-plan-title`}>Prioritized review tasks</h3>
                <p>
                  Choose a task to see the evidence and suggested steps.
                  Priorities reflect the collected HTML.
                </p>
              </header>
              {!!tasks.length && (
                <div className={styles.filterLine}>
                  <label className={workbench.field}>
                    Review area
                    <select
                      ref={areaSelect}
                      value={area}
                      onChange={(event) =>
                        setArea(event.target.value as typeof area)
                      }
                    >
                      <option value="">All areas ({tasks.length})</option>
                      {(Object.keys(areas) as AccessibilityArea[]).map(
                        (key) => (
                          <option value={key} key={key}>
                            {areas[key]} (
                            {tasks.filter((check) => check.area === key).length}
                            )
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <p role="status">
                    {matching.length} of {tasks.length} review tasks match
                  </p>
                  {area && (
                    <button
                      type="button"
                      className={shared.button}
                      onClick={() => {
                        setArea("");
                        areaSelect.current?.focus();
                      }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              )}
              {!tasks.length && (
                <div className={styles.empty}>
                  <h4>No review tasks in the collected sample</h4>
                  <p>
                    Inspect the page observations or use the guide to test how
                    the website works in a browser.
                  </p>
                  <button
                    type="button"
                    className={shared.button}
                    onClick={() => {
                      focusTarget.current = "checks-heading";
                      setView("checks");
                    }}
                  >
                    Open page checks
                  </button>
                  <a
                    href={`#${id}-manual`}
                    onClick={() => manualFocus.current?.focus()}
                  >
                    Manual testing guide
                  </a>
                </div>
              )}
              {!!tasks.length && !matching.length && (
                <div className={styles.empty}>
                  <h4>No review tasks match this area</h4>
                  <p>Reset the area filter to see all {tasks.length} tasks.</p>
                </div>
              )}
              {selected && selectedPage && (
                <div className={styles.taskLayout}>
                  <div className={`${layout.queue} ${styles.queue}`}>
                    <div className={styles.queueHeader}>
                      <h4>Review queue</h4>
                      <span>{visibleTasks.length} shown</span>
                    </div>
                    <div
                      className={`${layout.queueList} ${styles.queueList}`}
                      id={`${id}-queue`}
                    >
                      {visibleTasks.map((check) => (
                        <button
                          type="button"
                          key={accessibilityCheckIdentity(check)}
                          aria-pressed={check === selected}
                          onClick={() =>
                            setTaskKey(accessibilityCheckIdentity(check))
                          }
                        >
                          <span className={layout.queueMeta}>
                            <span
                              className={layout.priority}
                              data-priority={check.priority}
                            >
                              {check.priority} priority
                            </span>
                            {check === tasks[0] && (
                              <span className={layout.selectedLabel}>
                                Start here
                              </span>
                            )}
                          </span>
                          <strong>{check.title}</strong>
                          <span className={layout.queuePage}>
                            {accessibilityPageLabel(check.pageUrl)}
                          </span>
                        </button>
                      ))}
                      {matching.length > 5 && (
                        <button
                          type="button"
                          className={layout.showAll}
                          aria-controls={`${id}-queue`}
                          aria-expanded={showAll}
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll
                            ? "Show fewer tasks"
                            : `Show all ${matching.length} tasks`}
                        </button>
                      )}
                    </div>
                  </div>
                  <label className={`${workbench.field} ${styles.taskPicker}`}>
                    Review task
                    <select
                      value={accessibilityCheckIdentity(selected)}
                      onChange={(event) => setTaskKey(event.target.value)}
                    >
                      {matching.map((check) => (
                        <option
                          key={accessibilityCheckIdentity(check)}
                          value={accessibilityCheckIdentity(check)}
                        >
                          {check === tasks[0] ? "Start here · " : ""}
                          {check.title} · {check.priority} ·{" "}
                          {accessibilityPageLabel(check.pageUrl)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <article
                    className={styles.task}
                    key={accessibilityCheckIdentity(selected)}
                    aria-labelledby={`${id}-task-title`}
                  >
                    <header>
                      <div className={layout.findingMeta}>
                        <span
                          className={layout.priority}
                          data-priority={selected.priority}
                        >
                          {selected.priority} priority
                        </span>
                        <span>{areas[selected.area]}</span>
                        {selected === tasks[0] && (
                          <span className={styles.scopeBadge}>
                            Recommended starting point
                          </span>
                        )}
                      </div>
                      <h4 id={`${id}-task-title`} tabIndex={-1} ref={taskFocus}>
                        {selected.title}
                      </h4>
                      <p>{selected.detail}</p>
                    </header>
                    <section>
                      <h5>
                        <Icon name="file" width="16" height="16" /> Evidence
                        from the page
                      </h5>
                      <AccessibilityPageSource page={selectedPage} />
                      <AccessibilityObservations
                        rows={selected.observations.slice(0, 1)}
                      />
                      {selected.observations.length > 1 && (
                        <details className={styles.evidenceDisclosure}>
                          <summary>
                            Show {selected.observations.length - 1} more{" "}
                            {selected.observations.length === 2
                              ? "observation"
                              : "observations"}
                          </summary>
                          <AccessibilityObservations
                            rows={selected.observations.slice(1)}
                          />
                        </details>
                      )}
                      <p>{selected.context}</p>
                      <button
                        type="button"
                        className={shared.button}
                        onClick={() => inspect(selected)}
                      >
                        Inspect source check{" "}
                        <Icon name="arrow" width="15" height="15" />
                      </button>
                    </section>
                    <section>
                      <h5>
                        <Icon name="pen" width="16" height="16" /> How to
                        address it
                      </h5>
                      <ol className={styles.steps}>
                        {selected.steps.map((step, index) => (
                          <li key={`${step.title}-${index}`}>
                            <strong>{step.title}</strong>
                            <p>{step.description}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                    <section className={styles.verify}>
                      <h5>
                        <Icon name="eye" width="16" height="16" /> How to verify
                        in a browser
                      </h5>
                      <p>{verification[selected.key].instructions}</p>
                      <div className={styles.actions}>
                        <ReviewSourceLink
                          url={selected.reference}
                          label="Related W3C guidance"
                        />
                        <a
                          href={`#${id}-manual`}
                          onClick={() => manualFocus.current?.focus()}
                        >
                          Manual testing guide
                        </a>
                      </div>
                    </section>
                  </article>
                </div>
              )}
            </div>
          </section>
          <section
            id={`${id}-checks`}
            hidden={view !== "checks"}
            aria-labelledby={`${id}-checks-title`}
          >
            <AccessibilityPageChecks
              headingId={`${id}-checks-title`}
              headingRef={checksHeading}
              pages={pages}
              page={page}
              filter={checkFilter}
              openCheck={openCheck}
              checkFocus={checkFocus}
              loading={loading}
              onPage={(key) => {
                setPageKey(key);
                setCheckFilter("all");
              }}
              onFilter={setCheckFilter}
              onToggle={setOpenCheck}
              onTask={viewTask}
              onRefresh={collect}
            />
          </section>
        </>
      )}
      <section className={styles.manual} aria-labelledby={`${id}-manual`}>
        <header>
          <span className={styles.scopeBadge}>Requires browser testing</span>
          <h3 id={`${id}-manual`} ref={manualFocus} tabIndex={-1}>
            Manual testing guide
          </h3>
          <p>
            Use these steps to verify the rendered website. The HTML
            observations cover collected markup only.
          </p>
        </header>
        <div>
          {manualChecks.map((check, index) => (
            <details key={check.title}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {check.title}
                <Icon name="down" width="15" height="15" />
              </summary>
              <p>{check.instructions}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
