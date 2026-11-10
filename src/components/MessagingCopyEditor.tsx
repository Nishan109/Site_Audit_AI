"use client";
import { useId, useState, type RefObject, type ReactNode } from "react";
import type { CopySource, CopySuggestion } from "@/lib/messaging";
import { ReviewSourceLink } from "./ReviewEvidence";
import Icon from "./Icon";
import styles from "./MessagingSection.module.css";

export default function MessagingCopyEditor({
  suggestion,
  title,
  value,
  sources,
  pageUrl,
  inputRef,
  onChange,
  onCopy,
  children,
}: {
  suggestion: CopySuggestion;
  title: string;
  value: string;
  sources: CopySource[];
  pageUrl?: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onCopy: () => void;
  children?: ReactNode;
}) {
  const id = useId(),
    [fullOriginal, setFullOriginal] = useState(false);
  const edited = value !== suggestion.replacement;
  const originalSource = sources.find(
    (source) => source.quote === suggestion.original,
  );
  const sourceUrl = originalSource?.pageUrl || pageUrl;
  const long = suggestion.original.length > 220;
  return (
    <section
      className={styles.comparison}
      aria-label={`Wording option for ${title}`}
    >
      <div className={styles.comparisonHeading}>
        <span>
          <Icon name="pen" width="15" height="15" />
          Compare the wording
        </span>
        <span className={styles.draftStatus}>
          {edited ? "Edited by you" : "AI wording option"}
        </span>
      </div>
      <div className={styles.copyColumns}>
        <div className={styles.copyColumn}>
          <p className={styles.copyLabel}>Current copy</p>
          <blockquote
            id={`${id}-original`}
            className={`${styles.original} ${long && !fullOriginal ? styles.originalClamped : ""}`}
          >
            {suggestion.original}
          </blockquote>
          {long && (
            <button
              type="button"
              className={styles.textButton}
              aria-expanded={fullOriginal}
              aria-controls={`${id}-original`}
              onClick={() => setFullOriginal(!fullOriginal)}
            >
              {fullOriginal
                ? "Show less current copy"
                : "Read full current copy"}
            </button>
          )}
          <div className={styles.sourceMeta}>
            {originalSource && (
              <span>
                {originalSource.kind} ·{" "}
                {originalSource.region === "main"
                  ? "Main content"
                  : originalSource.region}
              </span>
            )}
            <ReviewSourceLink url={sourceUrl} />
          </div>
        </div>
        <div className={styles.copyColumn}>
          <label className={styles.copyLabel} htmlFor={`${id}-draft`}>
            Your draft<span>{value.length}/2400</span>
          </label>
          <textarea
            id={`${id}-draft`}
            ref={inputRef}
            aria-label={`Wording draft for ${title}`}
            aria-describedby={`${id}-help`}
            value={value}
            rows={5}
            maxLength={2400}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      <div className={styles.draftActions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!value.trim()}
          onClick={onCopy}
        >
          <Icon name="copy" width="15" height="15" />
          Copy wording
        </button>
        {edited && (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => onChange(suggestion.replacement)}
          >
            Restore suggestion
          </button>
        )}
        <p className={styles.draftHelp} id={`${id}-help`}>
          {edited
            ? "Your changes have not been reviewed by AI. Check claims and context before publishing."
            : "A wording option based on collected facts; review it in context."}{" "}
          Editing does not change the audit score; copying does not publish
          changes. <strong>Drafts last for this report session.</strong>{" "}
          Download the plan to keep them.
        </p>
      </div>
      {children}
    </section>
  );
}
