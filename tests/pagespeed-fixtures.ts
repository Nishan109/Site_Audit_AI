import {
  parsePageSpeed,
  type PageSpeedPayload,
} from "../src/lib/pagespeed-measurement";
import {
  pageSpeedResultSchema,
  type PageSpeedDevice,
} from "../src/lib/pagespeed";
export const url = "https://bakery.example/menu";
export const payload: PageSpeedPayload = {
  lighthouseResult: {
    requestedUrl: url,
    finalUrl: url,
    lighthouseVersion: "13.0.0",
    fetchTime: "2026-11-07T12:00:00.000Z",
    configSettings: { formFactor: "mobile", throttlingMethod: "simulate" },
    categories: { performance: { score: 0.82 } },
    audits: {
      "largest-contentful-paint": { numericValue: 3100 },
      "first-contentful-paint": { numericValue: 1200 },
      "cumulative-layout-shift": { numericValue: 0.04 },
      "total-blocking-time": { numericValue: 350 },
      "speed-index": { numericValue: 3500 },
      "server-response-time": { numericValue: 560 },
      "render-blocking-insight": {
        score: 0,
        title: "Render-blocking requests",
        description:
          "Requests can delay rendering. [Learn more](https://web.dev/).",
        metricSavings: { FCP: 300, LCP: 600 },
      },
      "unused-javascript": {
        score: 0.2,
        title: "Reduce unused JavaScript",
        description: "Reduce code that is not used on this page.",
        details: {
          type: "opportunity",
          overallSavingsMs: 250,
          overallSavingsBytes: 102400,
        },
      },
    },
  },
  loadingExperience: {
    id: url,
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2300 },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8 },
      INTERACTION_TO_NEXT_PAINT: { percentile: 190 },
      FIRST_CONTENTFUL_PAINT_MS: { percentile: 1500 },
      EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 640 },
    },
  },
};
export const report = (strategy: PageSpeedDevice = "mobile") =>
  pageSpeedResultSchema.parse(
    parsePageSpeed(
      {
        ...payload,
        lighthouseResult: {
          ...payload.lighthouseResult,
          configSettings: {
            ...payload.lighthouseResult?.configSettings,
            formFactor: strategy,
          },
        },
      },
      {
        url,
        strategy,
        analyzedAt: "2026-11-07T12:00:00.000Z",
      },
    ),
  );
