"use client";

import { useId, useRef, useState } from "react";
import { reviewIssues } from "@/lib/review-workspace";
import type { FixStep, Issue } from "@/lib/types";
import { UX_CRITERIA, type UXAnalysis, type UXSource } from "@/lib/ux";
import {
  describeUXSource,
  uxActionPlan,
  uxAssessment,
  uxIssueArea,
  UX_BROWSER_SCOPE,
} from "@/lib/ux-presentation";
import { ReviewSourceLink } from "./ReviewEvidence";
import { ReviewFixSteps, usePlanExport } from "./ReviewWorkspace";
import Icon from "./Icon";
import styles from "./UXSection.module.css";

interface Props {
  analysis?: UXAnalysis;
  issues: Issue[];
  url: string;
  collectedPages?: string[];
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (key: string, steps: FixStep[]) => void;
}
interface ViewState {
  priority: "all" | Issue["priority"];
  area: string;
  selected: string;
  showAll: boolean;
}
type RecordItem = ReturnType<typeof reviewIssues>[number];
function matches(records: RecordItem[], view: ViewState) {
  return records.filter(
    ({ issue }) =>
      (view.priority === "all" || issue.priority === view.priority) &&
      (view.area === "all" || uxIssueArea(issue) === view.area),
  );
}
function areaLabel(issue: Issue) {
  return (
    UX_CRITERIA.find((rubric) => rubric.key === uxIssueArea(issue))?.label ||
    "Other / earlier findings"
  );
}
function pageLabel(value?: string) {
  if (!value) return "Source not recorded";
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return "Source not recorded";
  }
}
function Observations({ sources }: { sources: UXSource[] }) {
  const unique = [
    ...new Map(
      sources.map((source) => [
        `${source.pageUrl}|${source.kind}|${source.id}`,
        source,
      ]),
    ).values(),
  ];
  return (
    <div className={styles.observations}>
      {unique.map((source) => (
        <article
          className={styles.observation}
          key={`${source.pageUrl}|${source.kind}|${source.id}`}
        >
          <div className={styles.observationHeading}>
            <span>{source.kind}</span>
            <strong>{source.location}</strong>
          </div>
          <dl>
            {describeUXSource(source).map((row, index) => (
              <div key={`${row.label}|${index}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <ReviewSourceLink url={source.pageUrl} />
          <details className={styles.technical}>
            <summary>Technical details</summary>
            <pre>{source.observation}</pre>
          </details>
        </article>
      ))}
    </div>
  );
}
export default function UXSection({
  analysis,
  issues,
  url,
  collectedPages,
  generatedFixSteps,
  onFixStepsLoaded,
}: Props) {
  const records = reviewIssues(issues);
  const [view, setView] = useState<ViewState>(() => ({
    priority: "all",
    area: "all",
    selected: records[0]?.key || "",
    showAll: false,
  }));
  const [openEvidence, setOpenEvidence] = useState<Set<string>>(
    () => new Set(),
  );
  const exporter = usePlanExport();
  const prefix = useId(),
    panelId = `${prefix}-finding`,
    titleId = `${prefix}-title`;
  const panel = useRef<HTMLElement>(null),
    assessments = useRef<HTMLDetailsElement>(null),
    coverage = useRef<HTMLDetailsElement>(null);
  const assessment = uxAssessment(analysis, collectedPages);
  const matching = matches(records, view);
  const active =
    matching.find((record) => record.key === view.selected) || matching[0];
  const showingAll =
    view.showAll ||
    matching.findIndex((record) => record.key === active?.key) >= 5;
  const visible = showingAll ? matching : matching.slice(0, 5);
  const filtered = view.priority !== "all" || view.area !== "all";
  const highCount = issues.filter((issue) => issue.priority === "High").length;
  const pages = collectedPages?.length ?? analysis?.scope.pages;
  const plan = () =>
    uxActionPlan(analysis, issues, url, generatedFixSteps, collectedPages);
  const select = (key: string) => {
    exporter.invalidate();
    setView((previous) => ({
      ...previous,
      selected: key,
      showAll:
        previous.showAll ||
        matching.findIndex((record) => record.key === key) >= 5,
    }));
  };
  const filter = (patch: Partial<Pick<ViewState, "priority" | "area">>) => {
    exporter.invalidate();
    setView((previous) => {
      const before = matches(records, previous);
      const current =
        before.find((record) => record.key === previous.selected) || before[0];
      const next = { ...previous, ...patch, showAll: false };
      const after = matches(records, next);
      return {
        ...next,
        selected:
          after.find((record) => record.key === current?.key)?.key ||
          after[0]?.key ||
          "",
      };
    });
  };
  const reveal = (target: HTMLDetailsElement | null) => {
    if (!target) return;
    target.open = true;
    target.querySelector("summary")?.focus();
  };
  const download = () => {
    let filename = "website";
    try {
      filename = new URL(url).hostname;
    } catch {
      /* An earlier report may lack a valid URL. */
    }
    exporter.download(plan(), `${filename}-ux-action-plan.txt`);
  };
  return (
    <div className={styles.workspace} data-review-workspace="ux">
      <div className={styles.toolbar}>
        <p>
          Inspect observed usability signals and plan your next improvement.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            onClick={() =>
              void exporter.copy(
                plan(),
                "UX action plan copied. It includes all findings, evidence and testing limits.",
              )
            }
          >
            <Icon name="copy" width="15" height="15" />
            Copy UX plan
          </button>
          <button
            className={styles.button}
            type="button"
            onClick={download}
            aria-label="Download UX plan (.txt)"
          >
            <Icon name="download" width="15" height="15" />
            Download .txt
          </button>
        </div>
      </div>
      {exporter.notice && (
        <p role="status" className={styles.notice}>
          <Icon name="info" width="16" height="16" />
          {exporter.notice}
        </p>
      )}
      {!assessment.current && (
        <p className={styles.notice}>
          This report contains an earlier UX review. Run a new audit for a
          current source-backed assessment. Saved findings remain available
          below.
        </p>
      )}
      <section
        className={styles.snapshot}
        aria-label="User experience review snapshot"
      >
        <div className={styles.assessment}>
          <span className={styles.snapshotIcon}>
            <Icon name="layers" width="20" height="20" />
          </span>
          <div>
            <span className={styles.label}>HTML-based UX assessment</span>
            <div
              className={styles.score}
              data-missing={assessment.score === null}
            >
              <strong>{assessment.score ?? "Not assessed"}</strong>
              {assessment.score !== null && <span>/100</span>}
            </div>
            <span className={styles.meta}>
              {assessment.criteria.length} of 4 criteria assessed · qualitative
            </span>
          </div>
        </div>
        <dl className={styles.counts}>
          <div>
            <dt>Retained findings</dt>
            <dd>{issues.length}</dd>
          </div>
          <div>
            <dt>
              High priority{" "}
              <span className={styles.subLabel}>within findings</span>
            </dt>
            <dd>{highCount}</dd>
          </div>
          <div>
            <dt>Pages collected</dt>
            <dd>
              {typeof pages === "number" &&
              Number.isInteger(pages) &&
              pages >= 0
                ? pages
                : "Not recorded"}
            </dd>
          </div>
        </dl>
        <div className={styles.scopeLabel}>
          <Icon name="eye" width="15" height="15" />
          Browser interactions not tested
        </div>
      </section>
      {issues.length > 0 && (
        <div className={styles.filters}>
          <div className={styles.filterControls}>
            <div
              role="group"
              aria-label="Filter UX findings by priority"
              className={styles.priorities}
            >
              {(["all", "High", "Medium", "Low"] as const).map((priority) => (
                <button
                  type="button"
                  key={priority}
                  aria-pressed={view.priority === priority}
                  onClick={() => filter({ priority })}
                >
                  {priority === "all" ? "All" : priority}
                  <span>
                    {priority === "all"
                      ? issues.length
                      : issues.filter((issue) => issue.priority === priority)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <label className={styles.areaPicker}>
              UX review area
              <select
                aria-label="UX review area"
                value={view.area}
                onChange={(event) => filter({ area: event.target.value })}
              >
                <option value="all">All areas</option>
                {UX_CRITERIA.map((rubric) => (
                  <option key={rubric.key} value={rubric.key}>
                    {rubric.label} (
                    {
                      issues.filter(
                        (issue) => uxIssueArea(issue) === rubric.key,
                      ).length
                    }
                    )
                  </option>
                ))}
                {issues.some((issue) => uxIssueArea(issue) === "other") && (
                  <option value="other">
                    Other / earlier findings (
                    {
                      issues.filter((issue) => uxIssueArea(issue) === "other")
                        .length
                    }
                    )
                  </option>
                )}
              </select>
            </label>
          </div>
          <div className={styles.filterContext}>
            <span role="status">
              Showing {matching.length} of {issues.length} findings
              {filtered
                ? ` · ${view.priority === "all" ? "All priorities" : `${view.priority} priority`} · ${view.area === "all" ? "All areas" : UX_CRITERIA.find((rubric) => rubric.key === view.area)?.label || "Other / earlier findings"}`
                : " · ordered by priority"}
            </span>
            {filtered && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => filter({ priority: "all", area: "all" })}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}
      {active ? (
        <div className={styles.workbench}>
          <section className={styles.queue} aria-labelledby={`${prefix}-queue`}>
            <div className={styles.queueHeading}>
              <h3 id={`${prefix}-queue`}>UX findings</h3>
              <span>{matching.length}</span>
            </div>
            <label className={styles.mobilePicker}>
              Choose a UX finding
              <select
                aria-label="Choose a UX finding"
                value={active.key}
                onChange={(event) => select(event.target.value)}
              >
                {matching.map(({ issue, key }, index) => (
                  <option key={key} value={key}>
                    {index + 1}. {issue.title} · {issue.priority}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.queueList}>
              {visible.map(({ issue, key }, index) => (
                <button
                  type="button"
                  key={key}
                  aria-label={`Select UX finding ${index + 1}: ${issue.title}`}
                  aria-pressed={active.key === key}
                  aria-controls={panelId}
                  onClick={() => select(key)}
                >
                  <div className={styles.queueMeta}>
                    <span
                      className={styles.priority}
                      data-priority={issue.priority}
                    >
                      {issue.priority}
                    </span>
                    {active.key === key && (
                      <span className={styles.selectedLabel}>Selected</span>
                    )}
                  </div>
                  <strong>{issue.title}</strong>
                  <span className={styles.meta}>{areaLabel(issue)}</span>
                  <span className={styles.queuePage}>
                    {pageLabel(issue.pageUrl)}
                  </span>
                </button>
              ))}
              {matching.length > 5 && (
                <button
                  type="button"
                  className={styles.showAll}
                  onClick={() => {
                    if (showingAll)
                      setView((previous) => ({
                        ...previous,
                        showAll: false,
                        selected: matching
                          .slice(0, 5)
                          .some((record) => record.key === active.key)
                          ? active.key
                          : matching[0].key,
                      }));
                    else
                      setView((previous) => ({ ...previous, showAll: true }));
                  }}
                >
                  {showingAll
                    ? "Show first 5"
                    : `Show all ${matching.length} findings`}
                </button>
              )}
            </div>
            <div className={styles.queueFooter}>
              <span>
                Finding{" "}
                {matching.findIndex((record) => record.key === active.key) + 1}{" "}
                of {matching.length}
              </span>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => panel.current?.focus()}
              >
                Go to finding details{" "}
                <Icon name="arrow" width="14" height="14" />
              </button>
            </div>
          </section>
          <article
            ref={panel}
            tabIndex={-1}
            id={panelId}
            aria-labelledby={titleId}
            className={styles.activePanel}
            data-active-finding={active.key}
          >
            <header className={styles.findingHeader}>
              <div className={styles.findingMeta}>
                <span
                  className={styles.priority}
                  data-priority={active.issue.priority}
                >
                  {active.issue.priority} priority
                </span>
                <span>{areaLabel(active.issue)}</span>
              </div>
              <h3 id={titleId}>{active.issue.title}</h3>
              <p>{active.issue.detail}</p>
              <ReviewSourceLink
                url={active.issue.pageUrl}
                label="Open source page"
              />
            </header>
            <section
              className={styles.evidenceSection}
              aria-label="Observed in the collected page"
            >
              <div className={styles.contentHeading}>
                <Icon name="file" width="17" height="17" />
                <h4>Observed in the collected page</h4>
              </div>
              {active.issue.uxEvidence?.length ? (
                <>
                  <Observations sources={active.issue.uxEvidence.slice(0, 1)} />
                  {active.issue.uxEvidence.length > 1 && (
                    <details
                      key={active.key}
                      className={styles.moreEvidence}
                      open={openEvidence.has(active.key)}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open;
                        setOpenEvidence((previous) => {
                          if (previous.has(active.key) === isOpen)
                            return previous;
                          const next = new Set(previous);
                          if (isOpen) next.add(active.key);
                          else next.delete(active.key);
                          return next;
                        });
                      }}
                    >
                      <summary>
                        More supporting observations (
                        {active.issue.uxEvidence.length - 1})
                      </summary>
                      <Observations
                        sources={active.issue.uxEvidence.slice(1)}
                      />
                    </details>
                  )}
                </>
              ) : active.issue.evidence ? (
                <div className={styles.savedEvidence}>
                  <strong>Saved observation</strong>
                  <p>{active.issue.evidence}</p>
                </div>
              ) : (
                <p>
                  Source detail was not recorded in this saved report. A new
                  audit can collect current evidence.
                </p>
              )}
              <p className={styles.evidenceNote}>
                Recorded HTML declarations. Rendered layout, accessibility-tree
                names and live behavior were not tested.
              </p>
            </section>
            <div className={styles.steps}>
              <ReviewFixSteps
                key={active.key}
                generationKey={active.key}
                headingLevel={4}
                title="Recommended next steps"
                issue={active.issue}
                url={url}
                generated={generatedFixSteps}
                onLoaded={onFixStepsLoaded}
              />
            </div>
            <div className={styles.manualCheck}>
              <Icon name="eye" width="18" height="18" />
              <div>
                <h4>Check the change in your browser</h4>
                <p>
                  Review the affected page and interaction before treating this
                  finding as resolved. This report has not tested the change.
                </p>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => reveal(coverage.current)}
                >
                  View remaining checks{" "}
                  <Icon name="arrow" width="14" height="14" />
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <section className={styles.empty}>
          <Icon
            name={issues.length ? "search" : "layers"}
            width="24"
            height="24"
          />
          <h3>
            {issues.length
              ? "No findings match these filters"
              : "No retained UX findings in this report"}
          </h3>
          <p>
            {issues.length
              ? "Try another priority or review area to see the available findings."
              : "This collected sample does not provide a supported improvement to prioritize. Review the assessment coverage and plan the browser checks before drawing wider conclusions."}
          </p>
          {issues.length ? (
            <button
              className={styles.button}
              type="button"
              onClick={() => filter({ priority: "all", area: "all" })}
            >
              Reset filters
            </button>
          ) : (
            <button
              className={styles.button}
              type="button"
              onClick={() => reveal(assessments.current)}
            >
              Review assessment coverage
            </button>
          )}
        </section>
      )}
      <details className={styles.secondary} ref={assessments}>
        <summary>
          <span>
            <Icon name="layers" width="18" height="18" />
            <strong>Category assessments and strengths</strong>
          </span>
          <span className={styles.meta}>
            {assessment.criteria.length} of 4 assessed
            <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.secondaryBody}>
          {analysis?.summary && (
            <div className={styles.recordedSummary}>
              <h3>Recorded review summary</h3>
              <p>{analysis.summary}</p>
              {!!analysis.summarySources.length && (
                <details>
                  <summary>Sources informing this summary</summary>
                  <Observations sources={analysis.summarySources} />
                </details>
              )}
            </div>
          )}
          <div className={styles.criterionList}>
            {UX_CRITERIA.map((rubric) => {
              const eligible = assessment.criteria.find(
                (item) => item.key === rubric.key,
              );
              const recorded = assessment.current
                ? analysis?.criteria.find((item) => item.key === rubric.key)
                : undefined;
              const count = issues.filter(
                (issue) => uxIssueArea(issue) === rubric.key,
              ).length;
              return (
                <details key={rubric.key} className={styles.criterion}>
                  <summary>
                    <strong>{rubric.label}</strong>
                    <span>
                      {count} {count === 1 ? "finding" : "findings"}
                    </span>
                    <span className={styles.criterionScore}>
                      {eligible ? (
                        <>
                          {eligible.score}
                          <small>/100</small>
                        </>
                      ) : (
                        "Not assessed"
                      )}
                    </span>
                    <Icon name="down" width="14" height="14" />
                  </summary>
                  <div>
                    <p>
                      {recorded?.reason ||
                        "No current source-backed assessment is available for this area."}
                    </p>
                    {!eligible && (
                      <p className={styles.meta}>
                        Excluded from the score. A current assessment needs
                        valid source-linked criteria.
                      </p>
                    )}
                    {!!recorded?.sources.length && (
                      <Observations sources={recorded.sources} />
                    )}
                  </div>
                </details>
              );
            })}
          </div>
          <details className={styles.method}>
            <summary>How the UX score was assessed</summary>
            <p>
              Qualitative AI assessment of collected HTML. Navigation &
              findability: 30%; information structure: 25%; controls & next
              steps: 25%; form clarity: 20%. Only eligible, source-backed
              criteria contribute. Available weights are rebalanced and the
              final result is rounded once. Missing assessments are excluded; a
              valid zero remains zero.
            </p>
          </details>
          {!!analysis?.strengths.length && (
            <section className={styles.strengths}>
              <h3>Recorded strengths</h3>
              {analysis.strengths.map((strength, index) => (
                <div key={`${strength.text}|${index}`}>
                  <p>
                    <Icon name="check" width="16" height="16" />
                    {strength.text}
                  </p>
                  <details>
                    <summary>Supporting observations</summary>
                    <Observations sources={strength.sources} />
                  </details>
                </div>
              ))}
            </section>
          )}
        </div>
      </details>
      <details className={styles.secondary} ref={coverage}>
        <summary>
          <span>
            <Icon name="eye" width="18" height="18" />
            <strong>Coverage and remaining checks</strong>
          </span>
          <span className={styles.meta}>
            HTML review scope
            <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.secondaryBody}>
          <h3>What was collected</h3>
          {analysis ? (
            <>
              <dl className={styles.coverageCounts}>
                {(
                  [
                    ["Pages collected", pages],
                    ["Source observations", analysis.scope.sources],
                    ["Navigation groups", analysis.scope.navigation],
                    ["Headings", analysis.scope.headings],
                    ["Links", analysis.scope.links],
                    ["Buttons", analysis.scope.buttons],
                    ["Forms", analysis.scope.forms],
                    ["Fields", analysis.scope.fields],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value ?? "Not recorded"}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {analysis.verification.checked} draft checks against collected
                evidence · {analysis.verification.retained} retained ·{" "}
                {analysis.verification.withheld} withheld. These are not browser
                tests.
              </p>
              <p>
                {analysis.verification.withheld > 0
                  ? "Unsupported or untestable draft advice was withheld. "
                  : "Findings were checked against the collected page evidence. "}
                {analysis.scope.truncated
                  ? "Some observations were sampled or shortened. "
                  : ""}
                This review covers the listed pages and initial HTML. It does
                not establish that the entire website is free of issues.
              </p>
            </>
          ) : (
            <p>
              Detailed collection coverage was not recorded in this earlier
              review.
            </p>
          )}
          <div className={styles.followup}>
            <h3>What still needs browser testing</h3>
            <p>
              Manual follow-up guidance. Browser interactions were not tested by
              this report.
            </p>
            <ul>
              {(analysis?.unassessed.length
                ? analysis.unassessed
                : UX_BROWSER_SCOPE
              ).map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <span className={styles.notTested}>Not tested</span>
                </li>
              ))}
            </ul>
            <ReviewSourceLink url={url} label="Open audited page" />
          </div>
        </div>
      </details>
    </div>
  );
}
