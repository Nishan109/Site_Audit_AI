"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AEOAnalysis, FixStep, Issue } from "@/lib/types";
import {
  AI_VISIBILITY_GUIDANCE,
  AI_VISIBILITY_UNASSESSED,
} from "@/lib/ai-visibility";
import {
  aiFindingPages,
  aiVisibilityPlan,
  aiVisibilityPresentation,
  aiVisibilityValidation,
  distinctAISources,
  type ReadinessCollectedPage,
} from "@/lib/ai-visibility-presentation";
import { sourceURL } from "@/lib/dashboard";
import { reviewIssues } from "@/lib/review-workspace";
import {
  AIVisibilityObservations,
  AIVisibilitySources,
} from "./AIVisibilityEvidence";
import AIVisibilityPageInspector from "./AIVisibilityPageInspector";
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
import workbench from "./ConversionSection.module.css";
import styles from "./AIVisibilitySection.module.css";

interface Props {
  analysis?: AEOAnalysis;
  url: string;
  collectedPages?: ReadinessCollectedPage[];
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (key: string, steps: FixStep[]) => void;
}

const priorities = ["All", "High", "Medium", "Low"] as const;
const initialFilters = {
  priority: "All" as (typeof priorities)[number],
  area: "",
  page: "",
};
type View = "findings" | "evidence";

