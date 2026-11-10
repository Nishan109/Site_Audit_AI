"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { FixStep, Issue } from "@/lib/types";
import {
  issueSteps,
  reviewIssueKey,
  reviewIssues,
  type ReviewCriterion,
} from "@/lib/review-workspace";
import ReviewEvidence, { ReviewSourceLink } from "./ReviewEvidence";
import Icon from "./Icon";
import styles from "./ReviewWorkspace.module.css";

export function usePlanExport() {
  const [notice, setNotice] = useState("");
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const invalidate = () => {
    version.current++;
    setNotice("");
  };
  const copy = async (text: string, message: string) => {
    const current = ++version.current;
    try {
      await navigator.clipboard.writeText(text);
      if (current === version.current) setNotice(message);
    } catch {
      if (current === version.current)
        setNotice(
          "Copying is unavailable. Download the plan to keep a text copy.",
        );
    }
  };
  const download = (text: string, filename: string) => {
    version.current++;
    let objectUrl: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      objectUrl = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
      anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice(
        "Download started. Check your browser’s downloads for the complete plan.",
      );
    } catch {
      setNotice("The download could not start. Try copying the plan instead.");
    } finally {
      anchor?.remove();
      if (objectUrl) {
        const pending = objectUrl;
        setTimeout(() => URL.revokeObjectURL(pending), 1000);
      }
    }
  };
  return { notice, copy, download, invalidate };
}

export function ReviewTools({
  children,
  onCopy,
  onDownload,
  downloadLabel,
  downloadText = "Download .txt",
  copyLabel = "Copy plan",
}: {
  children: ReactNode;
  onCopy: () => void;
  onDownload: () => void;
  downloadLabel: string;
  downloadText?: string;
  copyLabel?: string;
}) {
  return (
    <div className={styles.tools}>
      <p>{children}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onCopy}>
          <Icon name="copy" width="15" height="15" />
          {copyLabel}
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label={downloadLabel}
          onClick={onDownload}
        >
          <Icon name="download" width="15" height="15" />
          {downloadText}
        </button>
      </div>
    </div>
  );
}
export function ReviewNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className={styles.notice}>
      <Icon name="info" width="16" height="16" />
      {children}
    </p>
  );
}

