"use client";
import { useMemo, useRef, useState } from "react";
import type { AuditResult, Issue } from "@/lib/types";
import { DASHBOARD_AREAS, dashboardModel, sourceURL } from "@/lib/dashboard";
import {
  dashboardEvidence,
  openReportCoverage,
  reportTime,
} from "@/lib/dashboard-evidence";
import type { ReportSection } from "./navigation";
import Icon from "./Icon";
import styles from "./DashboardOverview.module.css";

export default function DashboardOverview({
  result,
  onNavigate,
}: {
  result: AuditResult;
  onNavigate?: (section: ReportSection) => void;
}) {
  const model = useMemo(() => dashboardModel(result), [result]);
  const [priority, setPriority] = useState("All");
  const [area, setArea] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const findingsSection = useRef<HTMLElement>(null);
  const categoriesSection = useRef<HTMLElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const query = search.trim().toLocaleLowerCase();
  const labelFor = (key: string) =>
    DASHBOARD_AREAS.find((item) => item.key === key)?.label || key;
  const filtered = model.findings.filter(
    (item) =>
      (priority === "All" || item.issue.priority === priority) &&
      (area === "All" || item.areas.some((key) => key === area)) &&
      (!query ||
        [
          item.issue.title,
          item.issue.detail,
          item.issue.pageUrl,
          ...item.areas.map(labelFor),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)),
  );
  const visible = expanded ? filtered : filtered.slice(0, 5);
  const first = model.findings[0];
  const reset = () => {
    setPriority("All");
    setArea("All");
    setSearch("");
    setExpanded(false);
    setSelected(null);
  };
  const moveTo = (element: HTMLElement | null) => {
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const viewFirst = () => {
    reset();
    if (first) {
      setSelected(first.id);
      window.requestAnimationFrame(() =>
        moveTo(rows.current.get(first.id) || findingsSection.current),
      );
    }
  };
  const showPriority = (value: string) => {
    setPriority(value);
    setArea("All");
    setSearch("");
    setExpanded(false);
    setSelected(null);
    moveTo(findingsSection.current);
  };
  const filteredChanged = () => {
    setExpanded(false);
    setSelected(null);
  };
  const navigate = (section: ReportSection) => onNavigate?.(section);
  const evidence = (issue: Issue, compact = false) => {
    const entries = dashboardEvidence(issue);
    return (
      <div className={compact ? styles.compactEvidence : styles.evidence}>
        {(compact ? entries.slice(0, 1) : entries).map((source, index) => (
          <div key={`${source.pageUrl}-${index}`}>
            <span>{source.label}</span>
            <p className={compact ? styles.excerpt : ""}>{source.text}</p>
            <a
              href={source.pageUrl || issue.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.pageUrl || issue.pageUrl}
              <Icon name="external" width="12" height="12" />
            </a>
            {!compact &&
              model.pages
                .filter(
                  (page) =>
                    sourceURL(page.url) ===
                    sourceURL(source.pageUrl || issue.pageUrl || ""),
                )
                .map((page) => (
                  <small key={page.url}>
                    Collected {reportTime(page.fetchedAt)}
                  </small>
                ))}
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className={styles.dashboard}>
      <h2 className={styles.srOnly}>Audit overview</h2>
      <section className={styles.snapshot} aria-label="Report snapshot">
        <div className={styles.assessment}>
          <span className={styles.metricLabel}>Content & clarity</span>
          <div
            className={styles.score}
            role={model.overallScore === null ? undefined : "meter"}
            aria-label={
              model.overallScore === null
                ? undefined
                : "Combined content and clarity assessment"
            }
            aria-valuenow={model.overallScore ?? undefined}
            aria-valuemin={model.overallScore === null ? undefined : 0}
            aria-valuemax={model.overallScore === null ? undefined : 100}
          >
            <strong>{model.overallScore ?? "—"}</strong>
            <span>{model.overallScore === null ? "Not assessed" : "/100"}</span>
          </div>
          <p>{model.assessed} of 5 category assessments available</p>
        </div>
        <button
          type="button"
          className={styles.metric}
          onClick={() => showPriority("All")}
          aria-label={`Show all ${model.findings.length} supported findings`}
        >
          <span className={styles.metricLabel}>Supported findings</span>
          <strong>{model.findings.length}</strong>
          <span>
            Distinct findings
            <Icon name="arrow" width="14" height="14" />
          </span>
        </button>
        <button
          type="button"
          className={styles.metric}
          onClick={() => showPriority("High")}
          aria-label={`Show ${model.priorities.High} high-priority findings`}
        >
          <span className={styles.metricLabel}>High priority</span>
          <strong>
            {model.priorities.High}
            <span className={styles.priorityDot} />
          </strong>
          <span>
            Within supported findings
            <Icon name="arrow" width="14" height="14" />
          </span>
        </button>
        <button
          type="button"
          className={styles.metric}
          onClick={() => navigate("quickwins")}
          aria-label="Open Quick wins"
        >
          <span className={styles.metricLabel}>Linked quick wins</span>
          <strong>{model.quickWins.length}</strong>
          <span>
            Smaller-effort suggestions
            <Icon name="arrow" width="14" height="14" />
          </span>
        </button>
        <details className={styles.calculation}>
          <summary>
            Qualitative AI assessment
            <Icon name="info" width="13" height="13" />
            <span>How this is calculated</span>
            <Icon name="down" width="13" height="13" />
          </summary>
          <p>
            Equal average of the available category assessments, rounded once.
            Each category uses its own weighted, source-backed criteria.
            Unassessed criteria and older scores are excluded. Security,
            accessibility and PageSpeed are reviewed separately.
          </p>
        </details>
      </section>
      <section className={styles.start} aria-labelledby="start-heading">
        <div className={styles.startHeading}>
          <span className={styles.kicker}>
            <Icon name="target" width="15" height="15" />
            START HERE
          </span>
          <span className={styles.qualifier}>
            Based on this report’s priority order
          </span>
        </div>
        {first ? (
          <>
            <div className={styles.startBody}>
              <div className={styles.startCopy}>
                <span
                  className={styles.priority}
                  data-priority={first.issue.priority}
                >
                  {first.issue.priority} priority
                </span>
                <h3 id="start-heading">{first.issue.title}</h3>
                <p className={styles.startDetail}>{first.issue.detail}</p>
                <p className={styles.areaLabel}>
                  {first.areas.map(labelFor).join(" · ")}
                </p>
              </div>
              {evidence(first.issue, true)}
            </div>
            <div className={styles.startFooter}>
              {first.issue.fixSteps?.[0] ? (
                <div>
                  <Icon name="check" width="17" height="17" />
                  <p>
                    <strong>Suggested first step</strong>
                    {first.issue.fixSteps[0].title}
                    <span>{first.issue.fixSteps[0].description}</span>
                  </p>
                </div>
              ) : (
                <p className={styles.qualifier}>
                  Inspect the source evidence before deciding on a change.
                </p>
              )}
              <button
                type="button"
                className={styles.primary}
                onClick={viewFirst}
              >
                View finding details
                <Icon name="arrow" width="16" height="16" />
              </button>
            </div>
          </>
        ) : (
          <div className={styles.noStart}>
            <h3 id="start-heading">Start with the available evidence.</h3>
            <p>
              No supported findings are available for this overview. An empty
              list does not confirm that the website has no issues.
            </p>
            <button
              type="button"
              className={styles.textButton}
              onClick={openReportCoverage}
            >
              Review coverage
              <Icon name="arrow" width="15" height="15" />
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => moveTo(categoriesSection.current)}
            >
              Explore assessments
              <Icon name="arrow" width="15" height="15" />
            </button>
          </div>
        )}
      </section>
      <div className={styles.columns}>
        <section
          ref={findingsSection}
          tabIndex={-1}
          className={styles.findingsCard}
          aria-labelledby="dashboard-findings"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h3 id="dashboard-findings">Findings to work on</h3>
              <p>
                {model.findings.length} distinct supported findings across the
                five perspectives.
              </p>
            </div>
            <Icon name="layers" />
          </div>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <label htmlFor="dashboard-search">
                Search findings in this report
              </label>
              <div>
                <Icon name="search" width="17" height="17" />
                <input
                  id="dashboard-search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    filteredChanged();
                  }}
                  placeholder="Find a title, page or topic…"
                />
              </div>
            </div>
            <div className={styles.select}>
              <label htmlFor="dashboard-area">Review area</label>
              <select
                id="dashboard-area"
                value={area}
                onChange={(event) => {
                  setArea(event.target.value);
                  filteredChanged();
                }}
              >
                <option value="All">All review areas</option>
                {DASHBOARD_AREAS.map((item) => (
                  <option value={item.key} key={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            className={styles.filters}
            role="group"
            aria-label="Filter findings by priority"
          >
            {["All", "High", "Medium", "Low"].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={priority === value}
                onClick={() => {
                  setPriority(value);
                  filteredChanged();
                }}
              >
                {value}
                <span>
                  {value === "All"
                    ? model.findings.length
                    : model.priorities[value as keyof typeof model.priorities]}
                </span>
              </button>
            ))}
          </div>
          <div className={styles.filterContext}>
            <p role="status">
              Showing {visible.length} of {filtered.length} matching findings
              {priority !== "All" ? ` · ${priority} priority` : ""}
              {area !== "All" ? ` · ${labelFor(area)}` : ""}
              {query ? ` · Search: “${search.trim()}”` : ""}
            </p>
            {(priority !== "All" || area !== "All" || query) && (
              <button type="button" onClick={reset}>
                Clear filters
              </button>
            )}
          </div>
          <div className={styles.findings}>
            {visible.map(({ id, issue, areas }) => (
              <div
                ref={(element) => {
                  if (element) rows.current.set(id, element);
                  else rows.current.delete(id);
                }}
                tabIndex={-1}
                role="article"
                className={styles.finding}
                key={id}
              >
                <div className={styles.findingMeta}>
                  <span
                    className={styles.priority}
                    data-priority={issue.priority}
                  >
                    {issue.priority} priority
                  </span>
                  <span>{areas.map(labelFor).join(" · ")}</span>
                </div>
                <h4>{issue.title}</h4>
                <p className={styles.description}>{issue.detail}</p>
                <details
                  open={selected === id}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    if (open) setSelected(id);
                    else setSelected((value) => (value === id ? null : value));
                  }}
                >
                  <summary
                    aria-label={`${selected === id ? "Hide" : "View"} details: ${issue.title}`}
                  >
                    {selected === id ? "Hide details" : "View details"}
                    <Icon name="down" width="14" height="14" />
                  </summary>
                  <div className={styles.findingDetails}>
                    <p>{issue.detail}</p>
                    {evidence(issue)}
                    {issue.fixSteps?.length ? (
                      <div className={styles.steps}>
                        <strong>Suggested steps</strong>
                        <ol>
                          {issue.fixSteps.map((step, index) => (
                            <li key={index}>
                              <strong>{step.title}</strong>
                              <p>{step.description}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {areas.map((key) => (
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={() => navigate(key)}
                        key={key}
                      >
                        Open {labelFor(key)} review
                        <Icon name="arrow" width="14" height="14" />
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
          {!filtered.length && (
            <div className={styles.empty}>
              <Icon name="search" width="25" height="25" />
              <strong>
                {model.findings.length
                  ? "No findings match these filters."
                  : "No supported findings are available for this overview."}
              </strong>
              <p>
                {model.findings.length
                  ? "Try another priority, review area or search term."
                  : "Review the category assessments and coverage limits. An empty list is not confirmation that the website has no issues."}
              </p>
              {model.findings.length > 0 && (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={reset}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
          {filtered.length > 5 && (
            <button
              type="button"
              className={styles.showMore}
              onClick={() => {
                setExpanded(!expanded);
                if (
                  expanded &&
                  selected &&
                  !filtered.slice(0, 5).some((item) => item.id === selected)
                )
                  setSelected(null);
              }}
            >
              {expanded
                ? "Show fewer findings"
                : `Show all ${filtered.length} findings`}
              <Icon name="down" width="15" height="15" />
            </button>
          )}
          <p className={styles.listFootnote}>
            Higher priority first. Priority is an AI recommendation, not
            measured business impact.
          </p>
        </section>
        <aside
          ref={categoriesSection}
          tabIndex={-1}
          className={styles.categoriesCard}
          aria-labelledby="dashboard-categories"
        >
          <div className={styles.sectionHeading}>
            <div>
              <h3 id="dashboard-categories">Five perspectives</h3>
              <p>Open an area for its criteria and full review.</p>
            </div>
          </div>
          <div className={styles.categories}>
            {model.categories.map((item) => (
              <button
                type="button"
                className={styles.category}
                key={item.key}
                onClick={() => navigate(item.key)}
                aria-label={`Open ${item.label} review`}
              >
                <span className={styles.categoryTop}>
                  <Icon name={item.icon} width="17" height="17" />
                  <strong>{item.label}</strong>
                  <span className={styles.categoryScore}>
                    {item.score === null ? (
                      <small>Not assessed</small>
                    ) : (
                      <>
                        {item.score}
                        <small>/100</small>
                      </>
                    )}
                  </span>
                </span>
                <span className={styles.categoryMeta}>
                  {item.current
                    ? `${item.assessed}/4 criteria assessed`
                    : "Fresh review needed"}{" "}
                  · {item.findings}{" "}
                  {item.findings === 1 ? "finding" : "findings"}
                </span>
                {item.score !== null && (
                  <span className={styles.track} aria-hidden="true">
                    <span style={{ width: `${item.score}%` }} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className={styles.railNote}>
            Assessments of collected content and HTML. Missing assessments are
            excluded; a valid zero remains zero.
          </p>
        </aside>
      </div>
      <section
        className={styles.checksSection}
        aria-labelledby="dashboard-checks"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="dashboard-checks">Complete the picture</h3>
            <p>
              Separate checks with their own scope. Results collected does not
              mean a pass.
            </p>
          </div>
        </div>
        <div className={styles.checks}>
          {model.checks.map((check) => (
            <button
              type="button"
              key={check.key}
              onClick={() => navigate(check.key)}
              aria-label={`Open ${check.label}`}
            >
              <Icon name={check.icon} width="21" height="21" />
              <span>
                <strong>{check.label}</strong>
                <small>{check.description}</small>
                <span
                  className={styles.checkStatus}
                  data-available={check.available}
                >
                  {check.available
                    ? "Results collected"
                    : "Open to collect results"}
                </span>
              </span>
              <Icon name="chevron" width="15" height="15" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
