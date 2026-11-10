import { useId, useRef, type Ref } from "react";
import {
  ACCESSIBILITY_STATUS,
  hasAccessibilityReviewSteps,
  type AccessibilityCheck,
  type AccessibilityReview,
} from "@/lib/accessibility";
import { accessibilityCheckIdentity } from "@/lib/accessibility-presentation";
import { reportTime } from "@/lib/dashboard-evidence";
import { sourceURL } from "@/lib/source-url";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import shared from "./ReviewWorkspace.module.css";
import workbench from "./ConversionSection.module.css";
import styles from "./AccessibilitySection.module.css";

export type AccessibilityPage = AccessibilityReview["pages"][number];
export type CheckFilter = keyof typeof ACCESSIBILITY_STATUS | "all";

export function accessibilityPageLabel(url: string) {
  const page = new URL(url);
  return `${page.host}${page.pathname}${page.search}`;
}

export function AccessibilityPageSource({ page }: { page: AccessibilityPage }) {
  return (
    <div className={styles.source}>
      <ReviewSourceLink url={page.url} label={page.url} />
      <span>
        Page fetched{" "}
        <time dateTime={page.fetchedAt}>{reportTime(page.fetchedAt)}</time>
      </span>
      {page.sampled && (
        <span className={styles.scopeBadge}>Sampled evidence</span>
      )}
    </div>
  );
}

export function AccessibilityObservations({
  rows,
}: {
  rows: AccessibilityCheck["observations"];
}) {
  return (
    <dl className={styles.observations}>
      {rows.map(({ label, value }, index) => (
        <div key={`${label}-${index}`}>
          <dt>{label}</dt>
          <dd>{value === "" ? "(empty value)" : value}</dd>
        </div>
      ))}
    </dl>
  );
}

const filters = [
  "all",
  "review",
  "observed",
  "not-observed",
  "not-assessed",
] as const;

export default function AccessibilityPageChecks({
  headingId,
  headingRef,
  pages,
  page,
  filter,
  openCheck,
  checkFocus,
  onPage,
  onFilter,
  onToggle,
  onTask,
  onRefresh,
  loading,
}: {
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  pages: AccessibilityPage[];
  page: AccessibilityPage;
  filter: CheckFilter;
  openCheck: string;
  checkFocus: Ref<HTMLButtonElement>;
  onPage: (key: string) => void;
  onFilter: (filter: CheckFilter) => void;
  onToggle: (key: string) => void;
  onTask: (check: AccessibilityCheck) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const id = useId();
  const filterSelect = useRef<HTMLSelectElement>(null);
  const checks = page.checks.filter(
    (check) => filter === "all" || check.status === filter,
  );

  return (
    <div className={workbench.workArea}>
      <header className={workbench.heading}>
        <h3 id={headingId} ref={headingRef} tabIndex={-1}>
          Page checks
        </h3>
        <p>Open a check to see what was recorded in the page’s initial HTML.</p>
      </header>
      <div className={workbench.pageBar}>
        <div className={workbench.pageIdentity}>
          <span className={workbench.pageIcon}>
            <Icon name="globe" />
          </span>
          <div>
            <strong>{page.title || "Collected page"}</strong>
            <AccessibilityPageSource page={page} />
          </div>
        </div>
        {pages.length > 1 && (
          <label className={workbench.field}>
            Page to inspect
            <select
              value={sourceURL(page.url) ?? ""}
              onChange={(event) => onPage(event.target.value)}
            >
              {pages.map((item) => (
                <option
                  value={sourceURL(item.url) ?? ""}
                  key={sourceURL(item.url)}
                >
                  {accessibilityPageLabel(item.url)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!page.collected && (
        <div className={styles.scopeNotice}>
          <p>
            Detailed HTML evidence is unavailable for this page. Its checks are
            marked Not assessed.
          </p>
          <button
            type="button"
            className={shared.button}
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh checks
          </button>
        </div>
      )}
      <div className={styles.filterLine}>
        <label className={workbench.field}>
          Check status
          <select
            ref={filterSelect}
            value={filter}
            onChange={(event) => onFilter(event.target.value as CheckFilter)}
          >
            {filters.map((status) => (
              <option key={status} value={status}>
                {status === "all"
                  ? "All statuses"
                  : ACCESSIBILITY_STATUS[status]}{" "}
                (
                {
                  page.checks.filter(
                    (check) => status === "all" || check.status === status,
                  ).length
                }
                )
              </option>
            ))}
          </select>
        </label>
        <p role="status">
          {checks.length} of {page.checks.length} scoped checks shown
        </p>
      </div>
      <div className={styles.checkList} hidden={!checks.length}>
        {checks.map((check) => {
          const key = accessibilityCheckIdentity(check);
          const expanded = openCheck === key;
          const evidenceId = `${id}-${check.key}`;
          return (
            <article className={styles.check} key={key}>
              <h4>
                <button
                  type="button"
                  className={styles.checkToggle}
                  aria-expanded={expanded}
                  aria-controls={evidenceId}
                  ref={expanded ? checkFocus : undefined}
                  onClick={() => onToggle(expanded ? "" : key)}
                >
                  <span>{check.title}</span>
                  <span
                    className={styles.statusBadge}
                    data-status={check.status}
                  >
                    {ACCESSIBILITY_STATUS[check.status]}
                  </span>
                  <Icon name="down" width="15" height="15" />
                </button>
              </h4>
              <p className={styles.checkDetail}>{check.detail}</p>
              <div
                id={evidenceId}
                hidden={!expanded}
                className={styles.checkEvidence}
              >
                <AccessibilityObservations rows={check.observations} />
                <p>{check.context}</p>
                <div className={styles.actions}>
                  <ReviewSourceLink
                    url={check.reference}
                    label="Related W3C guidance"
                  />
                  {hasAccessibilityReviewSteps(check) && (
                    <button
                      type="button"
                      className={shared.button}
                      onClick={() => onTask(check)}
                    >
                      View review steps{" "}
                      <Icon name="arrow" width="15" height="15" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!checks.length && (
        <div className={styles.empty}>
          <h4>No checks match this status</h4>
          <p>Choose another status or view all scoped checks for this page.</p>
          <button
            type="button"
            className={shared.button}
            onClick={() => {
              onFilter("all");
              filterSelect.current?.focus();
            }}
          >
            Reset status filter
          </button>
        </div>
      )}
      <details className={styles.legend}>
        <summary>How to read check statuses</summary>
        <dl>
          <div>
            <dt>Observed</dt>
            <dd>The collector found the described markup signal.</dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd>The recorded observation merits a closer look in context.</dd>
          </div>
          <div>
            <dt>Not observed</dt>
            <dd>
              The relevant signal or elements were absent from the collected
              HTML for this check.
            </dd>
          </div>
          <div>
            <dt>Not assessed</dt>
            <dd>The necessary detailed evidence was unavailable.</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
