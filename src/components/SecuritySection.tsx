"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FixStep, SecurityAudit } from "@/lib/types";
import {
  SECURITY_NOT_TESTED,
  securityActions,
  type SecurityArea,
  type SecurityCheck,
} from "@/lib/security";
import {
  SECURITY_AREAS,
  SECURITY_VERIFICATION,
  securityCheckIdentity,
  securityPlan,
  securitySteps,
} from "@/lib/security-presentation";
import type { SecurityRefresh } from "@/lib/security-refresh";
import { reportTime } from "@/lib/dashboard-evidence";
import { sourceURL } from "@/lib/source-url";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import { ReviewNotice, ReviewTools, usePlanExport } from "./ReviewWorkspace";
import SecurityPageSignals, {
  initialSignalFilters,
  securityAreas,
  SecurityObservations,
  SecurityStatusBadge,
} from "./SecurityPageSignals";
import { useSecurityResults } from "./useSecurityResults";
import shared from "./ReviewWorkspace.module.css";
import layout from "./UXSection.module.css";
import workbench from "./ConversionSection.module.css";
import styles from "./SecuritySection.module.css";

const priorities = ["All priorities", "High", "Medium", "Low"] as const;
const initialPlanFilters = {
  priority: "All priorities" as (typeof priorities)[number],
  area: "" as SecurityArea | "",
  page: "",
};
type View = "plan" | "signals";

