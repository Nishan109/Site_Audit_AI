import { z } from "zod";
import type { PageSpeedMetric } from "./types";
import type { PageSpeedDevice, PageSpeedReport } from "./pagespeed";

export function pageSpeedMetric(
  value: unknown,
  metric: string,
  strategy: PageSpeedDevice = "mobile",
): PageSpeedMetric {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    cls: [0.1, 0.25],
    inp: [200, 500],
    fcp: [1800, 3000],
    ttfb: [800, 1800],
    tbt: strategy === "desktop" ? [150, 350] : [200, 600],
    si: strategy === "desktop" ? [1300, 2300] : [3400, 5800],
  };
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !thresholds[metric]
  )
    return {
      value: null,
      unit: metric === "cls" ? "" : "ms",
      rating: "unavailable",
    };
  const [good, poor] = thresholds[metric];
  return {
    value:
      metric === "cls" ? Math.round(value * 1000) / 1000 : Math.round(value),
    unit: metric === "cls" ? "" : "ms",
    rating:
      value <= good ? "good" : value <= poor ? "needs-improvement" : "poor",
  };
}
const auditSchema = z.object({
  numericValue: z.number().optional(),
  score: z.number().nullable().optional(),
  scoreDisplayMode: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  displayValue: z.string().optional(),
  details: z
    .object({
      type: z.string().optional(),
      overallSavingsMs: z.number().optional(),
      overallSavingsBytes: z.number().optional(),
      metricSavings: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
  metricSavings: z.record(z.string(), z.number()).optional(),
});
const experienceSchema = z.object({
  id: z.string().optional(),
  metrics: z
    .record(z.string(), z.object({ percentile: z.number().optional() }))
    .optional(),
});
export const pageSpeedPayloadSchema = z.object({
  lighthouseResult: z
    .object({
      requestedUrl: z.string().optional(),
      finalUrl: z.string().optional(),
      finalDisplayedUrl: z.string().optional(),
      gatherMode: z.string().optional(),
      lighthouseVersion: z.string().optional(),
      fetchTime: z.string().optional(),
      runtimeError: z.object({ code: z.string().optional() }).optional(),
      runWarnings: z.array(z.string()).optional(),
      configSettings: z
        .object({
          formFactor: z.string().optional(),
          emulatedFormFactor: z.string().optional(),
          throttlingMethod: z.string().optional(),
        })
        .optional(),
      categories: z
        .object({
          performance: z
            .object({ score: z.number().nullable().optional() })
            .optional(),
        })
        .optional(),
      audits: z.record(z.string(), auditSchema).optional(),
    })
    .optional(),
  loadingExperience: experienceSchema.optional(),
  originLoadingExperience: experienceSchema.optional(),
});
export type PageSpeedPayload = z.infer<typeof pageSpeedPayloadSchema>;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const plain = (text: string) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_]/g, "")
    .trim()
    .slice(0, 1400);
