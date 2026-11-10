"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { reportTime } from "@/lib/dashboard-evidence";
import {
  PAGE_SPEED_DEVICES,
  PAGE_SPEED_RATINGS,
  PAGESPEED_GUIDANCE,
  pageSpeedLink,
  type PageSpeedDevice,
  type PageSpeedReport,
} from "@/lib/pagespeed";
import { pageSpeedPlan, pageSpeedTestTime } from "@/lib/pagespeed-presentation";
import { sourceURL } from "@/lib/source-url";
import Icon from "./Icon";
import PageSpeedDiagnostics, {
  pageSpeedAssessment,
  pageSpeedScope,
} from "./PageSpeedDiagnostics";
import { ReviewSourceLink } from "./ReviewEvidence";
import { ReviewNotice, ReviewTools, usePlanExport } from "./ReviewWorkspace";
import { usePageSpeedResults } from "./usePageSpeedResults";
import shared from "./ReviewWorkspace.module.css";
import styles from "./PageSpeedSection.module.css";

const labels = { mobile: "Mobile", desktop: "Desktop" } as const;
const errorTitles: Record<string, string> = {
  PAGESPEED_QUOTA: "Google’s request limit paused this test.",
  PAGESPEED_CONFIGURATION: "Google could not authorize this test.",
  PAGESPEED_TIMEOUT: "The PageSpeed test timed out.",
  PAGESPEED_INVALID_RESPONSE: "The measurement response could not be verified.",
  PAGESPEED_NO_MEASUREMENTS: "Google returned no usable measurements.",
};

