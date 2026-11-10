import { z } from "zod";
import {
  parsePageSpeed,
  pageSpeedPayloadSchema,
} from "./pagespeed-measurement";
import {
  hasPageSpeedMeasurements,
  pageSpeedResultSchema,
  type PageSpeedDevice,
} from "./pagespeed";
import { sourceURL } from "./source-url";

export const MAX_LIGHTHOUSE_FILE_SIZE = 10 * 1024 * 1024;
const testTime = z.string().datetime({ offset: true });

export function importLighthouseReport(
  text: string,
  url: string,
  strategy: PageSpeedDevice,
) {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Choose a valid Lighthouse JSON report.");
  }

  const parsed = pageSpeedPayloadSchema.safeParse({ lighthouseResult: raw });
  const run = parsed.success ? parsed.data.lighthouseResult : undefined;
  if (
    !run?.lighthouseVersion ||
    !run.fetchTime ||
    !testTime.safeParse(run.fetchTime).success
  )
    throw new Error(
      "Choose the JSON file saved from a Lighthouse report with its original test time.",
    );
  if (
    run.runtimeError ||
    (run.gatherMode && run.gatherMode !== "navigation") ||
    !run.categories?.performance
  )
    throw new Error(
      "Run a completed Lighthouse Navigation test with Performance selected, then save it as JSON.",
    );

  const requested = sourceURL(run.requestedUrl ?? "");
  const final = sourceURL(run.finalDisplayedUrl ?? run.finalUrl ?? "");
  const target = sourceURL(url);
  if (
    !target ||
    !requested ||
    !final ||
    (target !== requested && target !== final)
  )
    throw new Error(
      "This report is for a different page. Run Lighthouse on the exact page shown in your audit.",
    );
  if (
    (run.configSettings?.formFactor ??
      run.configSettings?.emulatedFormFactor) !== strategy
  )
    throw new Error(
      `This file does not match the selected ${strategy} device. Select the matching device or run Lighthouse again.`,
    );

  const result = parsePageSpeed(
    { lighthouseResult: run },
    {
      url,
      strategy,
      analyzedAt: new Date(run.fetchTime).toISOString(),
    },
  );
  const report = pageSpeedResultSchema.safeParse({
    ...result,
    finalUrl: final,
    method: "lighthouse-import-v1",
  });
  if (!report.success || !hasPageSpeedMeasurements(report.data))
    throw new Error(
      "This report contains no usable performance measurements. Run a new Lighthouse test and export its JSON.",
    );
  return report.data;
}
