"use client";

import { useId, useRef, type Ref } from "react";
import {
  hasSecurityReviewSteps,
  SECURITY_GUIDANCE,
  SECURITY_STATUS,
  type SecurityArea,
  type SecurityCheck,
  type SecurityReview,
  type SecurityStatus,
} from "@/lib/security";
import {
  SECURITY_AREAS,
  securityCheckIdentity,
} from "@/lib/security-presentation";
import { reportTime } from "@/lib/dashboard-evidence";
import { sourceURL } from "@/lib/source-url";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import layout from "./UXSection.module.css";
import workbench from "./ConversionSection.module.css";
import styles from "./SecuritySection.module.css";

export const securityAreas = Object.keys(SECURITY_AREAS) as SecurityArea[];
const statuses = Object.keys(SECURITY_STATUS) as SecurityStatus[];

export function SecurityStatusBadge({ status }: { status: SecurityStatus }) {
  return (
    <span className={styles.status} data-status={status}>
      {SECURITY_STATUS[status]}
    </span>
  );
}

export function SecurityObservations({
  check,
  task = false,
}: {
  check: SecurityCheck;
  task?: boolean;
}) {
  return (
    <div className={styles.evidence}>
      <dl>
        {check.observations.map(({ label, value }, index) => (
          <div key={`${label}-${index}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {task && <h6>Why review it</h6>}
      <p>{check.context}</p>
      <ReviewSourceLink
        url={SECURITY_GUIDANCE[check.key]}
        label="Read technical guidance"
      />
    </div>
  );
}

export const initialSignalFilters = {
  status: "all" as SecurityStatus | "all",
  withSteps: false,
};

export default function SecurityPageSignals({
  headingId,
  headingRef,
  evidenceRef,
  pages,
  page,
  openSignal,
  filters,
  onPage,
  onToggle,
  onFilter,
  onTask,
}: {
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  evidenceRef: Ref<HTMLHeadingElement>;
  pages: SecurityReview["pages"];
  page: SecurityReview["pages"][number];
  openSignal: string;
  filters: typeof initialSignalFilters;
  onPage: (url: string) => void;
  onToggle: (key: string) => void;
  onFilter: (value: typeof initialSignalFilters) => void;
  onTask: (check: SecurityCheck) => void;
}) {
  const id = useId();
  const allSignals = useRef<HTMLButtonElement>(null);
  const checks = page.checks;
  const eligible = checks.filter(
    (check) => !filters.withSteps || hasSecurityReviewSteps(check),
  );
  const visible = eligible.filter(
    (check) => filters.status === "all" || check.status === filters.status,
  );
  return (
    <div className={workbench.workArea}>
      <header className={workbench.heading}>
        <h3 id={headingId} tabIndex={-1} ref={headingRef}>
          Page signals
        </h3>
        <p>Inspect the observations recorded for one final page response.</p>
      </header>
      <div className={workbench.pageBar}>
        <div className={workbench.pageIdentity}>
          <span className={workbench.pageIcon}>
            <Icon name="globe" width="19" height="19" />
          </span>
          <div>
            <h4 className={styles.pageTitle}>
              {page.title || "Collected page"}
            </h4>
            <p>{sourceURL(page.url)}</p>
            <time dateTime={page.fetchedAt} className={styles.meta}>
              Collected {reportTime(page.fetchedAt)}
            </time>
          </div>
        </div>
        {pages.length > 1 && (
          <label className={workbench.field}>
            Collected security page
            <select
              value={sourceURL(page.url) || ""}
              onChange={(event) => onPage(event.target.value)}
            >
              {pages.map(({ url }) => (
                <option key={url} value={sourceURL(url) || ""}>
                  {sourceURL(url)}
                </option>
              ))}
            </select>
          </label>
        )}
        <ReviewSourceLink
          url={sourceURL(page.url) || undefined}
          label="Open audited page"
        />
      </div>
      <p className={styles.coverage} data-collected={page.headersCollected}>
        <Icon name="file" width="15" height="15" />
        <span>
          {page.headersCollected
            ? "Final-response headers collected"
            : "Response headers not collected"}
          {page.sampled && " · Reference evidence sampled"}
        </span>
      </p>
      <div className={workbench.filters}>
        <div
          className={layout.priorities}
          role="group"
          aria-label="Filter security signals by status"
        >
          <button
            ref={allSignals}
            type="button"
            aria-pressed={filters.status === "all"}
            onClick={() => onFilter({ ...filters, status: "all" })}
          >
            All signals <span>{eligible.length}</span>
          </button>
          {statuses.map((status) => (
            <button
              type="button"
              key={status}
              aria-pressed={filters.status === status}
              onClick={() => onFilter({ ...filters, status })}
            >
              {SECURITY_STATUS[status]}{" "}
              <span>
                {eligible.filter((check) => check.status === status).length}
              </span>
            </button>
          ))}
        </div>
        <label className={styles.stepsFilter}>
          <input
            type="checkbox"
            checked={filters.withSteps}
            onChange={(event) =>
              onFilter({ ...filters, withSteps: event.target.checked })
            }
          />
          Has review steps{" "}
          <span>{checks.filter(hasSecurityReviewSteps).length}</span>
        </label>
      </div>
      <div className={workbench.resultLine}>
        <p role="status">
          {visible.length} of {checks.length} signals shown
        </p>
        {(filters.status !== "all" || filters.withSteps) && (
          <button
            type="button"
            className={layout.textButton}
            onClick={() => {
              allSignals.current?.focus();
              onFilter(initialSignalFilters);
            }}
          >
            Clear signal filters
          </button>
        )}
      </div>
      {visible.length ? (
        securityAreas.map((area) => {
          const group = visible.filter((check) => check.area === area);
          if (!group.length) return null;
          return (
            <section
              key={area}
              className={styles.signalGroup}
              aria-labelledby={`${id}-${area}`}
            >
              <h4 id={`${id}-${area}`}>
                {SECURITY_AREAS[area]} <span>{group.length}</span>
              </h4>
              <ul>
                {group.map((check) => {
                  const key = securityCheckIdentity(check);
                  const open = key === openSignal;
                  return (
                    <li
                      key={key}
                      data-signal={check.key}
                      className={styles.signal}
                    >
                      <div className={styles.signalRow}>
                        <div className={styles.signalCopy}>
                          <h5>{check.title}</h5>
                          <p>{check.detail}</p>
                        </div>
                        <SecurityStatusBadge status={check.status} />
                        <div className={styles.signalActions}>
                          <button
                            type="button"
                            className={layout.button}
                            aria-expanded={open}
                            aria-controls={`${id}-evidence-${check.key}`}
                            onClick={() => onToggle(key)}
                          >
                            {open ? "Hide evidence" : "View evidence"}
                          </button>
                          {hasSecurityReviewSteps(check) && (
                            <button
                              type="button"
                              className={layout.textButton}
                              onClick={() => onTask(check)}
                            >
                              View review steps
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        id={`${id}-evidence-${check.key}`}
                        hidden={!open}
                        className={styles.signalEvidence}
                      >
                        {open && (
                          <>
                            <h6 tabIndex={-1} ref={evidenceRef}>
                              {check.title} evidence
                            </h6>
                            <SecurityObservations check={check} />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      ) : (
        <div className={layout.empty}>
          <Icon name="search" width="22" height="22" />
          <h4>No signals match these filters</h4>
          <p>Clear the filters to see the collected checks for this page.</p>
        </div>
      )}
      <details className={layout.secondary}>
        <summary>
          <span>
            <Icon name="info" width="16" height="16" />
            <strong>How to read these statuses</strong>
          </span>
          <Icon name="down" width="15" height="15" />
        </summary>
        <dl className={styles.legend}>
          <div>
            <dt>Observed</dt>
            <dd>
              A declaration, response value, or attribute summary was recorded
              in the sample.
            </dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd>The recorded condition warrants a closer look in context.</dd>
          </div>
          <div>
            <dt>Not observed</dt>
            <dd>
              The specific signal was absent or unrecognized in the inspected
              material.
            </dd>
          </div>
          <div>
            <dt>Not assessed</dt>
            <dd>Collection was unavailable or the check did not apply.</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