export function ReviewSnapshot({
  score,
  label,
  assessed,
  total,
  count,
  scope,
  note,
}: {
  score: number | null;
  label: string;
  assessed: number;
  total: number;
  count: number;
  scope: ReactNode;
  note: string;
}) {
  return (
    <div className={styles.snapshot} aria-label="Review snapshot">
      <div className={styles.metric}>
        <span className={styles.metricLabel}>{label}</span>
        <div className={styles.metricValue} data-missing={score === null}>
          {score === null ? (
            "Not assessed"
          ) : (
            <>
              {score}
              <small>/100</small>
            </>
          )}
        </div>
        {score !== null && (
          <div
            className={styles.scoreTrack}
            role="meter"
            aria-label={label}
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${score}%` }} />
          </div>
        )}
        <span className={styles.metricNote}>
          {assessed} of {total} areas assessed · qualitative
        </span>
      </div>
      <div className={styles.metric}>
        <span className={styles.metricLabel}>Supported findings</span>
        <strong className={styles.metricValue}>{count}</strong>
        <span className={styles.metricNote}>From the full section review</span>
      </div>
      <div className={styles.metric}>
        <span className={styles.metricLabel}>Collection scope</span>
        <strong style={{ fontSize: 16, fontWeight: 550, lineHeight: 1.6 }}>
          {scope}
        </strong>
        <span className={styles.metricNote}>{note}</span>
      </div>
    </div>
  );
}

export function ReviewAssessments({
  rubrics,
  criteria,
  summary,
  summaryEvidence,
  evidence,
  unavailableReason,
  children,
}: {
  rubrics: readonly { key: string; label: string; weight: number }[];
  criteria: ReviewCriterion[];
  summary?: string;
  summaryEvidence?: ReactNode;
  evidence: (key: string) => ReactNode;
  unavailableReason?: (key: string) => string | undefined;
  children: ReactNode;
}) {
  return (
    <aside className={styles.rail} aria-label="Category assessment">
      <section className={styles.railPanel}>
        <h3>Assessment breakdown</h3>
        <p>Qualitative review of collected content.</p>
        <div className={styles.criteria}>
          {rubrics.map((rubric) => {
            const item = criteria.find((item) => item.key === rubric.key);
            return (
              <details className={styles.criterion} key={rubric.key}>
                <summary>
                  <span>{rubric.label}</span>
                  <span>
                    {item?.score == null ? "Not assessed" : `${item.score}/100`}
                    <Icon name="down" width="13" height="13" />
                  </span>
                </summary>
                <p>
                  {item?.reason ||
                    unavailableReason?.(rubric.key) ||
                    "No source-backed assessment was available for this area."}
                </p>
                <p>{rubric.weight}% of the fully assessed category score.</p>
                {evidence(rubric.key)}
              </details>
            );
          })}
        </div>
        <details className={styles.method}>
          <summary>How this score was assessed</summary>
          {children}
        </details>
      </section>
      {summary && (
        <section className={styles.railPanel}>
          <h3>Review summary</h3>
          <p>{summary}</p>
          {summaryEvidence && (
            <details className={styles.method}>
              <summary>Sources for this summary</summary>
              {summaryEvidence}
            </details>
          )}
        </section>
      )}
    </aside>
  );
}

export function ReviewFixSteps({
  issue,
  url,
  generated,
  onLoaded,
  headingLevel = 5,
  generationKey,
  title = "Suggested next steps",
}: {
  issue: Issue;
  url: string;
  generated: Record<string, FixStep[]>;
  onLoaded: (key: string, steps: FixStep[]) => void;
  headingLevel?: 4 | 5;
  generationKey?: string;
  title?: string;
}) {
  const Heading = headingLevel === 4 ? "h4" : "h5";
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const [local, setLocal] = useState<FixStep[]>([]);
  useEffect(() => () => request.current?.abort(), []);
  const retained = generationKey
    ? (generated[generationKey] ??
      generated[issue.title] ??
      issue.fixSteps ??
      [])
    : issueSteps(issue, generated);
  const steps = retained.length ? retained : local;
  const generate = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/fix-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: issue.pageUrl || url,
          issueTitle: issue.title,
          issueDetail: issue.detail,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45_000),
        ]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The action plan could not be generated. Please retry.",
        );
      if (
        !Array.isArray(data.steps) ||
        !data.steps.length ||
        !data.steps.every(
          (step: FixStep) =>
            typeof step?.title === "string" &&
            typeof step?.description === "string",
        )
      )
        throw new Error("No usable steps were returned. Please retry.");
      if (controller.signal.aborted) return;
      setLocal(data.steps);
      onLoaded(generationKey ?? reviewIssueKey(issue), data.steps);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error && failure.name === "TimeoutError"
            ? "Preparing the steps took too long. Please retry."
            : failure instanceof Error
              ? failure.message
              : "The action plan could not be generated. Please retry.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <section>
      <Heading className={styles.detailHeading}>
        <Icon name="bolt" width="15" height="15" />
        {title}
      </Heading>
      {steps.length ? (
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={`${step.title}|${index}`}>
              <div>
                <h5>{step.title}</h5>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <button
            type="button"
            className={styles.button}
            disabled={loading}
            onClick={() => void generate()}
          >
            <Icon name={loading ? "loader" : "bolt"} width="15" height="15" />
            {loading
              ? "Preparing your plan…"
              : error
                ? "Retry action plan"
                : "Generate action plan"}
          </button>
          <p className={styles.metricNote} style={{ marginTop: 8 }}>
            Generate steps for this finding only. Your recorded assessment stays
            unchanged.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className={styles.notice} style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </section>
  );
}

export function ReviewFindings({
  issues,
  rubrics,
  areaOf,
  areaLabel,
  evidence,
  extra,
  url,
  generated,
  onLoaded,
  emptyTitle,
  emptyDetail,
  wordingFilter = false,
}: {
  issues: Issue[];
  rubrics: readonly { key: string; label: string }[];
  areaOf: (issue: Issue) => string | undefined;
  areaLabel: string;
  evidence: (issue: Issue) => ReactNode;
  extra?: (issue: Issue, key: string) => ReactNode;
  url: string;
  generated: Record<string, FixStep[]>;
  onLoaded: (key: string, steps: FixStep[]) => void;
  emptyTitle: string;
  emptyDetail: string;
  wordingFilter?: boolean;
}) {
  const records = reviewIssues(issues);
  const [priority, setPriority] = useState("all"),
    [area, setArea] = useState("all"),
    [rewrites, setRewrites] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(records[0] ? [records[0].key] : []),
  );
  const [showAll, setShowAll] = useState(false);
  const prefix = useId();
  const matching = records.filter(
    ({ issue }) =>
      (priority === "all" || issue.priority === priority) &&
      (area === "all" || areaOf(issue) === area) &&
      (!rewrites || issue.copySuggestion),
  );
  const visible = showAll ? matching : matching.slice(0, 5);
  const reset = () => {
    setPriority("all");
    setArea("all");
    setRewrites(false);
    setShowAll(false);
  };
  const filtered = priority !== "all" || area !== "all" || rewrites;
  return (
    <section className={styles.listArea} aria-label="Supported findings">
      <div className={styles.sectionHeading}>
        <div>
          <h3>
            Supported findings <span>{issues.length}</span>
          </h3>
          <p>Open a finding to inspect the evidence and plan your change.</p>
        </div>
      </div>
      {!!issues.length && (
        <>
          <div className={styles.toolbar}>
            <div
              className={styles.filters}
              role="group"
              aria-label="Filter findings by priority"
            >
              {["all", "High", "Medium", "Low"].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={priority === value}
                  onClick={() => {
                    setPriority(value);
                    setShowAll(false);
                  }}
                >
                  {value === "all" ? "All" : value}
                  <span>
                    {value === "all"
                      ? issues.length
                      : issues.filter((issue) => issue.priority === value)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <label className={styles.selectLabel}>
              Focus area
              <select
                aria-label={areaLabel}
                value={area}
                onChange={(event) => {
                  setArea(event.target.value);
                  setShowAll(false);
                }}
              >
                <option value="all">All areas</option>
                {rubrics
                  .filter((rubric) =>
                    issues.some((issue) => areaOf(issue) === rubric.key),
                  )
                  .map((rubric) => (
                    <option key={rubric.key} value={rubric.key}>
                      {rubric.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {wordingFilter && (
            <div className={styles.filterOptions}>
              <button
                type="button"
                className={styles.button}
                aria-pressed={rewrites}
                onClick={() => {
                  setRewrites(!rewrites);
                  setShowAll(false);
                }}
              >
                With wording options{" "}
                <span>
                  {issues.filter((issue) => issue.copySuggestion).length}
                </span>
              </button>
            </div>
          )}
          <div className={styles.resultCount}>
            <span role="status">
              {matching.length} of {issues.length}{" "}
              {wordingFilter ? "improvements" : "findings"} match
              {filtered ? " these filters" : " the full review"}
              {visible.length < matching.length
                ? ` · first ${visible.length} shown`
                : ""}
            </span>
            {filtered && (
              <button
                type="button"
                className={styles.textButton}
                onClick={reset}
              >
                Reset filters
              </button>
            )}
          </div>
        </>
      )}
      <div className={styles.findings} id={`${prefix}-findings`}>
        {visible.map(({ issue, key }) => {
          const open = expanded.has(key),
            id = `${prefix}-${encodeURIComponent(key)}`;
          return (
            <article
              className={styles.finding}
              key={key}
              data-open={open}
              data-finding-key={key}
            >
              <div className={styles.findingTop}>
                <div className={styles.findingMeta}>
                  <span
                    className={styles.priority}
                    data-priority={issue.priority}
                  >
                    {issue.priority} priority
                  </span>
                  <span>
                    {rubrics.find((rubric) => rubric.key === areaOf(issue))
                      ?.label || "Page review"}
                  </span>
                  {records[0]?.key === key && (
                    <span className={styles.recommended}>
                      <Icon name="sparkle" width="13" height="13" />
                      Recommended starting point
                    </span>
                  )}
                </div>
                <h4>{issue.title}</h4>
                <p className={styles.findingDescription}>{issue.detail}</p>
                <div className={styles.findingFooter}>
                  <ReviewSourceLink url={issue.pageUrl} />
                  <button
                    type="button"
                    className={styles.button}
                    aria-label={`${open ? "Hide" : "View"} details: ${issue.title}`}
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() =>
                      setExpanded((previous) => {
                        const next = new Set(previous);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                  >
                    {open ? "Hide details" : "View details"}
                    <Icon name="down" width="13" height="13" />
                  </button>
                </div>
              </div>
              <div className={styles.findingDetails} id={id} hidden={!open}>
                <section>
                  <h5 className={styles.detailHeading}>
                    <Icon name="file" width="15" height="15" />
                    What we found
                  </h5>
                  {evidence(issue)}
                </section>
                <ReviewFixSteps
                  issue={issue}
                  url={url}
                  generated={generated}
                  onLoaded={onLoaded}
                />
                {extra?.(issue, key)}
              </div>
            </article>
          );
        })}
      </div>
      {!issues.length && (
        <div className={styles.empty}>
          <h4>{emptyTitle}</h4>
          <p>{emptyDetail}</p>
        </div>
      )}
      {!!issues.length && !matching.length && (
        <div className={styles.empty}>
          <h4>
            {wordingFilter
              ? "No improvements match these filters."
              : "No findings match these filters."}
          </h4>
          <p>
            The full review is unchanged. Reset the filters to see all supported
            findings.
          </p>
          <button type="button" className={styles.button} onClick={reset}>
            {wordingFilter ? "Show all improvements" : "Show all findings"}
          </button>
        </div>
      )}
      {matching.length > 5 && (
        <button
          type="button"
          className={`${styles.button} ${styles.showMore}`}
          aria-expanded={showAll}
          aria-controls={`${prefix}-findings`}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Show fewer findings"
            : `Show all ${matching.length} findings`}
        </button>
      )}
    </section>
  );
}

export function ReviewInspector({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.inspector}>
      <summary>
        <span>
          {title}
          <small>{description}</small>
        </span>
        <Icon name="down" width="17" height="17" />
      </summary>
      <div className={styles.inspectorBody}>{children}</div>
    </details>
  );
}

export function PlainFindingEvidence({ issue }: { issue: Issue }) {
  return (
    <ReviewEvidence
      copy={issue.messagingEvidence || issue.supportingEvidence}
      seo={issue.seoEvidence}
      conversion={issue.conversionEvidence}
      ux={issue.uxEvidence}
      plain={issue.evidence}
      pageUrl={issue.pageUrl}
      observation={!!issue.evidenceType}
    />
  );
}
