"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { ReportSummary } from "@/lib/saved-reports";
import Icon from "./Icon";
import { focusReviewForm } from "./landing-navigation";
import styles from "./WorkspaceHome.module.css";

export default function AuditHistory({
  reports,
  query,
  nextCursor,
  failed,
  count = null,
  olderPage = false,
}: {
  reports: ReportSummary[];
  query: string;
  nextCursor?: string;
  failed: boolean;
  count?: number | null;
  olderPage?: boolean;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReportSummary | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const visible = reports.filter((report) => !removed.includes(report.id));
  const retainedCount =
    count === null
      ? null
      : Math.max(
          0,
          count -
            removed.filter((id) => reports.some((report) => report.id === id))
              .length,
        );
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  async function remove() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/${selected.id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      setRemoved((items) => [...items, selected.id]);
      dialog.current?.close();
      heading.current?.focus();
      setSelected(null);
    } catch {
      setError("We couldn’t delete this report. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={styles.history}
      id="audit-history"
      aria-labelledby="history-title"
    >
      <div className={styles.historyHeading}>
        <div className={styles.historyIdentity}>
          <span className={styles.historyIcon}>
            <Icon name="file" width="18" height="18" />
          </span>
          <div>
            <div className={styles.historyTitleRow}>
              <h2 id="history-title" ref={heading} tabIndex={-1}>
                Audit history
              </h2>
              {!failed && retainedCount !== null && !olderPage && (
                <span
                  className={styles.countBadge}
                  aria-label={`${retainedCount} ${query ? "matching" : "saved"} reviews`}
                >
                  {retainedCount}
                </span>
              )}
            </div>
            <p>Your evidence and next steps, all in one place.</p>
          </div>
        </div>
        <form
          action="/workspace"
          className={styles.searchForm}
          role="search"
          aria-label="Search audit history"
        >
          <label className="sr-only" htmlFor="history-search">
            Search by website or page address
          </label>
          <div className={styles.searchField}>
            <Icon name="search" width="16" height="16" />
            <input
              id="history-search"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={query}
              placeholder="Search your reviews…"
            />
          </div>
          <button className={styles.searchButton}>Search</button>
        </form>
      </div>
      {query && (
        <div className={styles.filterContext}>
          Results for “{query}”
          <Link href="/workspace">
            Clear search
            <Icon name="close" width="12" height="12" />
          </Link>
        </div>
      )}
      {failed ? (
        <div className={styles.historyError} role="alert">
          <span className={styles.emptyIcon}>
            <Icon name="info" width="23" height="23" />
          </span>
          <h3>Your history couldn’t load</h3>
          <p>
            Your saved reports are still in your account. Please try again in a
            moment.
          </p>
          <a className="button button-secondary" href="/workspace">
            Try again
            <Icon name="refresh" width="14" height="14" />
          </a>
        </div>
      ) : visible.length ? (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Website</th>
                  <th scope="col">Review date</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Report actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((report, index) => (
                  <tr key={report.id}>
                    <td>
                      <div className={styles.websiteCell}>
                        <span className={styles.siteIcon}>
                          <Icon name="globe" width="18" height="18" />
                        </span>
                        <div>
                          <Link
                            className={styles.websiteName}
                            href={`/workspace/audits/${report.id}`}
                          >
                            {report.hostname}
                          </Link>
                          <p title={report.audited_url}>{report.audited_url}</p>
                          {index === 0 && !query && !olderPage && (
                            <span className={styles.latestLabel}>
                              Most recent review
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={styles.dateCell}>
                      <time dateTime={report.analyzed_at}>
                        {new Date(report.analyzed_at).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                        <span>
                          {new Date(report.analyzed_at).toLocaleTimeString(
                            "en",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: "UTC",
                            },
                          )}{" "}
                          UTC
                        </span>
                      </time>
                    </td>
                    <td className={styles.statusCell}>
                      <span className={styles.savedBadge}>
                        <span />
                        Saved
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          className={styles.openReport}
                          href={`/workspace/audits/${report.id}`}
                        >
                          Open report
                          <Icon name="arrow" width="14" height="14" />
                        </Link>
                        <button
                          className={styles.deleteButton}
                          aria-label={`Delete report for ${report.hostname}`}
                          onClick={(event) => {
                            trigger.current = event.currentTarget;
                            setSelected(report);
                            setError("");
                            dialog.current?.showModal();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.historyFooter}>
            <span>
              {olderPage
                ? `Showing ${visible.length} older reviews`
                : query
                  ? `Showing ${visible.length} matching ${visible.length === 1 ? "review" : "reviews"}`
                  : `Showing ${visible.length} ${visible.length === 1 ? "review" : "reviews"}`}{" "}
              · Newest first
            </span>
            <span>
              <Icon name="shield" width="12" height="12" />
              Only visible to you
            </span>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          {query || olderPage || nextCursor ? (
            <span className={styles.emptyIcon}>
              <Icon name={query ? "search" : "file"} width="25" height="25" />
            </span>
          ) : (
            <div className={styles.reportArt} aria-hidden="true">
              <div />
              <div />
              <div>
                <span>
                  <Icon name="chart" width="19" height="19" />
                </span>
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          <h3>
            {query
              ? "No reviews match your search"
              : olderPage
                ? "You’ve reached the end of this page"
                : nextCursor
                  ? "More reviews are waiting"
                  : "Your first review is a fresh start."}
          </h3>
          <p>
            {query
              ? "Try a different website name or page address."
              : olderPage || nextCursor
                ? "Browse your saved reviews or return to your most recent reports."
                : "Add a website above. Your completed report will be saved here, ready whenever you need a clearer next step."}
          </p>
          {query || olderPage ? (
            <Link className="button button-secondary" href="/workspace">
              View all reviews
              <Icon name="arrow" width="14" height="14" />
            </Link>
          ) : (
            !nextCursor && (
              <button className={styles.emptyAction} onClick={focusReviewForm}>
                Start your first review
                <Icon name="arrow" width="15" height="15" />
              </button>
            )
          )}
          {!query && !olderPage && !nextCursor && (
            <span className={styles.emptyHint}>
              <Icon name="shield" width="12" height="12" />
              Private to your account. Easy to reopen and export.
            </span>
          )}
        </div>
      )}
      {nextCursor && (
        <div className={styles.pagination}>
          <Link
            className="button button-secondary"
            href={`/workspace?q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(nextCursor)}`}
          >
            Older reviews
            <Icon name="arrow" width="14" height="14" />
          </Link>
        </div>
      )}
      <dialog
        ref={dialog}
        className="help-dialog"
        aria-labelledby="delete-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <h2 id="delete-title">Delete this saved report?</h2>
        <p>
          This permanently removes the review of {selected?.hostname} from your
          history. Export a copy first if you need to keep it.
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.rowActions}>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={close}
          >
            Keep report
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "Deleting…" : "Delete report"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
