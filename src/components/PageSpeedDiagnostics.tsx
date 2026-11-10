import { useEffect, useId, useRef, useState } from "react";
import { reportTime } from "@/lib/dashboard-evidence";
import { pageSpeedTestTime } from "@/lib/pagespeed-presentation";
import {
  FIELD_METRICS,
  LAB_METRICS,
  PAGE_SPEED_RATINGS,
  formatPageSpeedValue,
  type PageSpeedReport,
  type PageSpeedValue,
} from "@/lib/pagespeed";
import Icon from "./Icon";
import shared from "./ReviewWorkspace.module.css";
import styles from "./PageSpeedSection.module.css";

const views = {
  insights: "Optimization insights",
  lab: "Lab measurements",
  field: "Real-user data",
} as const;
type View = keyof typeof views;
type Insight = PageSpeedReport["opportunities"][number];
const firstPageSize = 4;

export function pageSpeedScope(report: PageSpeedReport) {
  return report.field.scope === "origin"
    ? "Origin-level data"
    : report.field.scope === "page"
      ? "Page-level data"
      : "No field data supplied";
}

export function pageSpeedAssessment(report: PageSpeedReport) {
  return report.field.assessment === "passed"
    ? "Core Web Vitals meet the good thresholds"
    : report.field.assessment === "needs-improvement"
      ? "Core Web Vitals need attention"
      : "Core Web Vitals assessment is unavailable.";
}

function Metric({
  value,
  label,
  title,
  explanation,
  target,
}: {
  value: PageSpeedValue;
  label: string;
  title: string;
  explanation: string;
  target?: string;
}) {
  return (
    <article className={styles.metric}>
      <div className={styles.metricTop}>
        <span>{label}</span>
        <span className={styles.badge} data-rating={value.rating}>
          {PAGE_SPEED_RATINGS[value.rating]}
        </span>
      </div>
      <h4>{title}</h4>
      <strong>{formatPageSpeedValue(value)}</strong>
      <p>{explanation}</p>
      {target && <small>Good range {target}</small>}
    </article>
  );
}

function estimates(item: Insight) {
  return [
    ...(item.savingsMs !== null && item.savingsMs > 0
      ? [`Estimated time savings · ${item.savingsMs} ms`]
      : []),
    ...(item.savingsBytes !== null && item.savingsBytes > 0
      ? [`Estimated transfer reduction · ${item.savingsBytes} bytes`]
      : []),
    ...item.metricSavings.map(
      ({ metric, value, unit }) =>
        `Estimated ${metric} improvement · ${value}${unit ? ` ${unit}` : ""}`,
    ),
  ];
}