export default function AIVisibilitySection({
  analysis,
  url,
  collectedPages,
  generatedFixSteps,
  onFixStepsLoaded,
}: Props) {
  const id = useId();
  const [view, setView] = useState<View>("findings");
  const [filters, setFilters] = useState(initialFilters);
  const [selection, setSelection] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const requestedFocus = useRef<View | null>(null);
  const findingsHeading = useRef<HTMLHeadingElement>(null);
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  const detail = useRef<HTMLElement>(null);
  const allPriority = useRef<HTMLButtonElement>(null);
  const exporter = usePlanExport();

  useEffect(() => {
    if (requestedFocus.current !== view) return;
    (view === "findings" ? findingsHeading : evidenceHeading).current?.focus();
    requestedFocus.current = null;
  }, [view]);

  const review = analysis?.review;
  const issues = analysis?.issues ?? [];
  const model = aiVisibilityPresentation(review, issues, collectedPages);
  const { assessment, pages } = model;
  const inspectedPage = pages.find((page) => page.url === pageUrl) || pages[0];
  const inspectablePages = pages.map((page) => page.url);
  const findings = reviewIssues(issues).map((record, rank) => ({
    ...record,
    rank,
    pages: aiFindingPages(record.issue),
  }));
  const filterPages = [
    ...new Set([
      ...inspectablePages,
      ...findings.flatMap((finding) => finding.pages),
    ]),
  ];
  const pageFindings = findings.filter(
    (finding) => !filters.page || finding.pages.includes(filters.page),
  );
  const areaFindings = pageFindings.filter(
    ({ issue }) => !filters.area || issue.aiCriterion === filters.area,
  );
  const matching = areaFindings.filter(
    ({ issue }) =>
      filters.priority === "All" || issue.priority === filters.priority,
  );
  const active =
    matching.find((finding) => finding.key === selection) ?? matching[0];
  const sources = distinctAISources(active?.issue.aiEvidence);
  const filtered =
    filters.priority !== "All" || !!filters.area || !!filters.page;
  const title = (finding: (typeof findings)[number]) =>
    findings.some(
      (other) =>
        other.key !== finding.key && other.issue.title === finding.issue.title,
    )
      ? `${finding.issue.title} · Finding ${finding.rank + 1}`
      : finding.issue.title;
  const criterion = (issue: Issue) =>
    assessment.criteria.find((item) => item.key === issue.aiCriterion)?.label;
  const plan = () =>
    aiVisibilityPlan(review, issues, url, generatedFixSteps, collectedPages);
  const audited = sourceURL(url);

  function inspect(page?: string) {
    if (page && inspectablePages.includes(page)) setPageUrl(page);
    requestedFocus.current = "evidence";
    setView("evidence");
  }

  function viewPageFindings(page: string) {
    setFilters({ ...initialFilters, page });
    requestedFocus.current = "findings";
    setView("findings");
  }

  function clearFilters() {
    (allPriority.current || findingsHeading.current)?.focus();
    setFilters(initialFilters);
  }

  return (
    <div
      className={`${shared.workspace} ${layout.workspace} ${styles.workspace}`}
      data-review-workspace="aeo"
    >
      <ReviewTools
        copyLabel="Copy readiness plan"
        downloadLabel="Download readiness plan (.txt)"
        downloadText="Download readiness plan"
        onCopy={() =>
          void exporter.copy(
            plan(),
            "Readiness plan copied with all findings and sources.",
          )
        }
        onDownload={() =>
          exporter.download(
            plan(),
            `${audited ? new URL(audited).hostname : "website"}-ai-content-readiness.txt`,
          )
        }
      >
        Review how clearly your pages explain their topic, answer questions, and
        support important claims.
      </ReviewTools>
      {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
      <ReviewSnapshot
        label="Content readiness"
        score={assessment.score}
        assessed={assessment.assessed}
        total={assessment.criteria.length}
        count={findings.length}
        scope={
          pages.length
            ? `${pages.length} collected ${pages.length === 1 ? "page" : "pages"}`
            : "No collected pages in this report"
        }
        note="Live AI appearances and citations were not measured"
      />
      {!assessment.current && (
        <ReviewNotice>
          Use Run again above to collect a cited content-readiness assessment.
          Saved findings remain available below.
        </ReviewNotice>
      )}
      {assessment.partial && (
        <ReviewNotice>
          Some explanations could not be verified and were withheld. Supported
          findings and collected evidence remain available.
        </ReviewNotice>
      )}
      <div
        className={workbench.views}
        role="group"
        aria-label="AI visibility workspace views"
      >
        <button
          type="button"
          aria-pressed={view === "findings"}
          aria-controls={`${id}-findings`}
          onClick={() => setView("findings")}
        >
          <Icon name="layers" width="17" height="17" /> Findings{" "}
          <span>{findings.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={view === "evidence"}
          aria-controls={`${id}-evidence`}
          onClick={() => setView("evidence")}
        >
          <Icon name="file" width="17" height="17" /> Page evidence
        </button>
      </div>

      <section
        id={`${id}-findings`}
        hidden={view !== "findings"}
        aria-labelledby={`${id}-findings-heading`}
      >
        <div className={workbench.workArea}>
          <header className={workbench.heading}>
            <h3
              id={`${id}-findings-heading`}
              ref={findingsHeading}
              tabIndex={-1}
            >
              Supported findings
            </h3>
            <p>
              Choose a content improvement to see its sources, suggested change,
              and checks before publishing.
            </p>
          </header>
          {!!findings.length && (
            <div className={workbench.filters}>
              <div
                className={layout.priorities}
                role="group"
                aria-label="Filter AI visibility findings by priority"
              >
                {priorities.map((priority) => (
                  <button
                    key={priority}
                    ref={priority === "All" ? allPriority : undefined}
                    type="button"
                    aria-pressed={filters.priority === priority}
                    onClick={() => setFilters({ ...filters, priority })}
                  >
                    {priority}{" "}
                    <span>
                      {priority === "All"
                        ? areaFindings.length
                        : areaFindings.filter(
                            ({ issue }) => issue.priority === priority,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              {findings.some(({ issue }) => criterion(issue)) && (
                <label className={workbench.field}>
                  Readiness criterion
                  <select
                    value={filters.area}
                    onChange={(event) =>
                      setFilters({ ...filters, area: event.target.value })
                    }
                  >
                    <option value="">All criteria</option>
                    {assessment.criteria.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(filterPages.length > 1 || filters.page) && (
                <label className={workbench.field}>
                  Finding source page
                  <select
                    value={filters.page}
                    onChange={(event) =>
                      setFilters({ ...filters, page: event.target.value })
                    }
                  >
                    <option value="">All source pages</option>
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
          <div className={workbench.resultLine}>
            <p role="status">
              {filtered
                ? `${matching.length} of ${findings.length} findings match these filters`
                : `${findings.length} supported ${findings.length === 1 ? "finding" : "findings"}`}
            </p>
            {filtered && (
              <button
                type="button"
                className={layout.textButton}
                onClick={clearFilters}
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
                    {matching.map((finding) => (
                      <option key={finding.key} value={finding.key}>
                        {finding.issue.priority} · {title(finding)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={layout.queueList}>
                  {matching.map((finding) => (
                    <button
                      type="button"
                      key={finding.key}
                      aria-pressed={active.key === finding.key}
                      aria-controls={`${id}-active`}
                      onClick={() => setSelection(finding.key)}
                    >
                      <span className={layout.queueMeta}>
                        <span
                          className={layout.priority}
                          data-priority={finding.issue.priority}
                        >
                          {finding.issue.priority}
                        </span>
                        {active.key === finding.key && (
                          <span className={layout.selectedLabel}>Selected</span>
                        )}
                      </span>
                      <strong>{title(finding)}</strong>
                      <span className={layout.queuePage}>
                        {[criterion(finding.issue), finding.pages[0]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
                <footer className={layout.queueFooter}>
                  <span>
                    Finding {matching.indexOf(active) + 1} of {matching.length}
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
                id={`${id}-active`}
                aria-labelledby={`${id}-active-title`}
                className={`${layout.activePanel} ${workbench.detailPanel}`}
                data-active-finding={active.key}
              >
                <header
                  className={`${layout.findingHeader} ${workbench.findingHeader}`}
                >
                  <div className={layout.findingMeta}>
                    <span
                      className={layout.priority}
                      data-priority={active.issue.priority}
                    >
                      {active.issue.priority} priority
                    </span>
                    {criterion(active.issue) && (
                      <span>{criterion(active.issue)}</span>
                    )}
                  </div>
                  <h4 id={`${id}-active-title`}>{active.issue.title}</h4>
                  <p>
                    <strong>Why it matters</strong>
                  </p>
                  <p>{active.issue.detail}</p>
                </header>
                <section className={workbench.findingSection}>
                  <h5>
                    <Icon name="link" width="16" height="16" /> What the audit
                    observed
                  </h5>
                  {sources.length ? (
                    <AIVisibilityObservations
                      sources={sources}
                      onInspectPage={inspect}
                      inspectablePages={inspectablePages}
                    />
                  ) : (
                    <>
                      <ReviewEvidence
                        plain={active.issue.evidence}
                        observation={
                          active.issue.evidenceType === "ai-observation"
                        }
                      />
                      <div className={workbench.sourceActions}>
                        {active.pages[0] ? (
                          <>
                            <span>{active.pages[0]}</span>
                            <ReviewSourceLink
                              url={active.pages[0]}
                              label="Open audited page"
                            />
                            {inspectablePages.includes(active.pages[0]) && (
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
                    </>
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
                <details className={workbench.validate}>
                  <summary>
                    How to check it <small>Manual checks</small>
                  </summary>
                  <ol>
                    {aiVisibilityValidation(active.issue).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  <p className={styles.validationNote}>
                    Verify every new factual claim before publishing.
                  </p>
                </details>
              </article>
            </div>
          ) : (
            <div className={layout.empty}>
              <Icon name="sparkle" width="22" height="22" />
              <h4>
                {!findings.length
                  ? "No supported content findings in this report"
                  : !pageFindings.length
                    ? "No supported findings for this page"
                    : "No findings match these filters"}
              </h4>
              <p>
                {!findings.length
                  ? "The collected sample did not support a specific content recommendation."
                  : "Clear the filters to see the full report."}
              </p>
              {!!pages.length && (
                <button
                  type="button"
                  className={layout.button}
                  onClick={() => inspect(filters.page)}
                >
                  Inspect page evidence
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section
        id={`${id}-evidence`}
        hidden={view !== "evidence"}
        aria-labelledby={`${id}-evidence-heading`}
      >
        <AIVisibilityPageInspector
          headingId={`${id}-evidence-heading`}
          headingRef={evidenceHeading}
          page={inspectedPage}
          pages={pages}
          observations={model.observations}
          onSelect={setPageUrl}
          onFindings={viewPageFindings}
        />
      </section>

      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="chart" width="18" height="18" />
            <strong>Assessment and strengths</strong>
          </span>
          <span className={layout.meta}>
            {assessment.assessed} of {assessment.criteria.length} criteria
            assessed <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={workbench.secondaryBody}>
          <ReviewAssessments
            rubrics={assessment.criteria}
            criteria={assessment.criteria}
            summary={model.summary}
            summaryEvidence={
              model.summarySources.length ? (
                <AIVisibilityObservations sources={model.summarySources} />
              ) : undefined
            }
            evidence={(key) => {
              const items = assessment.criteria.find(
                (item) => item.key === key,
              )?.sources;
              return items?.length ? (
                <AIVisibilityObservations sources={items} />
              ) : null;
            }}
          >
            <p>
              Available, source-backed criteria are weighted and rounded once.
              Markup is recorded separately.
            </p>
          </ReviewAssessments>
          {!!model.strengths.length && (
            <section className={workbench.strengths}>
              <h3>Recorded strengths</h3>
              <ul>
                {model.strengths.map((strength, index) => (
                  <li key={index}>
                    {strength.text}
                    <AIVisibilitySources sources={strength.sources} />
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
            <strong>Measure visibility separately</strong>
          </span>
          <span className={layout.meta}>
            Manual follow-up <Icon name="down" width="15" height="15" />
          </span>
        </summary>
        <div className={styles.guide}>
          <dl>
            <div>
              <dt>
                Live AI appearances and citations <span>Not measured</span>
              </dt>
              <dd>
                Repeat representative questions and record the date, service or
                mode, exact wording, locale, response, and cited URLs. Compare
                the observations for those queries.
              </dd>
            </div>
            <div>
              <dt>
                Crawler access and indexing <span>Not tested</span>
              </dt>
              <dd>
                With the site owner, check the relevant robots.txt rules, server
                or CDN logs, and indexing diagnostics. Search, training, and
                user-initiated visits may use separate controls.
              </dd>
            </div>
            <div>
              <dt>
                Traffic and conversions <span>Not measured</span>
              </dt>
              <dd>
                Use authorized analytics or search reports for observed
                outcomes. Keep combined traffic data separate from
                service-specific attribution.
              </dd>
            </div>
            <div>
              <dt>
                Website claims and credentials{" "}
                <span>Not independently verified</span>
              </dt>
              <dd>
                Confirm the details with the site owner or supporting source
                before publishing changes.
              </dd>
            </div>
          </dl>
          {model.limits.some(
            (item) => !AI_VISIBILITY_UNASSESSED.includes(item),
          ) && (
            <ul>
              {model.limits
                .filter((item) => !AI_VISIBILITY_UNASSESSED.includes(item))
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
          )}
          <p className={styles.note}>
            {review?.scope?.sources ?? model.observations.length} recorded
            observations across the available review.
            {review?.scope?.sampled && " Some content was sampled."}
            {!!review?.verification?.withheld &&
              " Unsupported or uncertain draft advice was withheld."}
          </p>
          <div className={workbench.sourceActions}>
            {AI_VISIBILITY_GUIDANCE.map((item) => (
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
