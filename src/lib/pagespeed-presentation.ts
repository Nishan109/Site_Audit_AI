import {
  FIELD_METRICS,
  LAB_METRICS,
  PAGE_SPEED_RATINGS,
  formatPageSpeedValue,
  pageSpeedLink,
  type PageSpeedReport,
} from "./pagespeed";

export function pageSpeedTestTime(report: PageSpeedReport) {
  return report.fetchTime && Number.isFinite(Date.parse(report.fetchTime))
    ? report.fetchTime
    : null;
}

export function pageSpeedPlan(reports: PageSpeedReport[]) {
  return [
    "PAGE SPEED · PERFORMANCE MEASUREMENTS",
    "Lab tests and real-user field data are separate. Missing measurements are unavailable, not zero or failed.",
    ...reports.flatMap((report) => [
      "",
      `${report.strategy.toUpperCase()} · ${report.url}`,
      `Source: ${report.method === "lighthouse-import-v1" ? "Imported Lighthouse JSON (lab only)" : "Google PageSpeed Insights"}`,
      `${report.method === "lighthouse-import-v1" ? "Recorded run time" : "Collected"}: ${report.analyzedAt}`,
      `Tested URL: ${report.finalUrl}`,
      `Lighthouse version: ${report.lighthouseVersion || "Not supplied"}`,
      `Test time: ${pageSpeedTestTime(report) || "Not supplied"}`,
      `Form factor: ${report.environment.formFactor || "Not supplied"}`,
      `Throttling method: ${report.environment.throttlingMethod || "Not supplied"}`,
      "",
      `LIGHTHOUSE LAB SCORE: ${report.performanceScore === null ? "Unavailable" : `${report.performanceScore}/100`}`,
      ...LAB_METRICS.map(
        (metric) =>
          `${metric.title}: ${formatPageSpeedValue(report.lab[metric.key])} · ${PAGE_SPEED_RATINGS[report.lab[metric.key].rating]}`,
      ),
      "",
      `REAL-USER DATA: ${report.field.scope === "unavailable" ? "Unavailable" : report.field.scope === "origin" ? "Origin-level; covers the origin rather than this exact page" : "Page-level"}`,
      `Collection ID: ${report.field.id || "Not supplied"}`,
      "CrUX values, when supplied, represent the 75th percentile of the previous 28-day collection period.",
      `Core Web Vitals: ${report.field.assessment === "passed" ? "All three supplied field metrics meet the good thresholds" : report.field.assessment === "needs-improvement" ? "At least one supplied field metric is outside the good range" : "Cannot establish; complete field data not supplied"}`,
      ...FIELD_METRICS.map(
        (metric) =>
          `${metric.title}: ${formatPageSpeedValue(report.field[metric.key])} · ${PAGE_SPEED_RATINGS[report.field[metric.key].rating]}`,
      ),
      `Field FCP: ${formatPageSpeedValue(report.field.fcp)}`,
      `Field TTFB: ${formatPageSpeedValue(report.field.ttfb)}`,
      "",
      "PROVIDER OPTIMIZATION INSIGHTS",
      ...report.opportunities.flatMap((item, index) => [
        `${index + 1}. ${item.title}`,
        item.description,
        ...(item.savingsMs !== null
          ? [`Estimated time savings: ${item.savingsMs} ms`]
          : []),
        ...item.metricSavings.map(
          (metric) =>
            `Estimated ${metric.metric} improvement: ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`,
        ),
        ...(item.savingsBytes !== null
          ? [`Estimated transfer reduction: ${item.savingsBytes} bytes`]
          : []),
        ...(item.displayValue ? [item.displayValue] : []),
      ]),
      ...(!report.opportunities.length
        ? [
            "No optimization insights were returned by the provider for this run. This does not establish that no performance issues exist.",
          ]
        : []),
      "Provider estimates can overlap and must not be added together or treated as guaranteed improvements.",
      ...(report.warnings.length
        ? ["", "PROVIDER WARNINGS", ...report.warnings]
        : []),
      `Google report: ${pageSpeedLink(report.url, report.strategy)}`,
    ]),
    "",
    "HOW TO USE THESE RESULTS",
    "Repeat tests under comparable conditions. A single Lighthouse score can vary and is not a Core Web Vitals field assessment.",
    "Use the provider's affected resources to investigate. Test changes and compare repeated runs; measure real users separately.",
    "Total Blocking Time is a lab metric and is never substituted for Interaction to Next Paint. A server-response-time audit is not used as a TTFB measurement.",
  ].join("\n");
}
