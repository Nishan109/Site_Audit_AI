"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditResult } from "@/lib/types";
import { dashboardModel, dashboardPlan } from "@/lib/dashboard";
import { openReportCoverage, reportTime } from "@/lib/dashboard-evidence";
import Icon from "./Icon";
import styles from "./ReportHeader.module.css";

export default function ReportHeader({
  result,
  onRerun,
}: {
  result: AuditResult;
  onRerun: () => void;
}) {
  const model = useMemo(() => dashboardModel(result), [result]);
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const exportPanel = useRef<HTMLDetailsElement>(null);
  const url = new URL(result.url);
  const close = (restoreFocus = false) => {
    if (!exportPanel.current?.open) return;
    exportPanel.current.open = false;
    if (restoreFocus) exportPanel.current.querySelector("summary")?.focus();
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!exportPanel.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const copy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(dashboardPlan(result, model));
      setNotice("Your complete overview has been copied.");
      close(true);
    } catch {
      setNotice("Copying is unavailable. Download the overview instead.");
    } finally {
      setCopying(false);
    }
  };
  const download = () => {
    let objectUrl: string | undefined;
    try {
      objectUrl = URL.createObjectURL(
        new Blob([dashboardPlan(result, model)], {
          type: "text/plain;charset=utf-8",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${url.hostname}-audit-overview.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setNotice("Overview download started. Check your browser’s downloads.");
      close(true);
    } catch {
      setNotice(
        "The download could not start. Try copying the overview or saving a PDF.",
      );
    } finally {
      if (objectUrl) {
        const pendingUrl = objectUrl;
        setTimeout(() => URL.revokeObjectURL(pendingUrl), 1000);
      }
    }
  };
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <p className={styles.kicker}>
          WEBSITE REVIEW <span>Recorded snapshot</span>
        </p>
        <div className={styles.domain}>
          <span className={styles.domainIcon}>
            <Icon name="globe" width="23" height="23" />
          </span>
          <h1 id="report-title" tabIndex={-1}>
            {url.hostname.replace(/^www\./, "")}
          </h1>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the audited website"
          >
            <Icon name="external" width="17" height="17" />
          </a>
        </div>
        <p className={styles.url}>{result.url}</p>
        <p className={styles.timestamp}>
          Audit created{" "}
          <time
            dateTime={
              Number.isFinite(Date.parse(result.analyzedAt))
                ? result.analyzedAt
                : undefined
            }
          >
            {reportTime(result.analyzedAt)}
          </time>
        </p>
        <button
          type="button"
          className={styles.coverage}
          onClick={() => openReportCoverage()}
        >
          <Icon name="file" width="14" height="14" />
          {model.pages.length} collected{" "}
          {model.pages.length === 1 ? "page" : "pages"}
          <span>·</span>
          {model.sourceLinks.length} unique source links
          <Icon name="down" width="13" height="13" />
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.rerun} onClick={onRerun}>
          <Icon name="refresh" width="16" height="16" />
          Run again
        </button>
        <details
          ref={exportPanel}
          className={styles.export}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close(true);
            }
          }}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              close();
          }}
        >
          <summary>
            <Icon name="download" width="16" height="16" />
            Export report
            <Icon name="down" width="13" height="13" />
          </summary>
          <div className={styles.exportOptions}>
            <p>THE COMPLETE REPORT</p>
            <button
              type="button"
              onClick={() => {
                close(true);
                window.print();
              }}
            >
              <Icon name="file" />
              <span>
                Print / save as PDF
                <small>Opens your browser’s print dialog</small>
              </span>
            </button>
            <button type="button" onClick={download}>
              <Icon name="download" />
              <span>
                Download overview (.txt)
                <small>All findings, scores and coverage</small>
              </span>
            </button>
            <button
              type="button"
              disabled={copying}
              onClick={() => void copy()}
            >
              <Icon name={copying ? "loader" : "copy"} />
              <span>
                {copying ? "Copying overview…" : "Copy overview"}
                <small>Complete overview, regardless of filters</small>
              </span>
            </button>
          </div>
        </details>
      </div>
      <p role="status" className={styles.notice}>
        {notice}
      </p>
    </header>
  );
}
