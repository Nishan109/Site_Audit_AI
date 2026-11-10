"use client";
import { useId, useState } from "react";
import type { Issue, FixStep } from "@/lib/types";
import Icon from "./Icon";
import { SuggestedCopy } from "./MessagingReview";
import { HTMLObservations } from "./UXEvidence";
import { SEOObservations } from "./SEOEvidence";
import { ConversionObservations } from "./ConversionEvidence";
import { AIVisibilityObservations } from "./AIVisibilityEvidence";
interface Props {
  issue: Issue;
  url: string;
  index: number;
  fixSteps?: FixStep[];
  onFixStepsLoaded?: (steps: FixStep[]) => void;
}
export default function IssueCard({
  issue,
  url,
  index,
  fixSteps,
  onFixStepsLoaded,
}: Props) {
  const [loading, setLoading] = useState(false),
    [expanded, setExpanded] = useState(false),
    [error, setError] = useState("");
  const panelId = useId();
  const steps = fixSteps || issue.fixSteps;
  const toggle = async () => {
    if (steps?.length) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/fix-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          issueTitle: issue.title,
          issueDetail: issue.detail,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ||
            "The action plan couldn’t be generated. Please try again.",
        );
      onFixStepsLoaded?.(data.steps || []);
      setExpanded(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <article className="issue-card" id={`issue-card-${index}`}>
      <div className="issue-topline">
        <span
          className={`priority-badge priority-${issue.priority.toLowerCase()}`}
        >
          <i />
          {issue.priority} priority
        </span>
        <span className="issue-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3>{issue.title}</h3>
      <p className="issue-description">{issue.detail}</p>
      {issue.evidence && (
        <details className="issue-evidence">
          <summary>
            <Icon name="link" width="14" height="14" />
            {issue.evidenceType === "ai-observation"
              ? "View AI content evidence"
              : issue.evidenceType === "conversion-observation"
              ? "View conversion evidence"
              : issue.evidenceType === "seo-observation"
              ? "View SEO evidence"
              : issue.evidenceType === "html-observation"
                ? "View HTML evidence"
                : "View page evidence"}
            <Icon name="down" width="13" height="13" />
          </summary>
          {issue.evidenceType === "ai-observation" && issue.aiEvidence ? (
            <AIVisibilityObservations sources={issue.aiEvidence} />
          ) : issue.evidenceType === "conversion-observation" && issue.conversionEvidence ? (
            <ConversionObservations sources={issue.conversionEvidence} />
          ) : issue.evidenceType === "seo-observation" && issue.seoEvidence ? (
            <SEOObservations sources={issue.seoEvidence} />
          ) : issue.evidenceType === "html-observation" && issue.uxEvidence ? (
            <HTMLObservations sources={issue.uxEvidence} />
          ) : (
            <blockquote>“{issue.evidence}”</blockquote>
          )}
          {issue.supportingEvidence?.map((source) => (
            <div key={source.id}>
              <blockquote>“{source.quote}”</blockquote>
              <a
                href={source.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {new URL(source.pageUrl).hostname}
                {new URL(source.pageUrl).pathname}
                <Icon name="external" width="13" height="13" />
              </a>
            </div>
          ))}
          {issue.pageUrl && (
            <a href={issue.pageUrl} target="_blank" rel="noopener noreferrer">
              {new URL(issue.pageUrl).hostname}
              <Icon name="external" width="13" height="13" />
            </a>
          )}
        </details>
      )}
      {issue.copySuggestion && (
        <SuggestedCopy suggestion={issue.copySuggestion} />
      )}
      <div className="issue-actions">
        <button
          className={`button ${expanded ? "button-secondary" : "button-action"}`}
          onClick={() => void toggle()}
          disabled={loading}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          <Icon
            name={loading ? "loader" : "bolt"}
            width="15"
            height="15"
            className={loading ? "spin" : ""}
          />
          {loading
            ? "Preparing your plan…"
            : expanded
              ? "Hide action plan"
              : steps?.length
                ? "View action plan"
                : "Generate action plan"}
          <Icon name={expanded ? "down" : "arrow"} width="15" height="15" />
        </button>
        {steps?.length && !expanded ? (
          <span className="steps-meta">{steps.length} practical steps</span>
        ) : null}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {expanded && steps?.length ? (
        <div id={panelId} className="action-plan">
          <div className="action-plan-heading">
            <Icon name="bolt" width="16" height="16" />
            <strong>Your implementation plan</strong>
          </div>
          <ol>
            {steps.map((step, index) => (
              <li key={`${index}-${step.title}`}>
                <span>{index + 1}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}
