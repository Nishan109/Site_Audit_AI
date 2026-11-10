"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FixStep, Issue } from "@/lib/types";
import { CONVERSION_GUIDANCE, type ConversionAnalysis } from "@/lib/conversion";
import { sourceURL } from "@/lib/dashboard";
import {
  conversionAssessment,
  conversionFindingPages,
  conversionObservations,
  conversionPageLabel,
  conversionPages,
  conversionPlan,
  conversionValidation,
  distinctConversionSources,
} from "@/lib/conversion-presentation";
import { reviewIssues } from "@/lib/review-workspace";
import ConversionPageInspector from "./ConversionPageInspector";
import Icon from "./Icon";
import ReviewEvidence, { ReviewSourceLink } from "./ReviewEvidence";
import {
  ReviewAssessments,
  ReviewFixSteps,
  ReviewNotice,
  ReviewSnapshot,
  ReviewTools,
  usePlanExport,
} from "./ReviewWorkspace";
import shared from "./ReviewWorkspace.module.css";
import layout from "./UXSection.module.css";
import styles from "./ConversionSection.module.css";

interface Props {
  analysis?: ConversionAnalysis;
  issues: Issue[];
  url: string;
  collectedPages?: string[];
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (key: string, steps: FixStep[]) => void;
}

const priorities = ["All", "High", "Medium", "Low"] as const;
const initialFilters = {
  priority: "All" as (typeof priorities)[number],
  area: "",
  page: "",
};
type View = "findings" | "actions";