export default function PageSpeedSection({
  url,
  reports: supplied,
  onUpdated,
}: {
  url: string;
  reports?: Partial<Record<PageSpeedDevice, PageSpeedReport>>;
  onUpdated?: (report: PageSpeedReport) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const testButton = useRef<HTMLButtonElement>(null);
  const focusTest = useRef(false);
  const exporter = usePlanExport();
  const {
    device,
    report,
    reports,
    loading,
    importing,
    importError,
    notice,
    failure,
    retryIn,
    select,
    run,
    cancel,
    importFile,
    dismissImportError,
  } = usePageSpeedResults(url, supplied, (value) => {
    exporter.invalidate();
    onUpdated?.(value);
  });
  const label = labels[device];
  const audited = sourceURL(url);
  const googleLink = pageSpeedLink(url, device);
  const providerLinkId = `${id}-provider`;
  const results = PAGE_SPEED_DEVICES.flatMap((key) =>
    reports[key] ? [reports[key]] : [],
  );
  const hasQuota = retryIn > 0 || failure?.code === "PAGESPEED_QUOTA";
  const localSetup =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SITEAUDIT_LOCAL_KEY_SETUP === "1";

  useEffect(() => {
    if (focusTest.current && !loading) {
      focusTest.current = false;
      testButton.current?.focus();
    }
  }, [loading]);

  return (
    <div
      className={`${shared.workspace} ${styles.workspace}`}
      data-review-workspace="pagespeed"
    >
      <section className={styles.controls} aria-label="Measure this page">
        <div className={styles.controlTop}>
          <div className={styles.identity}>
            <span className={styles.accentIcon}>
              <Icon name="bolt" />
            </span>
            <div>
              <p className={styles.kicker}>Performance test</p>
              <ReviewSourceLink
                url={audited ?? undefined}
                label={audited ?? undefined}
              />
            </div>
          </div>
          <div
            className={styles.devicePicker}
            role="group"
            aria-label="PageSpeed test device"
          >
            {PAGE_SPEED_DEVICES.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={device === value}
                onClick={() => select(value)}
              >
                <Icon
                  name={value === "mobile" ? "layers" : "grid"}
                  width="16"
                  height="16"
                />
                <span>
                  {labels[value]}
                  {reports[value] && (
                    <small>
                      {reports[value].method === "lighthouse-import-v1"
                        ? "Lab result"
                        : "Result available"}
                    </small>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.actionBar}>
          <p>
            Measure this page, understand the result, and choose what to
            investigate first.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              ref={testButton}
              className={retryIn ? shared.button : shared.primary}
              disabled={loading || importing || retryIn > 0}
              onClick={() => void run()}
            >
              <Icon
                name={loading ? "refresh" : "bolt"}
                width="16"
                height="16"
              />
              {loading
                ? `Testing ${device}…`
                : retryIn > 0
                  ? `Retry in ${retryIn}s`
                  : report
                    ? `Retest ${device}`
                    : failure
                      ? `Retry ${device}`
                      : `Test ${device}`}
            </button>
            <button
              type="button"
              ref={importButton}
              className={retryIn > 0 ? shared.primary : shared.button}
              disabled={loading || importing}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="upload" width="15" height="15" /> Import Lighthouse
              JSON
            </button>
            <input
              type="file"
              ref={fileInput}
              aria-label="Lighthouse JSON file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void importFile(file);
              }}
            />
            {loading && (
              <button
                type="button"
                className={shared.button}
                onClick={() => {
                  focusTest.current = true;
                  cancel();
                }}
              >
                Cancel test
              </button>
            )}
          </div>
        </div>
        {(loading || importing) && (
          <div className={styles.activity} role="status">
            <strong>
              {loading
                ? `Testing ${device} with Google PageSpeed Insights`
                : "Reading Lighthouse measurements…"}
            </strong>
            {report && (
              <p>
                Your previous result remains visible with its original time.
              </p>
            )}
          </div>
        )}
        {(failure || retryIn > 0) && (
          <div className={styles.recovery}>
            <div role={failure ? "alert" : undefined}>
              <strong>
                {hasQuota
                  ? failure
                    ? errorTitles.PAGESPEED_QUOTA
                    : "Google testing is on cooldown."
                  : errorTitles[failure?.code ?? ""] ||
                    "This performance test couldn’t finish."}
              </strong>
              <p>
                {hasQuota
                  ? retryIn > 0
                    ? "Import a Lighthouse report now or retry Google when the countdown ends."
                    : "You can try Google again or import a Lighthouse report."
                  : failure?.message}
              </p>
              {report && failure && (
                <p>
                  Your earlier {device} result remains available below with its
                  original time.
                </p>
              )}
            </div>
          </div>
        )}
        {importError && (
          <div className={`${styles.recovery} ${styles.importError}`}>
            <p role="alert">{importError}</p>
            <button
              type="button"
              className={shared.button}
              onClick={() => {
                dismissImportError();
                importButton.current?.focus();
              }}
            >
              Dismiss import error
            </button>
          </div>
        )}
        <div className={styles.providerBar}>
          <a
            id={providerLinkId}
            href={googleLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in PageSpeed Insights{" "}
            <Icon name="external" width="13" height="13" />
          </a>
          <details className={styles.providerHelp}>
            <summary>
              Measure with Chrome Lighthouse{" "}
              <Icon name="down" width="13" height="13" />
            </summary>
            <ol>
              <li>Open the reviewed page in Chrome.</li>
              <li>
                In DevTools, run a Lighthouse Navigation test with Performance
                and {label} selected.
              </li>
              <li>
                Save the report as JSON, then use Import Lighthouse JSON above.
                Files are read in your browser, up to 10 MB.
              </li>
            </ol>
            <a
              href="https://developer.chrome.com/docs/lighthouse/overview#share-reports-as-json"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chrome’s JSON export guide{" "}
              <Icon name="external" width="13" height="13" />
            </a>
          </details>
          {(localSetup ||
            failure?.keyConfigured !== undefined ||
            failure?.code === "PAGESPEED_CONFIGURATION") && (
            <details className={styles.providerHelp}>
              <summary>
                Developer setup <Icon name="down" width="13" height="13" />
              </summary>
              <p>
                {failure?.keyConfigured
                  ? "Check the project’s PageSpeed API access and quota in Google Cloud."
                  : "Configure the server’s PAGESPEED_API_KEY to use your Google Cloud project’s quota."}
              </p>
              {localSetup && (
                <Link
                  href="/settings/pagespeed"
                  target="_blank"
                  rel="noopener noreferrer"
                  prefetch={false}
                >
                  Configure API key{" "}
                  <Icon name="external" width="13" height="13" />
                </Link>
              )}
              <a
                href="https://developers.google.com/speed/docs/insights/v5/get-started"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google’s setup guide{" "}
                <Icon name="external" width="13" height="13" />
              </a>
            </details>
          )}
        </div>
      </section>
      {notice && <ReviewNotice>{notice}</ReviewNotice>}
      {results.length > 0 && (
        <ReviewTools
          copyLabel="Copy results"
          downloadLabel="Download results (.txt)"
          downloadText="Download results (.txt)"
          onCopy={() =>
            void exporter.copy(
              pageSpeedPlan(results),
              "All available device results copied.",
            )
          }
          onDownload={() =>
            exporter.download(
              pageSpeedPlan(results),
              `${audited ? new URL(audited).hostname : "website"}-pagespeed-results.txt`,
            )
          }
        >
          Exports include all available device results.
        </ReviewTools>
      )}
      {exporter.notice && <ReviewNotice>{exporter.notice}</ReviewNotice>}
      {!report && !loading && !importing && !failure && !hasQuota && (
        <div className={styles.empty}>
          <h3>Your {device} test is ready.</h3>
          <p>
            Run a controlled Lighthouse page load using the controls above.
            Google may also provide a real-user dataset for this page or origin.
          </p>
        </div>
      )}
      {report && (
        <ResultSnapshot
          report={report}
          previous={loading || !!failure || notice === "Test cancelled."}
        />
      )}
      {results.map((result) => (
        <div key={result.strategy} hidden={device !== result.strategy}>
          <PageSpeedDiagnostics
            report={result}
            providerLinkId={providerLinkId}
          />
        </div>
      ))}
      <details className={styles.disclosure}>
        <summary>
          Guidance behind these results{" "}
          <Icon name="down" width="15" height="15" />
        </summary>
        <div className={styles.references}>
          {PAGESPEED_GUIDANCE.map((item) => (
            <ReviewSourceLink
              key={item.url}
              url={item.url}
              label={item.label}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

function ResultSnapshot({
  report,
  previous,
}: {
  report: PageSpeedReport;
  previous: boolean;
}) {
  const id = useId();
  const imported = report.method === "lighthouse-import-v1";
  const label = labels[report.strategy];
  const score = report.performanceScore;
  const rating =
    score === null
      ? "unavailable"
      : score >= 90
        ? "good"
        : score >= 50
          ? "needs-improvement"
          : "poor";
  const testedAt = pageSpeedTestTime(report);
  const missing =
    report.field.assessment === "unavailable" &&
    report.field.scope !== "unavailable";
  return (
    <section className={styles.snapshot} aria-labelledby={id}>
      <header>
        <h3 id={id}>{label} result</h3>
        {previous && <span className={styles.badge}>Previous result</span>}
      </header>
      <dl className={styles.summary}>
        <div>
          <dt>Lighthouse lab score</dt>
          <dd>
            {score === null ? (
              <strong>Unavailable</strong>
            ) : (
              <span
                className={styles.score}
                role="meter"
                aria-label={`${label} Lighthouse performance score`}
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <strong>{score}</strong>
                <span>/ 100</span>
              </span>
            )}
            <span className={styles.badge} data-rating={rating}>
              {score === null
                ? "Lab score not supplied"
                : PAGE_SPEED_RATINGS[rating]}
            </span>
          </dd>
        </div>
        <div>
          <dt>Real-user data</dt>
          <dd>
            <strong>{pageSpeedScope(report)}</strong>
            <span>
              {missing
                ? "Partial data · all three field metrics are needed for an assessment."
                : pageSpeedAssessment(report)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Result source</dt>
          <dd>
            <strong>
              {imported
                ? "Imported Lighthouse JSON"
                : "Google PageSpeed Insights"}
            </strong>
            {imported && <span className={styles.badge}>Lab only</span>}
            <span>
              {testedAt ? "Tested" : "Collected"}{" "}
              <time dateTime={testedAt || report.analyzedAt}>
                {reportTime(testedAt || report.analyzedAt)}
              </time>
            </span>
          </dd>
        </div>
      </dl>
      {sourceURL(report.finalUrl) !== sourceURL(report.url) && (
        <div className={styles.redirect}>
          <span>Final tested page</span>
          <ReviewSourceLink url={report.finalUrl} label={report.finalUrl} />
        </div>
      )}
    </section>
  );
}
