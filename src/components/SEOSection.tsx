"use client";

import { useEffect, useId, useRef, useState } from "react";
import { sourceURL } from "@/lib/dashboard";
import { reviewIssues } from "@/lib/review-workspace";
import type { FixStep, Issue } from "@/lib/types";
import {
  SEO_CRITERIA,
  SEO_GUIDANCE,
  SEO_UNTESTED,
  seoScore,
  type SEOAnalysis,
} from "@/lib/seo";
import {
  seoObservations,
  seoPlan,
  seoReviewedCriteria,
} from "@/lib/seo-presentation";
import ReviewEvidence, { ReviewSourceLink } from "./ReviewEvidence";
import {
  ReviewAssessments,
  ReviewFixSteps,
  ReviewNotice,
  ReviewSnapshot,
  ReviewTools,
  usePlanExport,
} from "./ReviewWorkspace";
import SEOPageInspector from "./SEOPageInspector";
import Icon from "./Icon";
import layout from "./UXSection.module.css";
import shared from "./ReviewWorkspace.module.css";
import styles from "./SEOSection.module.css";

interface Props {
  analysis?: SEOAnalysis;
  issues: Issue[];
  url: string;
  collectedPages?: string[];
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (key: string, steps: FixStep[]) => void;
}

type View = "findings" | "signals";
const priorities = ["all", "High", "Medium", "Low"] as const;
const defaultFilters = {
  priority: "all" as (typeof priorities)[number],
  area: "all",
  page: "",
};
const issueArea = (issue: Issue) =>
  SEO_CRITERIA.find(({ key }) => key === issue.seoCriterion)?.key || "other";
const areaLabel = (issue: Issue) =>
  SEO_CRITERIA.find(({ key }) => key === issueArea(issue))?.label ||
  "Other / earlier findings";