export default function ConversionSection({
  analysis,
  issues,
  url,
  collectedPages,
  generatedFixSteps,
  onFixStepsLoaded,
}: Props) {
  const id = useId();
  const [view, setView] = useState<View>("findings");
  const [filters, setFilters] = useState(initialFilters);
  const [selection, setSelection] = useState("");
  const [inspectedPage, setInspectedPage] = useState("");
  const [showAll, setShowAll] = useState(false);
  const focusView = useRef<View | null>(null);
  const findingsHeading = useRef<HTMLHeadingElement>(null);
  const actionsHeading = useRef<HTMLHeadingElement>(null);
  const detail = useRef<HTMLElement>(null);
  const allPriority = useRef<HTMLButtonElement>(null);
  const exporter = usePlanExport();

  useEffect(() => {
    if (focusView.current !== view) return;
    (view === "findings" ? findingsHeading : actionsHeading).current?.focus();
    focusView.current = null;
  }, [view]);

  const assessment = conversionAssessment(analysis, collectedPages);
  const observations = conversionObservations(analysis, issues);
  const pages = conversionPages(collectedPages, observations);
  const page = pages.includes(inspectedPage) ? inspectedPage : pages[0];
  const pageCount = collectedPages
    ? pages.length
    : (analysis?.scope?.pages ?? (pages.length || undefined));
  const records = reviewIssues(issues).map((record) => ({
    ...record,
    pages: conversionFindingPages(record.issue),
  }));
  const findingLabel = (record: (typeof records)[number]) => {
    const title = record.issue.title;
    if (records.filter(({ issue }) => issue.title === title).length < 2)
      return title;
    return `${title} · Finding ${records.indexOf(record) + 1}`;
  };
  const filterPages = [
    ...new Set([...pages, ...records.flatMap((record) => record.pages)]),
  ];
  const pageRecords = records.filter(
    ({ pages }) => !filters.page || pages.includes(filters.page),
  );
  const areaRecords = pageRecords.filter(
    ({ issue }) => !filters.area || issue.conversionCriterion === filters.area,
  );
  const matching = areaRecords.filter(
    ({ issue }) =>
      filters.priority === "All" || issue.priority === filters.priority,
  );
  const active = matching.find(({ key }) => key === selection) || matching[0];
  const activeIndex = matching.indexOf(active);
  const visible = showAll
    ? matching
    : matching.filter(
        (record, index) =>
          index < (activeIndex >= 5 ? 4 : 5) || record === active,
      );
  const filtered =
    filters.priority !== "All" || !!filters.area || !!filters.page;
  const plan = () =>
    conversionPlan(analysis, issues, url, generatedFixSteps, collectedPages);
  const auditedUrl = sourceURL(url);
  const areaName = (issue: Issue) =>
    assessment.criteria.find(({ key }) => key === issue.conversionCriterion)
      ?.label;

  function changeFilters(next: typeof filters) {
    setFilters(next);
    setShowAll(false);
  }

  function resetFilters() {
    (allPriority.current || findingsHeading.current)?.focus();
    changeFilters(initialFilters);
  }

  function inspect(source?: string) {
    const target = sourceURL(source || "");
    if (target && pages.includes(target)) setInspectedPage(target);
    focusView.current = "actions";
    setView("actions");
  }

  function viewPageFindings(page: string) {
    changeFilters({ ...initialFilters, page });
    focusView.current = "findings";
    setView("findings");
  }

  return (
    <div
      className={`${shared.workspace} ${layout.workspace} ${styles.workspace}`}
      data-review-workspace="conversion"
    >
      <ReviewTools
        copyLabel="Copy Conversion plan"
        downloadLabel="Download Conversion plan (.txt)"
        downloadText="Download Conversion plan"
        onCopy={() =>
          void exporter.copy(
            plan(),
            "Conversion plan copied with all findings and sources.",
          )
        }
        onDownload={() =>
          exporter.download(
            plan(),
            `${auditedUrl ? new URL(auditedUrl).hostname : "website"}-conversion-action-plan.txt`,
          )
        }
      >
        Review how clearly your pages explain what to do next.
      </ReviewTools>
      {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
      <ReviewSnapshot
        label="Conversion clarity"
        score={assessment.score}
        assessed={assessment.assessed}
        total={assessment.criteria.length}
        count={issues.length}
        scope={
          pageCount == null
            ? "Page coverage not recorded"
            : `${pageCount} ${pageCount === 1 ? "page" : "pages"} reviewed`
        }
        note="Clicks, submissions, and outcomes were not measured"
      />
      {analysis?.method !== "conversion-evidence-review-v1" && (
        <ReviewNotice>
          This report has limited Conversion detail. A new audit can collect a
          current assessment and page observations.
        </ReviewNotice>
      )}
      <div
        className={styles.views}
        role="group"
        aria-label="Conversion workspace views"
      >
        <button
          type="button"
          aria-pressed={view === "findings"}
          aria-controls={`${id}-findings`}
          onClick={() => setView("findings")}
        >
          <Icon name="layers" width="17" height="17" />
          Findings <span>{issues.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={view === "actions"}
          aria-controls={`${id}-actions`}
          onClick={() => setView("actions")}
        >
          <Icon name="target" width="17" height="17" />
          Actions &amp; forms
        </button>
      </div>

      <section
        id={`${id}-findings`}
        hidden={view !== "findings"}
        aria-labelledby={`${id}-findings-heading`}
      >
        <div className={styles.workArea}>
          <header className={styles.heading}>
            <h3
              id={`${id}-findings-heading`}
              ref={findingsHeading}
              tabIndex={-1}
            >
              Supported findings
            </h3>
            <p>
              Choose an improvement to see the evidence, suggested change, and
              how to check it.
            </p>
          </header>
          {!!records.length && (
            <div className={styles.filters}>
              <div
                className={layout.priorities}
                role="group"
                aria-label="Filter Conversion findings by priority"
              >
                {priorities.map((priority) => (
                  <button
                    key={priority}
                    ref={priority === "All" ? allPriority : undefined}
                    type="button"
                    aria-pressed={filters.priority === priority}
                    onClick={() => changeFilters({ ...filters, priority })}
                  >
                    {priority}{" "}
                    <span>
                      {priority === "All"
                        ? areaRecords.length
                        : areaRecords.filter(
                            ({ issue }) => issue.priority === priority,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              {records.some(({ issue }) => areaName(issue)) && (
                <label className={styles.field}>
                  Finding focus area
                  <select
                    value={filters.area}
                    onChange={(event) =>
                      changeFilters({ ...filters, area: event.target.value })
                    }
                  >
                    <option value="">All focus areas</option>
                    {assessment.criteria.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(filterPages.length > 1 || filters.page) && (
                <label className={styles.field}>
                  Finding source page
                  <select
                    value={filters.page}
                    onChange={(event) =>
                      changeFilters({ ...filters, page: event.target.value })
                    }
                  >
                    <option value="">All source pages</option>
                    {filterPages.map((item) => (
                      <option key={item} value={item}>
                        {conversionPageLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <div className={styles.resultLine}>
            <p role="status">
              {filtered
                ? `${matching.length} of ${issues.length} findings match these filters`
                : `${issues.length} supported ${issues.length === 1 ? "finding" : "findings"}`}
            </p>
            {filtered && (
              <button
                className={layout.textButton}
                type="button"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </div>
          {active ? (
            <div className={layout.workbench}>
              <section className={layout.queue} aria-label="Findings list">
                <header className={layout.queueHeading}>
                  <strong>Finding list</strong>
                  <span>{matching.length}</span>
                </header>
                <label className={layout.mobilePicker}>
                  Select a finding
                  <select
                    value={active.key}
                    onChange={(event) => setSelection(event.target.value)}
                  >
                    {matching.map((record) => (
                      <option key={record.key} value={record.key}>
                        {record.issue.priority} · {findingLabel(record)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={layout.queueList}>
                  {visible.map((record) => (
                    <button
                      key={record.key}
                      type="button"
                      aria-pressed={record.key === active.key}
                      aria-controls={`${id}-detail`}
                      onClick={() => setSelection(record.key)}
                    >
                      <span className={layout.queueMeta}>
                        <span
                          className={layout.priority}
                          data-priority={record.issue.priority}
                        >
                          {record.issue.priority}
                        </span>
                        {record.key === active.key && (
                          <span className={layout.selectedLabel}>Selected</span>
                        )}
                      </span>
                      <strong>{findingLabel(record)}</strong>
                      <span className={layout.queuePage}>
                        {[
                          areaName(record.issue),
                          record.pages[0] &&
                            conversionPageLabel(record.pages[0]),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
                        ? "Show fewer findings"
                        : `Show all ${matching.length} findings`}
                    </button>
                  )}
                </div>
                <footer className={layout.queueFooter}>
                  <span>
                    Finding {activeIndex + 1} of {matching.length}
                  </span>
                  <button
                    type="button"
                    className={layout.textButton}
                    onClick={() => detail.current?.focus()}
                  >
                    Go to finding details{" "}
                    <Icon name="arrow" width="14" height="14" />
                  </button>
                </footer>
              </section>

              <article
                key={active.key}
                ref={detail}
                tabIndex={-1}
                id={`${id}-detail`}
                aria-labelledby={`${id}-title`}
                className={`${layout.activePanel} ${styles.detailPanel}`}
                data-active-finding={active.key}
              >
                <header
                  className={`${layout.findingHeader} ${styles.findingHeader}`}
                >
                  <div className={layout.findingMeta}>
                    <span
                      className={layout.priority}
                      data-priority={active.issue.priority}
                    >
                      {active.issue.priority} priority
                    </span>
                    {areaName(active.issue) && (
                      <span>{areaName(active.issue)}</span>
                    )}
                  </div>
                  <h4 id={`${id}-title`}>{active.issue.title}</h4>
                  <p>
                    <strong>Why it matters</strong>
                  </p>
                  <p>{active.issue.detail}</p>
                </header>
                <section className={styles.findingSection}>
                  <h5>
                    <Icon name="link" width="16" height="16" /> What the audit
                    observed
                  </h5>
                  <ReviewEvidence
                    conversion={distinctConversionSources(
                      active.issue.conversionEvidence || [],
                    )}
                    plain={active.issue.evidence}
                    observation={
                      active.issue.evidenceType === "conversion-observation"
                    }
                    onInspectPage={inspect}
                    canInspectPage={(value) =>
                      pages.includes(sourceURL(value) || "")
                    }
                  />
                  {!active.issue.conversionEvidence?.length && (
                    <div className={styles.sourceActions}>
                      {active.pages[0] ? (
                        <>
                          <span>{active.pages[0]}</span>
                          <ReviewSourceLink
                            url={active.pages[0]}
                            label="Open audited page"
                          />
                          {pages.includes(active.pages[0]) && (
                            <button
                              type="button"
                              className={layout.button}
                              onClick={() => inspect(active.pages[0])}
                            >
                              Inspect source page
                            </button>
                          )}
                        </>
                      ) : (
                        <p>Source page unavailable</p>
                      )}
                    </div>
                  )}
                </section>
                <ReviewFixSteps
                  issue={active.issue}
                  url={url}
                  generated={generatedFixSteps}
                  onLoaded={onFixStepsLoaded}
                  generationKey={active.key}
                  title="Suggested change"
                />
                <details className={styles.validate}>
                  <summary>
                    How to validate <small>Manual checks</small>
                  </summary>
                  <ol>
                    {conversionValidation(active.issue).map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ol>
                </details>
              </article>
            </div>
          ) : (
            <div className={layout.empty}>
              <Icon name="target" width="22" height="22" />
              <h4>
                {!records.length
                  ? "No supported conversion findings in this report"
                  : !pageRecords.length
                    ? "No supported findings for this page"
                    : "No findings match these filters"}
              </h4>
              <p>
                {!records.length
                  ? "The collected sample did not support a conversion recommendation. You can still review what the audit observed."
                  : "Choose a different source page or clear your filters to see the full review."}
              </p>
              {!!pages.length && (
                <button
                  type="button"
                  className={layout.button}
                  onClick={() => inspect(filters.page)}
                >
                  Inspect actions and forms
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        id={`${id}-actions`}
        hidden={view !== "actions"}
        aria-labelledby={`${id}-actions-heading`}
      >
        <ConversionPageInspector
          id={`${id}-actions-heading`}
          headingRef={actionsHeading}
          analysis={analysis}
          observations={observations}
          pages={pages}
          page={page}
          onPageChange={setInspectedPage}
          onFindings={viewPageFindings}
        />
      </section>

      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="chart" width="18" height="18" />
            <strong>Assessment and recorded strengths</strong>
          </span>
          <span className={layout.meta}>
            {assessment.assessed} of {assessment.criteria.length} criteria
            assessed <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.secondaryBody}>
          <ReviewAssessments
            rubrics={assessment.criteria}
            criteria={assessment.criteria}
            summary={analysis?.summary}
            summaryEvidence={
              <ReviewEvidence conversion={analysis?.summarySources} />
            }
            evidence={(key) => {
              const sources = assessment.criteria.find(
                (criterion) => criterion.key === key,
              )?.sources;
              return sources?.length ? (
                <ReviewEvidence conversion={sources} />
              ) : null;
            }}
          >
            <p>
              The score uses the base weights shown above. It reweights eligible
              criteria and rounds once. Areas without a supported assessment are
              excluded.
            </p>
          </ReviewAssessments>
          {!!analysis?.strengths?.length && (
            <section className={styles.strengths}>
              <h3>Recorded strengths</h3>
              <ul>
                {analysis.strengths.map((strength, index) => (
                  <li key={index}>
                    {strength.text}
                    <details>
                      <summary>View supporting evidence</summary>
                      <ReviewEvidence conversion={strength.sources} />
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </details>

      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="target" width="18" height="18" />
            <strong>Likely visitor goal</strong>
          </span>
          <span className={layout.meta}>
            Report-wide hypothesis <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.secondaryBody}>
          <p>
            {analysis?.goal?.text ||
              "The main visitor goal could not be established from this sample."}
          </p>
          {!!analysis?.goal?.sources?.length && (
            <ReviewEvidence conversion={analysis.goal.sources} />
          )}
        </div>
      </details>

      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="eye" width="18" height="18" />
            <strong>Collection details and review limits</strong>
          </span>
          <span className={layout.meta}>
            Collected HTML and copy <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.secondaryBody}>
          {analysis?.scope && (
            <p>
              {analysis.scope.sources} recorded source observations ·{" "}
              {analysis.scope.controls} links and controls ·{" "}
              {analysis.scope.forms} forms.
            </p>
          )}
          {analysis?.scope?.truncated && (
            <p>Some content and observations were sampled.</p>
          )}
          {!!analysis?.verification?.withheld && (
            <p>Unsupported draft advice was withheld.</p>
          )}
          <p>
            The audit did not execute the observed controls or measure
            successful submissions or conversion performance. Use the manual
            checks before publishing changes.
          </p>
          <ul>
            {(analysis?.unassessed || []).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <div className={styles.sourceActions}>
            {CONVERSION_GUIDANCE.map((item) => (
              <ReviewSourceLink
                key={item.url}
                url={item.url}
                label={item.label}
              />
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
