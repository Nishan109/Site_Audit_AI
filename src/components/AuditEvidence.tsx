"use client";
import { useEffect, useRef, useState } from "react";
import type { AuditResult } from "@/lib/types";
import { dashboardModel, sourceURL } from "@/lib/dashboard";
import { reportTime } from "@/lib/dashboard-evidence";
import AgentLog from "./AgentLog";
import Icon from "./Icon";
import styles from "./AuditEvidence.module.css";

export default function AuditEvidence({
  result,
  onResearchUpdated,
}: {
  result: AuditResult;
  onResearchUpdated: (research: NonNullable<AuditResult["research"]>) => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const reportId = result.analysisId || result.analyzedAt;
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [reportId, result.url],
  );
  const coverage = dashboardModel(result);
  const retry = async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setRetrying(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url }),
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(115_000),
        ]),
      });
      const research = await response.json();
      if (!response.ok)
        throw new Error(
          research.error || "Research couldn’t be completed. Please try again.",
        );
      if (
        typeof research.summary !== "string" ||
        !research.summary.trim() ||
        !Array.isArray(research.sources) ||
        !research.sources.some((url: string) => sourceURL(url)) ||
        !Array.isArray(research.queries) ||
        !Number.isFinite(Date.parse(research.searchedAt))
      )
        throw new Error("No usable research records were returned.");
      if (controller.signal.aborted) return;
      onResearchUpdated(research);
      setNotice(
        "Web research updated. Your existing content findings have been retained.",
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Research couldn’t be completed.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setRetrying(false);
      }
    }
  };
  return (
    <section
      aria-label="Audit evidence and coverage"
      className={styles.coverage}
    >
      {!coverage.researchAvailable && (
        <div className={styles.researchNote}>
          <Icon name="info" width="17" height="17" />
          <p>
            <strong>Research unavailable.</strong> Findings use collected page
            evidence; competitor context is not established.
          </p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => void retry()}
          >
            <Icon
              name={retrying ? "loader" : "refresh"}
              width="14"
              height="14"
              className={retrying ? "spin" : ""}
            />
            {retrying ? "Researching the web…" : "Retry web research"}
          </button>
        </div>
      )}
      <p className={styles.feedback} role="status">
        {notice}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error} Your collected-page findings are still available.
        </p>
      )}
      <details id="report-evidence" className={styles.details}>
        <summary>
          <span className={styles.icon}>
            <Icon name="link" />
          </span>
          <span>
            <strong>Evidence & coverage</strong>
            <small>
              {coverage.pages.length} collected{" "}
              {coverage.pages.length === 1 ? "page" : "pages"} ·{" "}
              {coverage.sourceLinks.length} unique source links
            </small>
          </span>
          <Icon name="down" width="17" height="17" />
        </summary>
        <div className={styles.body}>
          <p className={styles.intro}>
            Only the listed pages were collected. This audit is a recorded
            sample, not a continuous monitor.
          </p>
          <div className={styles.grid}>
            <div>
              <h3>Collected pages</h3>
              <p className={styles.help}>
                Pages actually read for this review.
              </p>
              <div className={styles.pages}>
                {coverage.pages.map((page) => (
                  <details key={page.url}>
                    <summary>
                      <Icon name="file" width="17" height="17" />
                      <span>
                        <strong>{page.title || page.url}</strong>
                        <small>{page.url}</small>
                      </span>
                      <Icon name="down" width="14" height="14" />
                    </summary>
                    <div>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open source page
                        <Icon name="external" width="13" height="13" />
                      </a>
                      <p>
                        Collected{" "}
                        <time dateTime={page.fetchedAt}>
                          {reportTime(page.fetchedAt)}
                        </time>
                      </p>
                      {page.collectionNote && <p>{page.collectionNote}</p>}
                      <details className={styles.technical}>
                        <summary>Content fingerprint</summary>
                        <code>{page.contentHash}</code>
                      </details>
                    </div>
                  </details>
                ))}
              </div>
              {!coverage.pages.length && (
                <p className={styles.help}>
                  No complete page-collection records are available. Run a fresh
                  audit to collect evidence.
                </p>
              )}
            </div>
            <div className={styles.research}>
              <h3>Web research</h3>
              <span
                className={styles.status}
                data-available={coverage.researchAvailable}
              >
                {coverage.researchAvailable
                  ? "Research recorded"
                  : "Research unavailable"}
              </span>
              {coverage.researchAvailable && result.research ? (
                <>
                  <p>{result.research.summary}</p>
                  <p className={styles.help}>
                    {result.research.provider} · {coverage.researchLinks.length}{" "}
                    distinct research source links ·{" "}
                    <time dateTime={result.research.searchedAt}>
                      {reportTime(result.research.searchedAt)}
                    </time>
                  </p>
                  <ul>
                    {coverage.researchLinks.map((source) => (
                      <li key={source}>
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source}
                          <Icon name="external" width="12" height="12" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  Page findings remain available. Competitor facts and market
                  context require recorded research.
                </p>
              )}
            </div>
          </div>
          <details className={styles.sources}>
            <summary>
              All {coverage.sourceLinks.length} unique source links
              <Icon name="down" width="14" height="14" />
            </summary>
            <p className={styles.help}>
              A listed link does not mean its page was collected.
            </p>
            <ul>
              {coverage.sourceLinks.map((source) => (
                <li key={source}>
                  <a href={source} target="_blank" rel="noopener noreferrer">
                    {source}
                    <Icon name="external" width="12" height="12" />
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <details className={styles.limits}>
            <summary>
              Scope & collection notes
              <Icon name="down" width="14" height="14" />
            </summary>
            <ul>
              {[...coverage.limitations, ...coverage.warnings].map(
                (text, index) => (
                  <li key={index}>{text}</li>
                ),
              )}
            </ul>
            {coverage.unsupported > 0 && (
              <p>
                {coverage.unsupported} incomplete finding record(s) are excluded
                from dashboard counts. The category reviews retain the original
                records.
              </p>
            )}
          </details>
          <div className={styles.execution}>
            <AgentLog
              agentSteps={result.agentSteps}
              searchQueries={result.searchQueries}
              sources={result.sources}
              initialReviewTiming={result.initialReviewTiming}
            />
          </div>
        </div>
      </details>
    </section>
  );
}