export default function SEOSection({
  analysis,
  issues,
  url,
  collectedPages,
  generatedFixSteps,
  onFixStepsLoaded,
}: Props) {
  const prefix = useId();
  const [view, setView] = useState<View>("findings");
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedFinding, setSelectedFinding] = useState("");
  const [inspectorPage, setInspectorPage] = useState("");
  const [showAll, setShowAll] = useState(false);
  const focusView = useRef<View | null>(null);
  const findingsHeading = useRef<HTMLHeadingElement>(null);
  const signalsHeading = useRef<HTMLHeadingElement>(null);
  const activePanel = useRef<HTMLElement>(null);
  const allPriority = useRef<HTMLButtonElement>(null);
  const exporter = usePlanExport();

  useEffect(() => {
    if (focusView.current !== view) return;
    (view === "findings" ? findingsHeading : signalsHeading).current?.focus();
    focusView.current = null;
  }, [view]);

  const criteria = seoReviewedCriteria(analysis, collectedPages);
  const validation = analysis?.assessmentValidation;
  const partial =
    validation?.summaryWithheld || !!validation?.withheldCriteria?.length;
  const pages = [
    ...new Map(
      (analysis?.pages || []).flatMap((page) => {
        const key = sourceURL(page.url);
        return key ? [[key, page] as const] : [];
      }),
    ).entries(),
  ];
  const selectedPage = pages.find(([key]) => key === inspectorPage) || pages[0];
  const observations = seoObservations(analysis, issues);
  const records = reviewIssues(issues).map((record) => ({
    ...record,
    sourcePages: [
      ...new Set(
        [
          record.issue.pageUrl,
          ...(record.issue.seoEvidence || []).map((source) => source.pageUrl),
        ].flatMap((value) => {
          const key = sourceURL(value || "");
          return key ? [key] : [];
        }),
      ),
    ],
  }));
  const match = (next: typeof filters) =>
    records.filter(
      ({ issue, sourcePages }) =>
        (next.priority === "all" || issue.priority === next.priority) &&
        (next.area === "all" || issueArea(issue) === next.area) &&
        (!next.page || sourcePages.includes(next.page)),
    );
  const matching = match(filters);
  const active =
    matching.find((record) => record.key === selectedFinding) || matching[0];
  const activeIndex = matching.findIndex(
    (record) => record.key === active?.key,
  );
  const filtered =
    filters.priority !== "all" || filters.area !== "all" || !!filters.page;
  const emptyPage =
    filters.page &&
    !records.some((record) => record.sourcePages.includes(filters.page));
  const visible = showAll
    ? matching
    : matching.filter(
        (record, index) =>
          index < (activeIndex >= 5 ? 4 : 5) || record.key === active?.key,
      );
  const filterPages = [
    ...new Set([
      ...pages.map(([key]) => key),
      ...records.flatMap((record) => record.sourcePages),
    ]),
  ];
  const inspectableSources =
    active?.sourcePages.filter((value) =>
      pages.some(([key]) => key === value),
    ) || [];
  const pageCount =
    collectedPages?.length ?? analysis?.scope?.pages ?? analysis?.pages?.length;
  const headers = analysis?.scope?.headersChecked;
  const plan = () =>
    seoPlan(analysis, issues, url, generatedFixSteps, collectedPages);
  const auditedUrl = sourceURL(url);

  function changeFilters(next: typeof filters) {
    const matches = match(next);
    setSelectedFinding(
      matches.find((item) => item.key === active?.key)?.key ||
        matches[0]?.key ||
        "",
    );
    setShowAll(false);
    setFilters(next);
  }

  function reset() {
    (allPriority.current || findingsHeading.current)?.focus();
    changeFilters(defaultFilters);
  }

  function inspect(page?: string) {
    if (page) setInspectorPage(page);
    focusView.current = "signals";
    setView("signals");
  }

  function viewPageFindings(page: string) {
    changeFilters({ ...defaultFilters, page });
    focusView.current = "findings";
    setView("findings");
  }

  return (
    <div
      className={`${shared.workspace} ${layout.workspace} ${styles.workspace}`}
      data-review-workspace="seo"
    >
      <ReviewTools
        copyLabel="Copy SEO plan"
        downloadLabel="Download SEO plan (.txt)"
        onCopy={() =>
          void exporter.copy(
            plan(),
            "SEO action plan copied, including all findings, sources and testing limits.",
          )
        }
        onDownload={() =>
          exporter.download(
            plan(),
            `${auditedUrl ? new URL(auditedUrl).hostname : "website"}-seo-action-plan.txt`,
          )
        }
      >
        Review supported improvements and inspect the search signals collected
        for each page.
      </ReviewTools>
      {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
      {partial && (
        <ReviewNotice>
          Some SEO assessments could not be verified in this run. Unverified
          explanations are withheld, and only verified areas contribute to the
          score. Collected page signals and supported findings remain available.
        </ReviewNotice>
      )}
      {analysis?.method !== "page-seo-review-v1" && (
        <ReviewNotice>
          This report contains an earlier SEO review. A new audit can collect a
          current assessment and page signals.
        </ReviewNotice>
      )}
      <ReviewSnapshot
        label="On-page SEO assessment"
        score={seoScore(criteria)}
        assessed={criteria.length}
        total={SEO_CRITERIA.length}
        count={issues.length}
        scope={
          pageCount == null
            ? "Page coverage not recorded"
            : `${pageCount} ${pageCount === 1 ? "page" : "pages"} reviewed`
        }
        note="Indexing and rankings not tested"
      />

      <div
        className={styles.views}
        role="group"
        aria-label="SEO workspace views"
      >
        <button
          type="button"
          aria-pressed={view === "findings"}
          aria-controls={`${prefix}-findings`}
          onClick={() => setView("findings")}
        >
          <Icon name="layers" width="17" height="17" /> Findings{" "}
          <span>{issues.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={view === "signals"}
          aria-controls={`${prefix}-signals`}
          onClick={() => setView("signals")}
        >
          <Icon name="search" width="17" height="17" /> Page signals
        </button>
      </div>

      <section
        id={`${prefix}-findings`}
        hidden={view !== "findings"}
        aria-labelledby={`${prefix}-findings-heading`}
      >
        <div className={styles.workArea}>
          <header className={styles.workHeading}>
            <h3
              id={`${prefix}-findings-heading`}
              ref={findingsHeading}
              tabIndex={-1}
            >
              Supported findings
            </h3>
            <p>Select an improvement to review its evidence and next steps.</p>
          </header>
          {!!issues.length && (
            <div className={styles.filters}>
              <div
                className={layout.priorities}
                role="group"
                aria-label="Filter SEO findings by priority"
              >
                {priorities.map((priority) => (
                  <button
                    key={priority}
                    ref={priority === "all" ? allPriority : undefined}
                    type="button"
                    aria-pressed={filters.priority === priority}
                    onClick={() => changeFilters({ ...filters, priority })}
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
              <label className={styles.filterLabel}>
                Focus area
                <select
                  aria-label="SEO finding focus area"
                  value={filters.area}
                  onChange={(event) =>
                    changeFilters({ ...filters, area: event.target.value })
                  }
                >
                  <option value="all">All areas</option>
                  {SEO_CRITERIA.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                  {issues.some((issue) => issueArea(issue) === "other") && (
                    <option value="other">Other / earlier findings</option>
                  )}
                </select>
              </label>
              {(filterPages.length > 1 || filters.page) && (
                <label className={styles.filterLabel}>
                  Finding page
                  <select
                    aria-label="SEO finding page"
                    value={filters.page}
                    onChange={(event) =>
                      changeFilters({ ...filters, page: event.target.value })
                    }
                  >
                    <option value="">All pages</option>
                    {filterPages.map((page) => (
                      <option key={page} value={page}>
                        {page}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {(issues.length > 0 || filtered) && (
            <div className={styles.resultLine}>
              <p role="status">
                {matching.length} of {issues.length} findings match{" "}
                {filtered ? "these filters" : "the full review"}
                {filters.page ? ` · Page ${filters.page}` : ""}
              </p>
              {filtered && (
                <button
                  type="button"
                  className={layout.textButton}
                  onClick={reset}
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

          {active ? (
            <div className={layout.workbench}>
              <section
                className={layout.queue}
                aria-label="Prioritized SEO findings"
              >
                <div className={layout.queueHeading}>
                  <h4>Prioritized findings</h4>
                  <span>{matching.length}</span>
                </div>
                <label className={layout.mobilePicker}>
                  Choose an SEO finding
                  <select
                    aria-label="Choose an SEO finding"
                    value={active.key}
                    onChange={(event) => setSelectedFinding(event.target.value)}
                  >
                    {matching.map(({ issue, key, sourcePages }, index) => (
                      <option key={key} value={key}>
                        {index + 1}. {issue.title}
                        {sourcePages[0] ? ` · ${sourcePages[0]}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={layout.queueList}>
                  {visible.map(({ issue, key, sourcePages }) => (
                    <button
                      type="button"
                      key={key}
                      aria-label={`Select SEO finding ${matching.findIndex((record) => record.key === key) + 1}: ${issue.title}`}
                      aria-pressed={key === active.key}
                      aria-controls={`${prefix}-active`}
                      onClick={() => setSelectedFinding(key)}
                    >
                      <span className={layout.queueMeta}>
                        <span
                          className={layout.priority}
                          data-priority={issue.priority}
                        >
                          {issue.priority}
                        </span>
                      </span>
                      <strong>{issue.title}</strong>
                      <span className={layout.meta}>{areaLabel(issue)}</span>
                      {sourcePages[0] && (
                        <span className={layout.queuePage}>
                          {sourcePages[0]}
                        </span>
                      )}
                    </button>
                  ))}
                  {matching.length > 5 && (
                    <button
                      type="button"
                      className={layout.showAll}
                      onClick={() => setShowAll(!showAll)}
                    >
                      {showAll
                        ? "Show fewer findings"
                        : `Show all ${matching.length} findings`}
                    </button>
                  )}
                </div>
                <div className={layout.queueFooter}>
                  <span>
                    Finding{" "}
                    {matching.findIndex(({ key }) => key === active.key) + 1} of{" "}
                    {matching.length}
                  </span>
                  <button
                    type="button"
                    className={layout.textButton}
                    onClick={() => activePanel.current?.focus()}
                  >
                    Go to finding details{" "}
                    <Icon name="arrow" width="14" height="14" />
                  </button>
                </div>
              </section>

              <article
                key={active.key}
                ref={activePanel}
                tabIndex={-1}
                id={`${prefix}-active`}
                aria-labelledby={`${prefix}-active-title`}
                className={layout.activePanel}
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
                    <span>{areaLabel(active.issue)}</span>
                  </div>
                  <h4 id={`${prefix}-active-title`}>{active.issue.title}</h4>
                  <p>{active.issue.detail}</p>
                  <div className={styles.inlineActions}>
                    {inspectableSources[0] ? (
                      <button
                        type="button"
                        className={layout.button}
                        onClick={() => inspect(inspectableSources[0])}
                      >
                        <Icon name="search" width="15" height="15" /> Inspect
                        source page
                      </button>
                    ) : (
                      <span className={layout.meta}>
                        Page inspection is unavailable for this finding.
                      </span>
                    )}
                    <ReviewSourceLink
                      url={active.sourcePages[0]}
                      label="Open audited page"
                    />
                  </div>
                  {!active.issue.pageUrl && (
                    <p className={layout.meta}>
                      Primary source URL not recorded. Audited address {url}
                    </p>
                  )}
                  {active.issue.pageUrl && !sourceURL(active.issue.pageUrl) && (
                    <p className={layout.meta}>
                      Saved source URL {active.issue.pageUrl}
                    </p>
                  )}
                  {inspectableSources.length > 1 && (
                    <div className={styles.inlineActions}>
                      {inspectableSources.slice(1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          className={layout.textButton}
                          onClick={() => inspect(page)}
                        >
                          Inspect {page}
                        </button>
                      ))}
                    </div>
                  )}
                </header>
                <section
                  className={layout.evidenceSection}
                  aria-label="Recorded SEO evidence"
                >
                  <div className={layout.contentHeading}>
                    <Icon name="file" width="17" height="17" />
                    <h4>What was collected</h4>
                  </div>
                  <ReviewEvidence
                    seo={active.issue.seoEvidence}
                    plain={active.issue.evidence}
                    pageUrl={active.issue.pageUrl}
                    observation
                  />
                </section>
                <div className={layout.steps}>
                  <ReviewFixSteps
                    issue={active.issue}
                    generationKey={active.key}
                    headingLevel={4}
                    title="Recommended next steps"
                    url={url}
                    generated={generatedFixSteps}
                    onLoaded={onFixStepsLoaded}
                  />
                </div>
                <div className={layout.manualCheck}>
                  <Icon name="eye" width="18" height="18" />
                  <div>
                    <h4>Verify after making changes</h4>
                    <p>
                      Review the published page. Use URL Inspection in your
                      Search Console property for indexing and Google-selected
                      canonical information.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className={layout.empty}>
              <Icon name="search" width="23" height="23" />
              <h4>
                {emptyPage
                  ? "No retained findings for this page"
                  : filtered
                    ? "No findings match these filters"
                    : "No supported on-page fixes in this sample"}
              </h4>
              <p>
                {filtered
                  ? "Change the filters to review the other retained findings."
                  : "Inspect the collected page signals or review the assessment coverage for this report."}
              </p>
              {!filtered && pages.length > 0 && (
                <button
                  type="button"
                  className={layout.button}
                  onClick={() => inspect()}
                >
                  Inspect collected pages{" "}
                  <Icon name="arrow" width="14" height="14" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        id={`${prefix}-signals`}
        hidden={view !== "signals"}
        aria-labelledby={`${prefix}-signals-heading`}
      >
        <div className={styles.workArea}>
          <header className={styles.workHeading}>
            <h3
              id={`${prefix}-signals-heading`}
              ref={signalsHeading}
              tabIndex={-1}
            >
              Collected page signals
            </h3>
            <p>
              Inspect recorded metadata, declarations and page structure for a
              collected URL.
            </p>
          </header>
          {selectedPage ? (
            <SEOPageInspector
              page={selectedPage[1]}
              pageKey={selectedPage[0]}
              pages={pages}
              checks={analysis?.checks || []}
              evidence={observations}
              findingCount={
                records.filter((record) =>
                  record.sourcePages.includes(selectedPage[0]),
                ).length
              }
              onPageChange={setInspectorPage}
              onViewFindings={() => viewPageFindings(selectedPage[0])}
            />
          ) : (
            <div className={layout.empty}>
              <h4>Page inspection is unavailable</h4>
              <p>
                This saved report has no usable page inventory. The findings and
                their recorded sources are available in Findings.
              </p>
            </div>
          )}
        </div>
      </section>

      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="layers" width="18" height="18" />
            <strong>Assessment and strengths</strong>
          </span>
          <span className={layout.meta}>
            {criteria.length} of 4 assessed{" "}
            <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.assessments}>
          <ReviewAssessments
            rubrics={SEO_CRITERIA}
            criteria={criteria}
            summary={
              analysis?.method === "page-seo-review-v1" &&
              !validation?.summaryWithheld
                ? analysis.summary
                : undefined
            }
            summaryEvidence={<ReviewEvidence seo={analysis?.summarySources} />}
            unavailableReason={(key) =>
              validation?.withheldCriteria?.some((item) => item === key)
                ? "This area's assessment explanation could not be verified."
                : undefined
            }
            evidence={(key) => {
              const item = criteria.find((criterion) => criterion.key === key);
              return item && <ReviewEvidence seo={item.sources} />;
            }}
          >
            <p>
              Base weights are 30% for titles and descriptions, 30% for
              canonical and indexing signals, 25% for content and structure, and
              15% for structured data. The score reweights available
              source-backed criteria and rounds once.
            </p>
          </ReviewAssessments>
          {!!analysis?.strengths?.length && (
            <section className={styles.strengths}>
              <h3>Recorded strengths</h3>
              <ul>
                {analysis.strengths.map((strength, index) => (
                  <li key={index}>
                    <p>{strength.text}</p>
                    <details>
                      <summary>View supporting observations</summary>
                      <ReviewEvidence seo={strength.sources} />
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
            <Icon name="eye" width="18" height="18" />
            <strong>Coverage and follow-up checks</strong>
          </span>
          <span className={layout.meta}>
            Initial HTML and available headers{" "}
            <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.scope}>
          <p>
            {headers == null
              ? "Response-header coverage was not recorded."
              : `${headers} final ${headers === 1 ? "response" : "responses"} with headers collected.`}{" "}
            {analysis?.scope?.truncated &&
              "Some content or observations were sampled."}
          </p>
          {!!analysis?.verification?.withheld && (
            <p>Unsupported draft advice was withheld.</p>
          )}
          <h3>Checks outside this review</h3>
          <ul>
            {[
              ...new Set([...(analysis?.unassessed || []), ...SEO_UNTESTED]),
            ].map((item) => (
              <li key={item}>{item} · Not tested</li>
            ))}
          </ul>
          <p>
            For indexing or canonical selection, open URL Inspection in the
            relevant Search Console property.
          </p>
          <div className={styles.inlineActions}>
            <ReviewSourceLink
              url="https://search.google.com/search-console"
              label="Open Search Console"
            />
            {SEO_GUIDANCE.map((item) => (
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
