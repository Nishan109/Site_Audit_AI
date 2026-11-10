import { z } from "zod";
import { sourceURL } from "./source-url";
export const PAGE_SPEED_KEY_CHANNEL = "siteaudit-pagespeed-key";
export const PAGE_SPEED_DEVICES = ["mobile", "desktop"] as const;
export type PageSpeedDevice = (typeof PAGE_SPEED_DEVICES)[number];
export const PAGE_SPEED_RATINGS = {
  good: "Good",
  "needs-improvement": "Needs improvement",
  poor: "Poor",
  unavailable: "Unavailable",
} as const;
export const metricSchema = z
  .object({
    value: z.number().finite().nonnegative().nullable(),
    unit: z.enum(["", "ms"]),
    rating: z.enum(["good", "needs-improvement", "poor", "unavailable"]),
  })
  .refine((item) =>
    item.value === null
      ? item.rating === "unavailable"
      : item.rating !== "unavailable",
  );
const httpURL = z
  .string()
  .url()
  .refine((value) => sourceURL(value) !== null);
export const pageSpeedResultSchema = z
  .object({
    method: z.enum(["google-pagespeed-v2", "lighthouse-import-v1"]),
    isSimulated: z.literal(false),
    url: httpURL,
    finalUrl: httpURL,
    strategy: z.enum(PAGE_SPEED_DEVICES),
    analyzedAt: z.string().datetime(),
    fetchTime: z.string().nullable(),
    lighthouseVersion: z.string().nullable(),
    performanceScore: z.number().int().min(0).max(100).nullable(),
    lab: z.object({
      lcp: metricSchema,
      cls: metricSchema,
      fcp: metricSchema,
      speedIndex: metricSchema,
      tbt: metricSchema,
    }),
    field: z.object({
      scope: z.enum(["page", "origin", "unavailable"]),
      id: z.string().nullable(),
      assessment: z.enum(["passed", "needs-improvement", "unavailable"]),
      lcp: metricSchema,
      cls: metricSchema,
      inp: metricSchema,
      fcp: metricSchema,
      ttfb: metricSchema,
    }),
    opportunities: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          savingsMs: z.number().finite().nonnegative().nullable(),
          savingsBytes: z.number().finite().nonnegative().nullable(),
          metricSavings: z.array(
            z.object({
              metric: z.string(),
              value: z.number().finite().nonnegative(),
              unit: z.enum(["ms", ""]),
            }),
          ),
          displayValue: z.string(),
        }),
      )
      .max(10),
    warnings: z.array(z.string()),
    environment: z.object({
      formFactor: z.string().nullable(),
      throttlingMethod: z.string().nullable(),
    }),
  })
  .superRefine((report, context) => {
    for (const group of ["lab", "field"] as const) {
      for (const [name, value] of Object.entries(report[group])) {
        if (typeof value !== "object" || value === null || !("unit" in value))
          continue;
        if (value.unit !== (name === "cls" ? "" : "ms"))
          context.addIssue({
            code: "custom",
            path: [group, name, "unit"],
            message: "The metric unit does not match its identity.",
          });
      }
    }
    const vitals = [report.field.lcp, report.field.inp, report.field.cls];
    if (
      report.method === "lighthouse-import-v1" &&
      report.field.scope !== "unavailable"
    )
      context.addIssue({
        code: "custom",
        path: ["field", "scope"],
        message: "A Lighthouse file contains lab measurements only.",
      });
    const expectedAssessment = vitals.some((item) => item.value === null)
      ? "unavailable"
      : vitals.every((item) => item.rating === "good")
        ? "passed"
        : "needs-improvement";
    if (report.field.assessment !== expectedAssessment)
      context.addIssue({
        code: "custom",
        path: ["field", "assessment"],
        message:
          "The field assessment must match the complete supplied Core Web Vitals.",
      });
    const hasFieldMeasurements = [
      report.field.lcp,
      report.field.inp,
      report.field.cls,
      report.field.fcp,
      report.field.ttfb,
    ].some((item) => item.value !== null);
    if ((report.field.scope === "unavailable") === hasFieldMeasurements)
      context.addIssue({
        code: "custom",
        path: ["field", "scope"],
        message:
          "Field collection scope must match the available measurements.",
      });
  });
export type PageSpeedReport = z.infer<typeof pageSpeedResultSchema>;
export function validatedPageSpeedReports(
  reports: Partial<Record<PageSpeedDevice, PageSpeedReport>> | undefined,
  url: string,
) {
  return PAGE_SPEED_DEVICES.flatMap((device) => {
    const parsed = pageSpeedResultSchema.safeParse(reports?.[device]);
    return parsed.success &&
      parsed.data.url === url &&
      parsed.data.strategy === device &&
      hasPageSpeedMeasurements(parsed.data)
      ? [parsed.data]
      : [];
  });
}
export function hasPageSpeedMeasurements(report: PageSpeedReport) {
  return (
    report.performanceScore !== null ||
    [
      ...Object.values(report.lab),
      report.field.lcp,
      report.field.cls,
      report.field.inp,
      report.field.fcp,
      report.field.ttfb,
    ].some((metric) => metric.value !== null)
  );
}
export type PageSpeedValue = z.infer<typeof metricSchema>;
export function pageSpeedLink(url: string, strategy: PageSpeedDevice) {
  const target = new URL("https://pagespeed.web.dev/analysis");
  target.searchParams.set("url", url);
  target.searchParams.set("form_factor", strategy);
  return target.href;
}
export const FIELD_METRICS = [
  {
    key: "lcp",
    label: "LCP",
    title: "Largest Contentful Paint",
    explanation: "How quickly the largest visible content appears.",
    target: "≤ 2.5 s",
  },
  {
    key: "inp",
    label: "INP",
    title: "Interaction to Next Paint",
    explanation: "How quickly the page responds to user interactions.",
    target: "≤ 200 ms",
  },
  {
    key: "cls",
    label: "CLS",
    title: "Cumulative Layout Shift",
    explanation: "How much visible content unexpectedly shifts.",
    target: "≤ 0.1",
  },
] as const;
export const LAB_METRICS = [
  {
    key: "lcp",
    label: "LCP",
    title: "Largest Contentful Paint",
    explanation: "When the largest content appears in this controlled test.",
  },
  {
    key: "fcp",
    label: "FCP",
    title: "First Contentful Paint",
    explanation: "When the test first renders text or an image.",
  },
  {
    key: "cls",
    label: "CLS",
    title: "Cumulative Layout Shift",
    explanation: "Unexpected layout shifts during the tested page load.",
  },
  {
    key: "tbt",
    label: "TBT",
    title: "Total Blocking Time",
    explanation: "Main-thread blocking during lab load. This is not INP.",
  },
  {
    key: "speedIndex",
    label: "SI",
    title: "Speed Index",
    explanation: "How quickly the visible page fills in during the test.",
  },
] as const;
export const PAGESPEED_GUIDANCE = [
  {
    label: "About PageSpeed Insights",
    url: "https://developers.google.com/speed/docs/insights/v5/about",
  },
  { label: "Core Web Vitals", url: "https://web.dev/articles/vitals" },
  {
    label: "Lighthouse scoring",
    url: "https://developer.chrome.com/docs/lighthouse/performance/performance-scoring",
  },
];
export function formatPageSpeedValue(metric: PageSpeedValue) {
  if (metric.value === null) return "Unavailable";
  if (metric.unit === "") return String(metric.value);
  return metric.value < 1000
    ? `${Math.round(metric.value)} ms`
    : `${(metric.value / 1000).toFixed(metric.value % 10 === 0 ? 2 : 3)} s`;
}