export default function PageSpeedDiagnostics({
  report,
  providerLinkId,
}: {
  report: PageSpeedReport;
  providerLinkId: string;
}) {
  const id = useId();
  const [view, setView] = useState<View | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const insightButtons = useRef(new Map<string, HTMLButtonElement>());
  const viewButtons = useRef(new Map<View, HTMLButtonElement>());
  const focusInsight = useRef<string | null>(null);
  const imported = report.method === "lighthouse-import-v1";
  const testedAt = pageSpeedTestTime(report);
  const hasLab =
    report.performanceScore !== null ||
    Object.values(report.lab).some((metric) => metric.value !== null);
  const availableMetrics = FIELD_METRICS.filter(
    (metric) => report.field[metric.key].value !== null,
  );
  const hasSupporting =
    report.field.fcp.value !== null || report.field.ttfb.value !== null;
  const hasField = availableMetrics.length > 0 || hasSupporting;
  const missingVitals = FIELD_METRICS.filter(
    (metric) => report.field[metric.key].value === null,
  ).map((metric) => metric.label);
  const first = report.opportunities[0];
  const defaultView = first ? "insights" : hasLab ? "lab" : "field";
  const activeView = view ?? defaultView;
  const visible = showAll
    ? report.opportunities
    : report.opportunities.slice(0, firstPageSize);

  useEffect(() => {
    if (!focusInsight.current) return;
    insightButtons.current.get(focusInsight.current)?.focus();
    focusInsight.current = null;
  }, [activeView, expanded]);

  function inspect(key: string) {
    focusInsight.current = key;
    setView("insights");
    if (!visible.some((item) => item.id === key)) setShowAll(true);
    setExpanded((previous) => new Set([...previous, key]));
  }

  function openView(next: View) {
    setView(next);
    viewButtons.current.get(next)?.focus();
  }

  return (
    <div className={styles.diagnostics}>
      {first && (
        <section
          className={styles.recommendation}
          aria-labelledby={`${id}-first`}
        >
          <span className={styles.accentIcon}>
            <Icon name="target" width="20" height="20" />
          </span>
          <div>
            <p className={styles.kicker}>First to investigate</p>
            <h3 id={`${id}-first`}>{first.title}</h3>
            {first.description && (
              <p>
                {first.description.slice(0, 200).trimEnd()}
                {first.description.length > 200 ? "…" : ""}
              </p>
            )}
            <span className={styles.badge}>
              {estimates(first)[0] ?? "Lighthouse diagnostic"}
            </span>
          </div>
          <button
            type="button"
            className={shared.button}
            onClick={() => inspect(first.id)}
          >
            Inspect insight <Icon name="arrow" width="15" height="15" />
          </button>
        </section>
      )}
      <div
        className={styles.views}
        role="group"
        aria-label="Performance diagnostic views"
      >
        {(Object.keys(views) as View[]).map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={activeView === key}
            aria-controls={`${id}-${key}`}
            ref={(node) => {
              if (node) viewButtons.current.set(key, node);
              else viewButtons.current.delete(key);
            }}
            onClick={() => setView(key)}
          >
            <Icon
              name={
                key === "insights"
                  ? "target"
                  : key === "lab"
                    ? "chart"
                    : "users"
              }
              width="16"
              height="16"
            />
            {views[key]}
            {key === "insights" && (
              <span className={styles.badge}>
                {report.opportunities.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <section
        id={`${id}-insights`}
        hidden={activeView !== "insights"}
        aria-labelledby={`${id}-insights-title`}
      >
        <div className={styles.panel}>
          <header>
            <h3 id={`${id}-insights-title`}>Optimization insights</h3>
            <p>
              {imported
                ? "From the imported Lighthouse run."
                : "From the recorded Google PageSpeed run."}{" "}
              Estimates can overlap and actual savings may vary.
            </p>
          </header>
          {!first && (
            <div className={styles.empty}>
              <h4>No optimization insights were returned for this run.</h4>
              <button
                type="button"
                className={shared.button}
                onClick={() => openView(hasLab ? "lab" : "field")}
              >
                View measured results
              </button>
            </div>
          )}
          {visible.length > 0 && (
            <div className={styles.insightList} id={`${id}-insight-list`}>
              {visible.map((item, index) => {
                const open = expanded.has(item.id);
                const detail = `${id}-insight-${index}`;
                const saved = estimates(item);
                return (
                  <article key={item.id}>
                    <h4>
                      <button
                        type="button"
                        className={styles.insightButton}
                        aria-expanded={open}
                        aria-controls={detail}
                        ref={(node) => {
                          if (node) insightButtons.current.set(item.id, node);
                          else insightButtons.current.delete(item.id);
                        }}
                        onClick={() =>
                          setExpanded((previous) => {
                            const next = new Set(previous);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                      >
                        <span className={styles.insightNumber}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{item.title}</span>
                        <Icon name="down" width="15" height="15" />
                      </button>
                    </h4>
                    <div
                      id={detail}
                      hidden={!open}
                      className={styles.insightBody}
                    >
                      {item.description && <p>{item.description}</p>}
                      {item.displayValue && <p>{item.displayValue}</p>}
                      {!!saved.length && (
                        <ul className={styles.estimateList}>
                          {saved.map((value) => (
                            <li key={value}>{value}</li>
                          ))}
                        </ul>
                      )}
                      <h5>How to investigate</h5>
                      <p>
                        {imported ? (
                          "Open your original Lighthouse report to inspect the affected resources."
                        ) : (
                          <>
                            Use{" "}
                            <a
                              href={`#${providerLinkId}`}
                              onClick={() =>
                                document.getElementById(providerLinkId)?.focus()
                              }
                            >
                              Open in PageSpeed Insights
                            </a>{" "}
                            to investigate the affected resources on this page
                            and device.
                          </>
                        )}{" "}
                        Make a targeted change, then repeat the test under
                        similar conditions.
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {report.opportunities.length > firstPageSize && (
            <button
              type="button"
              className={shared.button}
              aria-expanded={showAll}
              aria-controls={`${id}-insight-list`}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show fewer insights" : "Show all insights"}
            </button>
          )}
        </div>
      </section>
      <section
        id={`${id}-lab`}
        hidden={activeView !== "lab"}
        aria-labelledby={`${id}-lab-title`}
      >
        <div className={styles.panel}>
          <header>
            <h3 id={`${id}-lab-title`}>Lab measurements</h3>
            <p>
              One controlled {report.strategy} page load ·{" "}
              {imported
                ? "Imported Lighthouse JSON"
                : "Google PageSpeed Insights"}
            </p>
          </header>
          {hasLab ? (
            <div className={styles.metrics}>
              {LAB_METRICS.map(({ key, ...metric }) => (
                <Metric key={key} {...metric} value={report.lab[key]} />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h4>Lab measurements are unavailable.</h4>
              <p>
                {report.warnings[0] ||
                  "This run supplied real-user data. Check the field dataset for available measurements."}
              </p>
              <button
                type="button"
                className={shared.button}
                onClick={() => openView("field")}
              >
                View real-user data
              </button>
            </div>
          )}
          <details className={styles.disclosure}>
            <summary>
              Test conditions <Icon name="down" width="15" height="15" />
            </summary>
            <dl className={styles.detailsGrid}>
              <div>
                <dt>Test time</dt>
                <dd>{testedAt ? reportTime(testedAt) : "Not supplied"}</dd>
              </div>
              <div>
                <dt>Lighthouse version</dt>
                <dd>{report.lighthouseVersion || "Not supplied"}</dd>
              </div>
              <div>
                <dt>Form factor</dt>
                <dd>{report.environment.formFactor || "Not supplied"}</dd>
              </div>
              <div>
                <dt>Throttling method</dt>
                <dd>{report.environment.throttlingMethod || "Not supplied"}</dd>
              </div>
            </dl>
            <p>
              Repeat tests with comparable devices and conditions. Total
              Blocking Time measures lab blocking. Interaction to Next Paint
              comes from the field dataset.
            </p>
          </details>
        </div>
      </section>
      <section
        id={`${id}-field`}
        hidden={activeView !== "field"}
        aria-labelledby={`${id}-field-title`}
      >
        <div className={styles.panel}>
          <header>
            <h3 id={`${id}-field-title`}>Real-user data</h3>
            <p>{pageSpeedScope(report)} · Chrome UX Report (CrUX)</p>
          </header>
          {hasField ? (
            <>
              <div className={styles.fieldStatus}>
                <strong>{pageSpeedAssessment(report)}</strong>
                <p>
                  75th percentile over the previous 28 days.{" "}
                  {report.field.scope === "origin"
                    ? "These results cover the origin, not just this page."
                    : "These results cover the recorded page dataset."}
                </p>
                {missingVitals.length > 0 && (
                  <p>
                    Missing field metrics · {missingVitals.join(", ")}. All
                    three Core Web Vitals are needed for an assessment.
                  </p>
                )}
              </div>
              {!!availableMetrics.length && (
                <div className={styles.metrics}>
                  {availableMetrics.map(({ key, ...metric }) => (
                    <Metric key={key} {...metric} value={report.field[key]} />
                  ))}
                </div>
              )}
              <details
                className={styles.disclosure}
                open={availableMetrics.length === 0 || undefined}
              >
                <summary>
                  Dataset and supporting metrics{" "}
                  <Icon name="down" width="15" height="15" />
                </summary>
                <dl className={styles.detailsGrid}>
                  <div>
                    <dt>Dataset identifier</dt>
                    <dd>{report.field.id || "Not supplied"}</dd>
                  </div>
                  <div>
                    <dt>Field FCP</dt>
                    <dd>{formatPageSpeedValue(report.field.fcp)}</dd>
                  </div>
                  <div>
                    <dt>Field TTFB</dt>
                    <dd>{formatPageSpeedValue(report.field.ttfb)}</dd>
                  </div>
                </dl>
              </details>
            </>
          ) : (
            <div className={styles.empty}>
              <h4>Real-user measurements are unavailable.</h4>
              <p>
                {imported
                  ? "Imported Lighthouse JSON provides lab measurements. Core Web Vitals require a separate real-user dataset."
                  : "Google did not supply usable field data for this result. Core Web Vitals require LCP, INP, and CLS from the same field dataset."}
              </p>
              <button
                type="button"
                className={shared.button}
                onClick={() => openView("lab")}
              >
                View lab measurements
              </button>
            </div>
          )}
        </div>
      </section>
      {report.warnings.length > 0 && (
        <details className={styles.disclosure}>
          <summary>
            Run notes{" "}
            <span className={styles.badge}>{report.warnings.length}</span>
            <Icon name="down" width="15" height="15" />
          </summary>
          <ul>
            {report.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