export default function SecuritySection({
  audit: suppliedAudit,
  url,
  generatedFixSteps,
  onSecurityUpdated,
  active = true,
}: {
  audit?: SecurityAudit;
  url: string;
  generatedFixSteps: Record<string, FixStep[]>;
  onSecurityUpdated?: (update: SecurityRefresh) => void;
  active?: boolean;
}) {
  const id = useId();
  const [view, setView] = useState<View>("plan");
  const [showAll, setShowAll] = useState(false);
  const [taskKey, setTaskKey] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [openSignal, setOpenSignal] = useState("");
  const [filters, setFilters] = useState(initialPlanFilters);
  const [signalFilters, setSignalFilters] = useState(initialSignalFilters);
  const planHeading = useRef<HTMLHeadingElement>(null);
  const signalHeading = useRef<HTMLHeadingElement>(null);
  const signalEvidence = useRef<HTMLHeadingElement>(null);
  const taskPanel = useRef<HTMLElement>(null);
  const focusView = useRef<View | null>(null);
  const allPriority = useRef<HTMLButtonElement>(null);
  const exporter = usePlanExport();

  const { audit, loading, error, refresh } = useSecurityResults(
    url,
    suppliedAudit,
    (update) => {
      const pages = new Set(
        update.audit.review.pages.map((page) => sourceURL(page.url)),
      );
      const signals = new Set(
        update.audit.review.pages.flatMap((page) =>
          page.checks.map(securityCheckIdentity),
        ),
      );
      const tasks = new Set(
        securityActions(update.audit.review).map(securityCheckIdentity),
      );
      setPageUrl((value) => (pages.has(value) ? value : ""));
      setOpenSignal((value) => (signals.has(value) ? value : ""));
      setTaskKey((value) => (tasks.has(value) ? value : ""));
      setFilters((value) =>
        value.page && !pages.has(value.page) ? { ...value, page: "" } : value,
      );
      exporter.invalidate();
      onSecurityUpdated?.(update);
    },
    active,
  );

  useEffect(() => {
    if (focusView.current !== view) return;
    (view === "plan"
      ? (taskPanel.current ?? planHeading.current)
      : (signalEvidence.current ?? signalHeading.current)
    )?.focus();
    focusView.current = null;
  }, [view]);

  const review = audit?.review;
  const pages = review?.pages ?? [];
  const page =
    pages.find((item) => sourceURL(item.url) === pageUrl) ?? pages[0];
  const tasks = review ? securityActions(review) : [];
  const pageTasks = tasks.filter(
    (check) => !filters.page || sourceURL(check.pageUrl) === filters.page,
  );
  const areaTasks = pageTasks.filter(
    (check) => !filters.area || check.area === filters.area,
  );
  const matching = areaTasks.filter(
    (check) =>
      filters.priority === "All priorities" ||
      check.priority === filters.priority,
  );
  const selected =
    matching.find((check) => securityCheckIdentity(check) === taskKey) ??
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
  const filtered =
    !!filters.page || !!filters.area || filters.priority !== "All priorities";
  const audited = sourceURL(url);
  const collectedAt = audit?.checkedAt ?? pages[0]?.fetchedAt;
  const plan = () => securityPlan(audit, url, generatedFixSteps);

  function collect() {
    if (page) setPageUrl((value) => value || sourceURL(page.url) || "");
    if (selected)
      setTaskKey((value) => value || securityCheckIdentity(selected));
    void refresh();
  }

  function changePage(next: string) {
    setPageUrl(next);
    setOpenSignal("");
    setSignalFilters(initialSignalFilters);
  }

  function inspect(check?: SecurityCheck) {
    if (check) {
      changePage(sourceURL(check.pageUrl) || "");
      setOpenSignal(securityCheckIdentity(check));
    } else if (filters.page) {
      changePage(filters.page);
    }
    focusView.current = "signals";
    setView("signals");
  }

  function viewTask(check: SecurityCheck) {
    setFilters(initialPlanFilters);
    setTaskKey(securityCheckIdentity(check));
    focusView.current = "plan";
    setView("plan");
  }

  return (
    <div
      className={`${shared.workspace} ${layout.workspace} ${styles.workspace}`}
      data-review-workspace="security"
    >
      {review ? (
        <ReviewTools
          copyLabel="Copy security plan"
          downloadLabel="Download security plan (.txt)"
          downloadText="Download security plan"
          onCopy={() =>
            void exporter.copy(
              plan(),
              "Security plan copied with all collected checks and review steps.",
            )
          }
          onDownload={() =>
            exporter.download(
              plan(),
              `${audited ? new URL(audited).hostname : "website"}-security-review.txt`,
            )
          }
        >
          Inspect the settings recorded on your public pages and review the
          changes worth checking.
        </ReviewTools>
      ) : (
        <p className={styles.intro}>
          Inspect the settings recorded on your public pages and review the
          changes worth checking.
        </p>
      )}
      {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
      <div className={styles.collection}>
        <div className={styles.collectionIdentity}>
          <span className={workbench.pageIcon}>
            <Icon name="shield" width="20" height="20" />
          </span>
          <div>
            <p role="status">
              <strong>
                {loading
                  ? review
                    ? "Refreshing security checks"
                    : "Collecting security evidence"
                  : review
                    ? "Results collected"
                    : "Collection needs a retry"}
              </strong>
            </p>
            <p className={styles.meta}>
              {collectedAt ? (
                <>
                  {loading || error
                    ? "Last successful collection"
                    : audit?.checkedAt
                      ? "Security refresh"
                      : "Original audit · Primary page collected"}{" "}
                  ·{" "}
                  <time dateTime={collectedAt}>{reportTime(collectedAt)}</time>
                </>
              ) : (
                audited || url
              )}
            </p>
            {review &&
              audit?.requestedUrl &&
              sourceURL(audit.requestedUrl) !== sourceURL(pages[0].url) && (
                <dl className={styles.redirect}>
                  <div>
                    <dt>Requested page</dt>
                    <dd>{sourceURL(audit.requestedUrl)}</dd>
                  </div>
                  <div>
                    <dt>Final fetched page</dt>
                    <dd>{sourceURL(pages[0].url)}</dd>
                  </div>
                </dl>
              )}
          </div>
        </div>
        <button
          type="button"
          className={layout.button}
          disabled={loading}
          onClick={collect}
        >
          <Icon name="refresh" width="15" height="15" />
          {loading
            ? review
              ? "Refreshing checks…"
              : "Collecting checks…"
            : error
              ? "Retry security checks"
              : "Refresh checks"}
        </button>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <Icon name="info" width="17" height="17" />
          <div>
            <strong>Security results could not be updated.</strong>
            <p>{error}</p>
            {review && (
              <p>Your last collected results are still shown below.</p>
            )}
          </div>
        </div>
      )}
      {!review && loading && (
        <div className={styles.pending}>
          <h3>Checking your website’s security signals</h3>
          <p>
            Reading the public page and its response headers. This collection
            runs separately from the website audit.
          </p>
        </div>
      )}
      {review && page && (
        <>
          <div className={styles.snapshot}>
            <div className={styles.snapshotHeader}>
              <strong>Collection snapshot</strong>
              <span>Public response headers and initial HTML</span>
            </div>
            <dl className={styles.metrics}>
              <div>
                <dt>Pages inspected</dt>
                <dd>{review.scope.pages}</dd>
              </div>
              <div>
                <dt>Responses with headers</dt>
                <dd>{review.scope.headersCollected}</dd>
              </div>
              <div>
                <dt>Scoped checks</dt>
                <dd>{review.scope.checks}</dd>
              </div>
              <div>
                <dt>Configuration reviews</dt>
                <dd>{tasks.length}</dd>
              </div>
            </dl>
          </div>

          <div
            className={workbench.views}
            role="group"
            aria-label="Security workspace views"
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
              aria-pressed={view === "signals"}
              aria-controls={`${id}-signals`}
              onClick={() => setView("signals")}
            >
              <Icon name="file" width="17" height="17" /> Page signals
            </button>
          </div>
          <section
            id={`${id}-plan`}
            hidden={view !== "plan"}
            aria-labelledby={`${id}-plan-heading`}
          >
            <div className={workbench.workArea}>
              <header className={workbench.heading}>
                <h3 id={`${id}-plan-heading`} ref={planHeading} tabIndex={-1}>
                  Configuration review plan
                </h3>
                <p>
                  Choose a task to see the recorded signal, suggested steps, and
                  a staging check.
                </p>
              </header>
              {!!tasks.length && (
                <div className={workbench.filters}>
                  <div
                    className={layout.priorities}
                    role="group"
                    aria-label="Filter security reviews by priority"
                  >
                    {priorities.map((priority) => (
                      <button
                        type="button"
                        key={priority}
                        ref={
                          priority === "All priorities"
                            ? allPriority
                            : undefined
                        }
                        aria-pressed={filters.priority === priority}
                        onClick={() => setFilters({ ...filters, priority })}
                      >
                        {priority}{" "}
                        <span>
                          {priority === "All priorities"
                            ? areaTasks.length
                            : areaTasks.filter(
                                (check) => check.priority === priority,
                              ).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <label className={workbench.field}>
                    Review area
                    <select
                      value={filters.area}
                      onChange={(event) =>
                        setFilters({
                          ...filters,
                          area: event.target.value as typeof filters.area,
                        })
                      }
                    >
                      <option value="">All areas</option>
                      {securityAreas.map((area) => (
                        <option key={area} value={area}>
                          {SECURITY_AREAS[area]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pages.length > 1 && (
                    <label className={workbench.field}>
                      Review source page
                      <select
                        value={filters.page}
                        onChange={(event) =>
                          setFilters({ ...filters, page: event.target.value })
                        }
                      >
                        <option value="">All collected pages</option>
                        {pages.map(({ url }) => (
                          <option key={url} value={sourceURL(url) || ""}>
                            {sourceURL(url)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              <div className={workbench.resultLine}>
                <p role="status">
                  {filtered
                    ? `${matching.length} of ${tasks.length} reviews match these filters`
                    : `${tasks.length} configuration ${tasks.length === 1 ? "review" : "reviews"}`}
                </p>
                {filtered && (
                  <button
                    type="button"
                    className={layout.textButton}
                    onClick={() => {
                      (allPriority.current ?? planHeading.current)?.focus();
                      setFilters(initialPlanFilters);
                    }}
                  >
                    Clear review filters
                  </button>
                )}
              </div>
              {selected ? (
                <div className={layout.workbench}>
                  <section
                    className={layout.queue}
                    aria-label="Configuration reviews"
                  >
                    <header className={layout.queueHeading}>
                      <strong>Review queue</strong>
                      <span>{matching.length}</span>
                    </header>
                    <label className={layout.mobilePicker}>
                      Select a review task
                      <select
                        value={securityCheckIdentity(selected)}
                        onChange={(event) => setTaskKey(event.target.value)}
                      >
                        {matching.map((check) => (
                          <option
                            key={securityCheckIdentity(check)}
                            value={securityCheckIdentity(check)}
                          >
                            {check.priority} · {check.title}
                            {matching.some(
                              (other) =>
                                other !== check && other.title === check.title,
                            )
                              ? ` · ${sourceURL(check.pageUrl)}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={layout.queueList}>
                      {visibleTasks.map((check) => (
                        <button
                          type="button"
                          key={securityCheckIdentity(check)}
                          aria-pressed={selected === check}
                          aria-controls={`${id}-task`}
                          onClick={() =>
                            setTaskKey(securityCheckIdentity(check))
                          }
                        >
                          <span className={layout.queueMeta}>
                            <span
                              className={layout.priority}
                              data-priority={check.priority}
                            >
                              {check.priority}
                            </span>
                            {selected === check && (
                              <span className={layout.selectedLabel}>
                                Selected
                              </span>
                            )}
                          </span>
                          <strong>{check.title}</strong>
                          <span className={layout.queuePage}>
                            {SECURITY_AREAS[check.area]} ·{" "}
                            {sourceURL(check.pageUrl)}
                          </span>
                        </button>
                      ))}
                      {matching.length > 5 && (
                        <button
                          type="button"
                          className={layout.showAll}
                          aria-expanded={showAll}
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll
                            ? "Show fewer reviews"
                            : `Show all ${matching.length} reviews`}
                        </button>
                      )}
                    </div>
                    <footer className={layout.queueFooter}>
                      <span>
                        Review {selectedIndex + 1} of {matching.length}
                      </span>
                      <button
                        type="button"
                        className={layout.textButton}
                        onClick={() => taskPanel.current?.focus()}
                      >
                        Go to review details{" "}
                        <Icon name="arrow" width="14" height="14" />
                      </button>
                    </footer>
                  </section>

                  <article
                    key={securityCheckIdentity(selected)}
                    ref={taskPanel}
                    tabIndex={-1}
                    id={`${id}-task`}
                    aria-labelledby={`${id}-task-title`}
                    className={`${layout.activePanel} ${workbench.detailPanel}`}
                    data-active-security-task={selected.key}
                  >
                    <header
                      className={`${layout.findingHeader} ${workbench.findingHeader}`}
                    >
                      <div className={layout.findingMeta}>
                        <span
                          className={layout.priority}
                          data-priority={selected.priority}
                        >
                          {selected.priority} priority
                        </span>
                        <span>{SECURITY_AREAS[selected.area]}</span>
                        <SecurityStatusBadge status={selected.status} />
                      </div>
                      <h4 id={`${id}-task-title`}>{selected.title}</h4>
                      <p>{selected.detail}</p>
                    </header>
                    <section className={workbench.findingSection}>
                      <h5>
                        <Icon name="link" width="16" height="16" /> What we
                        observed
                      </h5>
                      <div className={styles.taskSource}>
                        <p>{sourceURL(selected.pageUrl)}</p>
                        {selectedPage && (
                          <p className={styles.meta}>
                            Collected {reportTime(selectedPage.fetchedAt)} ·{" "}
                            {selectedPage.headersCollected
                              ? "Final-response headers collected"
                              : "Response headers not collected"}
                            {selectedPage.sampled &&
                              " · Reference evidence sampled"}
                          </p>
                        )}
                        <div className={workbench.sourceActions}>
                          <ReviewSourceLink
                            url={sourceURL(selected.pageUrl) || undefined}
                            label="Open audited page"
                          />
                          <button
                            type="button"
                            className={layout.button}
                            onClick={() => inspect(selected)}
                          >
                            Inspect source signal
                          </button>
                        </div>
                      </div>
                      <SecurityObservations check={selected} task />
                    </section>
                    <section className={workbench.findingSection}>
                      <h5>
                        <Icon name="pen" width="16" height="16" /> Suggested
                        steps
                      </h5>
                      <ol className={shared.steps}>
                        {securitySteps(selected, generatedFixSteps).map(
                          (step, index) => (
                            <li key={`${step.title}-${index}`}>
                              <div>
                                <h6 className={styles.stepTitle}>
                                  {step.title}
                                </h6>
                                <p>{step.description}</p>
                              </div>
                            </li>
                          ),
                        )}
                      </ol>
                    </section>
                    <details className={workbench.validate}>
                      <summary>
                        How to verify the change <small>Manual check</small>
                      </summary>
                      <p className={styles.verification}>
                        {SECURITY_VERIFICATION[selected.key]}
                      </p>
                    </details>
                  </article>
                </div>
              ) : (
                <div className={layout.empty}>
                  <Icon name="shield" width="22" height="22" />
                  <h4>
                    {!tasks.length
                      ? "No configuration reviews in this sample"
                      : !pageTasks.length
                        ? "No review tasks for this page"
                        : "No reviews match these filters"}
                  </h4>
                  <p>
                    {!tasks.length
                      ? "Inspect the recorded signals to see what was collected and which checks were outside scope."
                      : "Clear the filters to see the full configuration review plan."}
                  </p>
                  <button
                    type="button"
                    className={layout.button}
                    onClick={() => inspect()}
                  >
                    Inspect page signals
                  </button>
                </div>
              )}
            </div>
          </section>
          <section
            id={`${id}-signals`}
            hidden={view !== "signals"}
            aria-labelledby={`${id}-signals-heading`}
          >
            <SecurityPageSignals
              headingId={`${id}-signals-heading`}
              headingRef={signalHeading}
              evidenceRef={signalEvidence}
              pages={pages}
              page={page}
              openSignal={openSignal}
              filters={signalFilters}
              onPage={changePage}
              onToggle={(key) =>
                setOpenSignal((value) => (value === key ? "" : key))
              }
              onFilter={setSignalFilters}
              onTask={viewTask}
            />
          </section>
        </>
      )}

      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="eye" width="18" height="18" />
            <strong>Collection scope and limits</strong>
          </span>
          <span className={layout.meta}>
            Public headers and HTML <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.scope}>
          {review && <p>{review.summary}</p>}
          {review?.scope.sampled && (
            <p>
              Some resource references were sampled. Page evidence marks the
              affected responses.
            </p>
          )}
          <h3>Outside this review</h3>
          <ul>
            {(review?.notTested ?? SECURITY_NOT_TESTED).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <p>
            The collector retains cookie attribute summaries and redacted
            resource references. Check-specific technical guidance is available
            with each observation.
          </p>
        </div>
      </details>
    </div>
  );
}
