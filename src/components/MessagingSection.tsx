"use client";
import { useId, useRef, useState } from "react";
import type { Issue, FixStep } from "@/lib/types";
import {
  MESSAGING_CRITERIA,
  messagingScore,
  type MessagingAnalysis,
} from "@/lib/messaging";
import { copySources, messagingPlan } from "@/lib/messaging-presentation";
import { reviewedCriteria, reviewIssues } from "@/lib/review-workspace";
import ReviewEvidence, { ReviewSourceLink } from "./ReviewEvidence";
import {
  ReviewAssessments,
  ReviewFixSteps,
  ReviewNotice,
  usePlanExport,
} from "./ReviewWorkspace";
import MessagingCopyEditor from "./MessagingCopyEditor";
import Icon from "./Icon";
import styles from "./MessagingSection.module.css";

interface Props {
  analysis?: MessagingAnalysis;
  issues: Issue[];
  url: string;
  collectedPages?: string[];
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (key: string, steps: FixStep[]) => void;
}
interface ViewState {
  priority: "all" | Issue["priority"];
  area: "all" | string;
  wordingOnly: boolean;
  selected: string;
  showAll: boolean;
}
type RecordItem = ReturnType<typeof reviewIssues>[number];
function matchingRecords(records: RecordItem[], view: ViewState) {
  return records.filter(
    ({ issue }) =>
      (view.priority === "all" || issue.priority === view.priority) &&
      (view.area === "all" || issue.messagingCriterion === view.area) &&
      (!view.wordingOnly || !!issue.copySuggestion),
  );
}
function pageLabel(value?: string) {
  if (!value) return "Source not recorded";
  try {
    const target = new URL(value);
    return `${target.hostname}${target.pathname === "/" ? "" : target.pathname}`;
  } catch {
    return "Source not recorded";
  }
}
export default function MessagingSection({
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
    wordingOnly: false,
    selected: records[0]?.key || "",
    showAll: false,
  }));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedbackScope, setFeedbackScope] = useState("");
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(
    () => new Set(),
  );
  const exporter = usePlanExport();
  const prefix = useId(),
    panelId = `${prefix}-active`,
    headingId = `${prefix}-title`;
  const draftInput = useRef<HTMLTextAreaElement>(null),
    queueRefs = useRef(new Map<string, HTMLButtonElement>());
  const assessmentDetails = useRef<HTMLDetailsElement>(null);
  const criteria = reviewedCriteria(
      analysis?.method === "copy-evidence-review-v1" ? analysis.criteria : [],
      collectedPages,
      messagingScore,
    ),
    score = messagingScore(criteria);
  const matching = matchingRecords(records, view),
    active =
      matching.find((record) => record.key === view.selected) || matching[0];
  const showingAll =
    view.showAll ||
    matching.findIndex((record) => record.key === active?.key) >= 5;
  const visible = showingAll ? matching : matching.slice(0, 5);
  const wordingCount = issues.filter((issue) => issue.copySuggestion).length;
  const scopeCount = collectedPages?.length ?? analysis?.scope.pages;
  const scopeKnown =
    typeof scopeCount === "number" &&
    Number.isInteger(scopeCount) &&
    scopeCount >= 0;
  const filtered =
    view.priority !== "all" || view.area !== "all" || view.wordingOnly;
  const plan = () =>
    messagingPlan(
      analysis,
      issues,
      url,
      drafts,
      generatedFixSteps,
      collectedPages,
    );
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
  const filter = (
    patch: Partial<Pick<ViewState, "priority" | "area" | "wordingOnly">>,
  ) => {
    exporter.invalidate();
    setView((previous) => {
      const currentMatches = matchingRecords(records, previous),
        current =
          currentMatches.find((record) => record.key === previous.selected) ||
          currentMatches[0];
      const next = { ...previous, ...patch, showAll: false };
      const nextMatches = matchingRecords(records, next);
      return {
        ...next,
        selected:
          nextMatches.find((record) => record.key === current?.key)?.key ||
          nextMatches[0]?.key ||
          "",
      };
    });
  };
  const reset = () =>
    filter({ priority: "all", area: "all", wordingOnly: false });
  const edit = (key: string, value: string) => {
    exporter.invalidate();
    setDrafts((previous) => ({ ...previous, [key]: value }));
  };
  const copyPlan = () => {
    setFeedbackScope("plan");
    void exporter.copy(
      plan(),
      "Copy plan copied. It includes all findings, sources and current drafts.",
    );
  };
  const download = () => {
    setFeedbackScope("plan");
    exporter.download(plan(), `${new URL(url).hostname}-messaging-plan.txt`);
  };
  const sources = active ? copySources(active.issue) : [];
  const draft = active
    ? (drafts[active.key] ?? active.issue.copySuggestion?.replacement ?? "")
    : "";
  return (
    <div className={styles.workspace} data-review-workspace="messaging">
      <div className={styles.toolbar}>
        <p className={styles.intro}>
          Choose a finding, compare the wording, and refine your next draft.
        </p>
        <div className={styles.exportActions}>
          <button type="button" className={styles.button} onClick={copyPlan}>
            <Icon name="copy" width="15" height="15" />
            Copy full plan
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={download}
            aria-label="Download messaging plan"
          >
            <Icon name="download" width="15" height="15" />
            Download .txt
          </button>
        </div>
      </div>
      {feedbackScope === "plan" && exporter.notice && (
        <ReviewNotice>{exporter.notice}</ReviewNotice>
      )}
      {!analysis && (
        <ReviewNotice>
          This report contains an earlier copy review. Run a new audit for the
          source-backed score breakdown and updated verification.
        </ReviewNotice>
      )}
      <section
        className={styles.snapshot}
        aria-label="Messaging review snapshot"
      >
        <div className={styles.assessment}>
          <Icon name="message" width="19" height="19" />
          <div className={styles.assessmentText}>
            <div className={styles.scoreLine}>
              <strong
                data-missing={score === null}
                role={score === null ? undefined : "meter"}
                aria-label="Messaging and copy assessment"
                aria-valuenow={score ?? undefined}
                aria-valuemin={score === null ? undefined : 0}
                aria-valuemax={score === null ? undefined : 100}
              >
                {score === null ? (
                  "Not assessed"
                ) : (
                  <>
                    {score}
                    <small>/100</small>
                  </>
                )}
              </strong>
              <span>Qualitative assessment</span>
            </div>
            <span>
              {criteria.length} of {MESSAGING_CRITERIA.length} areas assessed
            </span>
          </div>
        </div>
        <dl>
          <div>
            <dt>
              {issues.length === 1 ? "supported finding" : "supported findings"}
            </dt>
            <dd>{issues.length}</dd>
          </div>
          <div>
            <dt>{wordingCount === 1 ? "wording option" : "wording options"}</dt>
            <dd>{wordingCount}</dd>
          </div>
        </dl>
        <span className={styles.scope}>
          <Icon name="file" width="14" height="14" />
          {scopeKnown
            ? `${scopeCount} ${scopeCount === 1 ? "page" : "pages"} reviewed`
            : "Scope not recorded"}
        </span>
      </section>
      <div className={styles.workbench}>
        {!!issues.length && (
          <section
            className={styles.queue}
            aria-label="Messaging finding queue"
          >
            <div className={styles.queueHeading}>
              <h3>Copy findings</h3>
              <span>
                {matching.length} of {issues.length}
              </span>
            </div>
            <label className={styles.mobilePicker}>
              Choose a finding
              <select
                aria-label="Choose a messaging finding"
                disabled={!matching.length}
                value={active?.key || ""}
                onChange={(event) => select(event.target.value)}
              >
                {!matching.length && (
                  <option value="">No matching findings</option>
                )}
                {matching.map(({ issue, key }) => (
                  <option value={key} key={key}>
                    {issue.priority} · {issue.title}
                  </option>
                ))}
              </select>
            </label>
            <div
              className={styles.priorities}
              role="group"
              aria-label="Filter copy findings by priority"
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
            <details className={styles.moreFilters}>
              <summary>
                <span>
                  More filters
                  {view.area !== "all" || view.wordingOnly
                    ? ` · ${Number(view.area !== "all") + Number(view.wordingOnly)} active`
                    : ""}
                </span>
                <Icon name="down" width="13" height="13" />
              </summary>
              <div className={styles.filterFields}>
                <label>
                  Focus area
                  <select
                    aria-label="Copy improvement focus area"
                    value={view.area}
                    onChange={(event) => filter({ area: event.target.value })}
                  >
                    <option value="all">All areas</option>
                    {MESSAGING_CRITERIA.filter((rubric) =>
                      issues.some(
                        (issue) => issue.messagingCriterion === rubric.key,
                      ),
                    ).map((rubric) => (
                      <option key={rubric.key} value={rubric.key}>
                        {rubric.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.wordingToggle}
                  aria-pressed={view.wordingOnly}
                  onClick={() => filter({ wordingOnly: !view.wordingOnly })}
                >
                  <Icon name="pen" width="13" height="13" />
                  With wording options <span>{wordingCount}</span>
                </button>
              </div>
            </details>
            <div className={styles.filterContext}>
              <span>
                {matching.length} of {issues.length} findings
                {filtered ? " match these filters" : " in this review"}
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
            <div
              className={styles.queueList}
              role="group"
              aria-label="Select a copy finding"
              id={`${prefix}-queue`}
            >
              {visible.map(({ issue, key }) => {
                const rank = records.findIndex((record) => record.key === key);
                const edited =
                  !!issue.copySuggestion &&
                  drafts[key] !== undefined &&
                  drafts[key] !== issue.copySuggestion.replacement;
                return (
                  <button
                    type="button"
                    key={key}
                    ref={(node) => {
                      if (node) queueRefs.current.set(key, node);
                      else queueRefs.current.delete(key);
                    }}
                    className={styles.queueButton}
                    aria-label={`Select finding ${rank + 1}: ${issue.title}`}
                    aria-pressed={active?.key === key}
                    aria-controls={panelId}
                    data-finding-key={key}
                    onClick={() => select(key)}
                  >
                    <span className={styles.queueMeta}>
                      <span
                        className={styles.priority}
                        data-priority={issue.priority}
                      >
                        {issue.priority} priority
                      </span>
                      {edited && (
                        <span className={styles.optionAvailable}>
                          Edited draft
                        </span>
                      )}
                    </span>
                    <strong>{issue.title}</strong>
                    <span className={styles.queueArea}>
                      {MESSAGING_CRITERIA.find(
                        (rubric) => rubric.key === issue.messagingCriterion,
                      )?.label || "Copy clarity"}
                    </span>
                    {issue.copySuggestion && (
                      <span className={styles.optionAvailable}>
                        <Icon name="pen" width="12" height="12" />
                        Wording option available
                      </span>
                    )}
                    <span className={styles.queuePage}>
                      {pageLabel(issue.pageUrl)}
                    </span>
                  </button>
                );
              })}
            </div>
            {matching.length > 5 && !showingAll && (
              <button
                type="button"
                className={`${styles.button} ${styles.showAll}`}
                aria-controls={`${prefix}-queue`}
                onClick={() => {
                  const firstNew = matching[5]?.key;
                  setView((previous) => ({ ...previous, showAll: true }));
                  window.requestAnimationFrame(() => {
                    if (firstNew) queueRefs.current.get(firstNew)?.focus();
                  });
                }}
              >
                Show all {matching.length} findings
              </button>
            )}
          </section>
        )}
        {active ? (
          <article
            key={active.key}
            id={panelId}
            className={styles.active}
            aria-labelledby={headingId}
            data-active-finding={active.key}
          >
            <div className={styles.activeHeading}>
              <div className={styles.activeMeta}>
                <span
                  className={styles.priority}
                  data-priority={active.issue.priority}
                >
                  {active.issue.priority} priority
                </span>
                <span>
                  {MESSAGING_CRITERIA.find(
                    (rubric) => rubric.key === active.issue.messagingCriterion,
                  )?.label || "Copy clarity"}
                </span>
                <span className={styles.position}>
                  Finding{" "}
                  {matching.findIndex((record) => record.key === active.key) +
                    1}{" "}
                  of {matching.length}
                  {filtered ? " matching" : ""}
                </span>
              </div>
              <div className={styles.titleRow}>
                <h3 id={headingId}>{active.issue.title}</h3>
                {active.issue.copySuggestion && (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.editAction}`}
                    onClick={() => draftInput.current?.focus()}
                  >
                    <Icon name="pen" width="14" height="14" />
                    Edit draft
                  </button>
                )}
              </div>
              <p
                id={`${prefix}-explanation`}
                className={`${styles.explanation} ${active.issue.detail.length > 280 && !expandedExplanations.has(active.key) ? styles.clamped : ""}`}
              >
                {active.issue.detail}
              </p>
              {active.issue.detail.length > 280 && (
                <button
                  type="button"
                  className={styles.textButton}
                  aria-controls={`${prefix}-explanation`}
                  aria-expanded={expandedExplanations.has(active.key)}
                  onClick={() =>
                    setExpandedExplanations((previous) => {
                      const next = new Set(previous);
                      if (next.has(active.key)) next.delete(active.key);
                      else next.add(active.key);
                      return next;
                    })
                  }
                >
                  {expandedExplanations.has(active.key)
                    ? "Show less explanation"
                    : "Read full explanation"}
                </button>
              )}
            </div>
            <div className={styles.activeBody}>
              {active.issue.copySuggestion ? (
                <MessagingCopyEditor
                  key={active.key}
                  title={active.issue.title}
                  suggestion={active.issue.copySuggestion}
                  value={draft}
                  sources={sources}
                  pageUrl={active.issue.pageUrl}
                  inputRef={draftInput}
                  onChange={(value) => edit(active.key, value)}
                  onCopy={() => {
                    setFeedbackScope(active.key);
                    void exporter.copy(
                      draft,
                      draft !== active.issue.copySuggestion!.replacement
                        ? "Your edited wording copied. These edits have not been reviewed by AI."
                        : "Suggested wording copied. Review it in context before publishing.",
                    );
                  }}
                >
                  {feedbackScope === active.key && exporter.notice && (
                    <ReviewNotice>{exporter.notice}</ReviewNotice>
                  )}
                </MessagingCopyEditor>
              ) : (
                <>
                  <div className={styles.noDraft}>
                    <strong>
                      No wording draft was included in this review.
                    </strong>
                    Use the collected context and implementation steps to plan a
                    revision. No replacement has been invented.
                  </div>
                  <ReviewEvidence
                    copy={sources}
                    plain={active.issue.evidence}
                    pageUrl={active.issue.pageUrl}
                  />
                </>
              )}
              {active.issue.copySuggestion && (
                <details className={styles.evidenceDetails}>
                  <summary>
                    <span>
                      <Icon name="link" width="15" height="15" />
                      Supporting facts for this draft
                    </span>
                    <Icon name="down" width="14" height="14" />
                  </summary>
                  <div className={styles.detailsBody}>
                    <p className={styles.evidenceNote}>
                      The collected wording used to support the AI option. User
                      edits have not been re-reviewed.
                    </p>
                    <ReviewEvidence
                      copy={active.issue.copySuggestion.sources}
                    />
                  </div>
                </details>
              )}
              {active.issue.copySuggestion && (
                <details className={styles.evidenceDetails}>
                  <summary>
                    <span>
                      <Icon name="file" width="15" height="15" />
                      View source context
                    </span>
                    <Icon name="down" width="14" height="14" />
                  </summary>
                  <div className={styles.detailsBody}>
                    <p className={styles.evidenceNote}>
                      The retained source copy behind this finding.
                    </p>
                    <ReviewEvidence
                      copy={sources}
                      plain={active.issue.evidence}
                      pageUrl={active.issue.pageUrl}
                    />
                  </div>
                </details>
              )}
              <details
                className={styles.stepsDetails}
                open={!active.issue.copySuggestion}
              >
                <summary>
                  <span>
                    <Icon name="bolt" width="15" height="15" />
                    Implementation steps
                  </span>
                  <Icon name="down" width="14" height="14" />
                </summary>
                <div className={styles.detailsBody}>
                  <ReviewFixSteps
                    key={active.key}
                    issue={active.issue}
                    url={url}
                    generated={generatedFixSteps}
                    onLoaded={onFixStepsLoaded}
                    headingLevel={4}
                    generationKey={active.key}
                  />
                </div>
              </details>
            </div>
          </article>
        ) : (
          <div className={styles.empty} id={panelId}>
            {issues.length ? (
              <>
                <h3>No improvements match these filters.</h3>
                <p>
                  Your drafts and full report are unchanged. Reset the filters
                  to choose a supported finding.
                </p>
                <button type="button" className={styles.button} onClick={reset}>
                  Show all improvements
                </button>
              </>
            ) : (
              <>
                <h3>No supported copy fixes to prioritize in this sample.</h3>
                <p>
                  Review the assessment details, strengths and collection scope
                  below. Visitor understanding and performance still need
                  testing.
                </p>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => {
                    if (!assessmentDetails.current) return;
                    assessmentDetails.current.open = true;
                    assessmentDetails.current.querySelector("summary")?.focus();
                  }}
                >
                  Review assessment & scope
                  <Icon name="down" width="14" height="14" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p className={styles.srOnly} role="status">
        {active
          ? `Selected finding: ${active.issue.title}. ${matching.length} of ${issues.length} findings available.`
          : issues.length
            ? "No findings match the current filters."
            : "No supported copy findings in this sample."}
      </p>
      <div className={styles.secondary}>
        <details id={`${prefix}-assessment`} ref={assessmentDetails}>
          <summary>
            <span>Assessment details</span>
            <Icon name="down" width="15" height="15" />
          </summary>
          <div className={styles.assessmentContent}>
            {analysis && (
              <p>
                {analysis.scope.blocks} copy blocks reviewed across{" "}
                {analysis.scope.pages}{" "}
                {analysis.scope.pages === 1 ? "page" : "pages"}. The assessment
                describes recorded wording.
              </p>
            )}
            <ReviewAssessments
              rubrics={MESSAGING_CRITERIA}
              criteria={criteria}
              summary={analysis?.summary}
              summaryEvidence={
                analysis && <ReviewEvidence copy={analysis.summarySources} />
              }
              evidence={(key) => {
                const criterion = criteria.find((item) => item.key === key);
                return criterion ? (
                  <ReviewEvidence copy={criterion.sources} />
                ) : null;
              }}
            >
              <p>
                The score combines purpose and message clarity (35%), audience
                and next-step clarity (25%), specific supportable language
                (25%), and consistency and readability (15%). Available areas
                are weighted proportionally; missing, invalid or uncited
                assessments are excluded.
              </p>
              <p>
                Scores describe collected wording, not measured visitor
                understanding or conversions. Editing a draft does not
                recalculate the recorded score.
              </p>
            </ReviewAssessments>
          </div>
        </details>
        {!!analysis?.strengths.length && (
          <details>
            <summary>
              <span>What’s already working</span>
              <Icon name="down" width="15" height="15" />
            </summary>
            <div className={styles.secondaryContent}>
              <p>Preserve these source-backed strengths as you revise.</p>
              <ul className={styles.strengths}>
                {analysis.strengths.map((strength, index) => (
                  <li key={index}>
                    {strength.text}
                    <details>
                      <summary>View supporting copy</summary>
                      <ReviewEvidence copy={[strength.source]} />
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
        <details>
          <summary>
            <span>Review scope & publishing checklist</span>
            <Icon name="down" width="15" height="15" />
          </summary>
          <div className={styles.secondaryContent}>
            <p>
              Drafts stay in this report while you switch sections. A new audit
              or reload clears them. Download the copy plan to keep your edits.
            </p>
            <p>
              {analysis?.verification.withheld
                ? "Draft suggestions that could not be supported were withheld. "
                : ""}
              {analysis?.scope.truncated
                ? "Some copy was shortened or excluded to fit the review. "
                : ""}
              Only collected pages were reviewed; site-wide absence cannot be
              established from this sample. Business claims were checked against
              the collected wording, not independently certified.
            </p>
            <ul>
              <li>Keep names, offers, credentials and numbers accurate.</li>
              <li>
                Read the headline with its supporting sentence and next step on
                the actual page.
              </li>
              <li>
                Ask intended readers what they understand; this audit does not
                replace user testing.
              </li>
            </ul>
            <ReviewSourceLink url={url} label="Open your website" />
          </div>
        </details>
      </div>
    </div>
  );
}