const fieldKeys = {
  lcp: "LARGEST_CONTENTFUL_PAINT_MS",
  cls: "CUMULATIVE_LAYOUT_SHIFT_SCORE",
  inp: "INTERACTION_TO_NEXT_PAINT",
  fcp: "FIRST_CONTENTFUL_PAINT_MS",
  ttfb: "EXPERIMENTAL_TIME_TO_FIRST_BYTE",
} as const;
export function parsePageSpeed(
  data: PageSpeedPayload,
  options: {
    url?: string;
    strategy?: PageSpeedDevice;
    analyzedAt?: string;
  } = {},
) {
  const lighthouse = data.lighthouseResult;
  const strategy = options.strategy || "mobile";
  const audits = lighthouse?.runtimeError ? {} : lighthouse?.audits || {};
  const score = lighthouse?.runtimeError
    ? null
    : lighthouse?.categories?.performance?.score;
  const labValue = (id: string, metric: string) =>
    pageSpeedMetric(
      audits[id]?.scoreDisplayMode === "error"
        ? undefined
        : audits[id]?.numericValue,
      metric,
      strategy,
    );
  const validExperience = (item: PageSpeedPayload["loadingExperience"]) =>
    Object.values(fieldKeys).some((key) =>
      finite(item?.metrics?.[key]?.percentile),
    );
  const experience = validExperience(data.loadingExperience)
    ? data.loadingExperience
    : validExperience(data.originLoadingExperience)
      ? data.originLoadingExperience
      : undefined;
  const id = experience?.id || null;
  let scope: PageSpeedReport["field"]["scope"] = !experience
    ? "unavailable"
    : experience === data.originLoadingExperience
      ? "origin"
      : "page";
  if (experience && id) {
    try {
      if (id === new URL(id).origin) scope = "origin";
    } catch {
      /* Keep provider collection scope. */
    }
  }
  const fieldValue = (key: keyof typeof fieldKeys) => {
    const value = experience?.metrics?.[fieldKeys[key]]?.percentile;
    return pageSpeedMetric(
      key === "cls" && finite(value) ? value / 100 : value,
      key,
    );
  };
  const field = {
    scope,
    id,
    assessment: "unavailable" as PageSpeedReport["field"]["assessment"],
    lcp: fieldValue("lcp"),
    cls: fieldValue("cls"),
    inp: fieldValue("inp"),
    fcp: fieldValue("fcp"),
    ttfb: fieldValue("ttfb"),
  };
  const vitals = [field.lcp, field.cls, field.inp];
  if (vitals.every((item) => item.value !== null))
    field.assessment = vitals.every((item) => item.rating === "good")
      ? "passed"
      : "needs-improvement";
  const warnings = (lighthouse?.runWarnings || [])
    .map(plain)
    .filter(Boolean)
    .slice(0, 8);
  if (lighthouse?.runtimeError)
    warnings.unshift(
      "Google could not complete the Lighthouse lab test. Any available field data is shown separately; lab metrics were withheld.",
    );
  const result: PageSpeedReport = {
    method: "google-pagespeed-v2",
    isSimulated: false,
    url: options.url || lighthouse?.requestedUrl || "",
    finalUrl:
      lighthouse?.finalDisplayedUrl ||
      lighthouse?.finalUrl ||
      options.url ||
      lighthouse?.requestedUrl ||
      "",
    strategy,
    analyzedAt: options.analyzedAt || new Date().toISOString(),
    fetchTime: lighthouse?.fetchTime || null,
    lighthouseVersion: lighthouse?.lighthouseVersion || null,
    performanceScore:
      finite(score) && score <= 1 ? Math.round(score * 100) : null,
    lab: {
      lcp: labValue("largest-contentful-paint", "lcp"),
      cls: labValue("cumulative-layout-shift", "cls"),
      fcp: labValue("first-contentful-paint", "fcp"),
      speedIndex: labValue("speed-index", "si"),
      tbt: labValue("total-blocking-time", "tbt"),
    },
    field,
    opportunities: Object.entries(audits)
      .flatMap(([id, audit]) => {
        if (audit.scoreDisplayMode === "error") return [];
        const savings =
          audit.metricSavings || audit.details?.metricSavings || {};
        const savingsMs = finite(audit.details?.overallSavingsMs)
          ? audit.details.overallSavingsMs
          : null;
        const savingsBytes = finite(audit.details?.overallSavingsBytes)
          ? audit.details.overallSavingsBytes
          : null;
        const modernInsight = id.endsWith("-insight") && audit.score === 0;
        if (
          !(
            (savingsMs !== null && savingsMs > 0) ||
            (savingsBytes !== null && savingsBytes > 0) ||
            modernInsight
          )
        )
          return [];
        return [
          {
            id,
            title: plain(audit.title || id),
            description: plain(audit.description || ""),
            savingsMs,
            savingsBytes,
            metricSavings: Object.keys(savings)
              .filter(
                (key) =>
                  ["LCP", "FCP", "INP", "TBT", "CLS", "SI", "TTFB"].includes(
                    key,
                  ) &&
                  finite(savings[key]) &&
                  savings[key] > 0,
              )
              .map((metric) => ({
                metric,
                value: savings[metric],
                unit: metric === "CLS" ? ("" as const) : ("ms" as const),
              })),
            displayValue: plain(audit.displayValue || ""),
          },
        ];
      })
      .sort(
        (a, b) =>
          (b.savingsMs || 0) - (a.savingsMs || 0) ||
          (b.savingsBytes || 0) - (a.savingsBytes || 0),
      )
      .slice(0, 10),
    warnings,
    environment: {
      formFactor:
        lighthouse?.configSettings?.formFactor ||
        lighthouse?.configSettings?.emulatedFormFactor ||
        null,
      throttlingMethod: lighthouse?.configSettings?.throttlingMethod || null,
    },
  };
  // Compatibility for parser consumers; the API returns the separate lab/field report.
  return {
    ...result,
    lcp: result.lab.lcp,
    cls: result.lab.cls,
    inp: field.inp,
    fcp: result.lab.fcp,
    ttfb: field.ttfb,
    speedIndex: result.lab.speedIndex,
  };
}
