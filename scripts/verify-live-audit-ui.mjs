// Explicit live-provider verification; supply the public URL to review.
// Uses the same isolated optional playwright-core dependency as verify-ux-ui.mjs.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.cache/siteaudit-review-qa/node_modules/playwright-core");
const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target))
  throw new Error(
    "Supply a public HTTP(S) URL. This script performs a real audit using the configured provider.",
  );
const baseURL = process.env.REVIEW_BASE_URL || "http://127.0.0.1:3001";
const output = path.resolve(
  process.env.REVIEW_OUTPUT_DIR || "docs/verification/audit-recovery",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.REVIEW_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const started = Date.now();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const fetchRequest = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await fetchRequest(input, init);
      if (
        typeof input === "string" &&
        new URL(input, location.href).pathname === "/api/analyze"
      ) {
        void response
          .clone()
          .text()
          .then(
            (text) => {
              window.__verifiedAuditWire = { text };
            },
            (error) => {
              window.__verifiedAuditWire = { error: error.name };
            },
          );
      }
      return response;
    };
  });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/analyze" &&
      response.request().method() === "POST",
    { timeout: 175000 },
  );
  await page.getByLabel("Your website address", { exact: true }).fill(target);
  await page.getByLabel("Your website address", { exact: true }).press("Enter");
  const response = await responsePromise;
  const streamed = response
    .headers()
    ["content-type"]?.startsWith("application/x-ndjson");
  await page.waitForFunction(() => !!window.__verifiedAuditWire, undefined, {
    timeout: 175000,
  });
  const wire = await page.evaluate(() => window.__verifiedAuditWire);
  assert.ok(
    wire.text,
    `Audit response could not be read (${wire.error || "empty body"})`,
  );
  const events = streamed
    ? wire.text
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
    : [];
  const terminal = events.at(-1);
  const report = streamed ? terminal?.report : JSON.parse(wire.text);
  if (!response.ok() || !report) {
    await page.screenshot({
      path: path.join(output, "live-error-1440.png"),
      fullPage: true,
    });
    throw new Error(
      `Live audit failed: HTTP ${response.status()}, ${terminal?.code || report?.code || "ANALYSIS_FAILED"}`,
    );
  }
  assert.equal(report.dataSource, "live");
  if (streamed) {
    assert.equal(terminal.type, "run_completed");
    assert.ok(events.some((event) => event.type === "stage_started"));
    assert.ok(events.every((event, index) => event.sequence === index + 1));
    assert.ok(report.initialReviewTiming?.stages.length);
  }
  assert.ok(report.analysisId);
  assert.ok(
    report.pagesAnalyzed.some((page) => page.url === new URL(target).href),
  );
  assert.ok(
    report.agentSteps.some(
      (step) =>
        step.name === "Report Validation" && step.status === "completed",
    ),
  );
  const domain = new URL(report.url).hostname.replace(/^www\./, "");
  await page
    .getByRole("heading", { level: 1, name: domain, exact: true })
    .waitFor();
  await page.evaluate((timestamp) => {
    const marker = document.createElement("div");
    marker.textContent = `Live audit verification · evidence collected ${timestamp}`;
    marker.style.cssText =
      "background:#182236;color:white;padding:7px 14px;font:12px/1.5 Inter,system-ui;text-align:center";
    document.body.prepend(marker);
  }, report.analyzedAt);
  await page.screenshot({
    path: path.join(output, "live-success-1440.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "User experience", exact: true })
    .first()
    .click();
  await page
    .locator('[data-review-workspace="ux"]')
    .waitFor({ state: "visible" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(output, "live-ux-1440.png"),
    fullPage: true,
  });
  assert.deepEqual(pageErrors, []);
  const result = {
    url: report.url,
    baseURL,
    status: response.status(),
    progressEvents: events.length,
    seconds: Math.round((Date.now() - started) / 1000),
    analyzedAt: report.analyzedAt,
    dataSource: report.dataSource,
    modelUsed: report.modelUsed,
    pages: report.pagesAnalyzed.length,
    findings: {
      messaging: report.messaging.length,
      ux: report.ux.length,
      seo: report.seo.length,
      conversion: report.conversion.length,
    },
    scores: report.scores,
    research: report.agentSteps.find((step) => step.name === "Research Agent")
      ?.status,
    validation: "completed",
    pageErrors,
  };
  await writeFile(
    path.join(output, "live-checks.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
