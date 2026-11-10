// Uses isolated API fixtures and the real application. No fixture route ships with the site.
// Optional driver: npm install --prefix node_modules/.cache/siteaudit-review-qa --no-audit --no-fund --package-lock=false playwright-core
// Run: node scripts/run-with-ca.mjs --import tsx scripts/verify-ux-ui.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { uxWorkspaceFixture } from "../tests/ux-workspace-fixtures.ts";
import { workspaceTextContrast } from "./browser-review-utils.mjs";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.cache/siteaudit-review-qa/node_modules/playwright-core");
const output = path.resolve("docs/verification/ux-workspace");
const baseURL = process.env.REVIEW_BASE_URL || "http://127.0.0.1:3000";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.REVIEW_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const errors = [],
  unexpected = [],
  checks = [];
let captures = 0;
async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage: true,
  });
  captures++;
}
async function navigate(page, section) {
  if (await page.locator("#report-section").isVisible())
    await page.locator("#report-section").selectOption(section);
  else
    await page
      .getByRole("button", {
        name: section === "ux" ? "User experience" : "Search optimization",
        exact: true,
      })
      .first()
      .click();
  await page
    .locator(`[data-review-workspace="${section}"]`)
    .waitFor({ state: "visible" });
}
async function choose(page, report, index) {
  if (await page.getByLabel("Choose a UX finding").isVisible())
    await page.getByLabel("Choose a UX finding").selectOption({ index });
  else
    await page
      .getByRole("button", {
        name: `Select UX finding ${index + 1}: ${report.ux[index].title}`,
        exact: true,
      })
      .click();
  await page
    .getByRole("heading", { name: report.ux[index].title, exact: true })
    .waitFor();
}
async function open(report, width, scale = 1) {
  const context = await browser.newContext({
    viewport: { width, height: scale === 2 ? 500 : 1000 },
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  let audits = 0,
    fixes = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (window.__denyCopy)
            throw new Error("Clipboard denied for verification");
          window.__copied = text;
        },
      },
    }),
  );
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/api/analyze") {
      audits++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...report,
          analysisId: `${report.analysisId}-${audits}`,
        }),
      });
    } else if (endpoint === "/api/fix-steps") {
      fixes++;
      await route.fulfill({
        status: fixes === 1 ? 502 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          fixes === 1
            ? { error: "Verification provider busy. Please retry." }
            : {
                steps: [
                  {
                    title: "Fixture implementation step",
                    description:
                      "Check the revised words on the collected page before publishing.",
                  },
                ],
              },
        ),
      });
    } else {
      unexpected.push(endpoint);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unexpected verification request" }),
      });
    }
  });
  await page.goto(baseURL, {
    waitUntil: "networkidle",
  });
  await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
  await page
    .getByLabel("Your website address", { exact: true })
    .fill(report.url);
  await page.getByLabel("Your website address", { exact: true }).press("Enter");
  await page
    .getByRole("heading", { level: 1, name: "bakery.example", exact: true })
    .waitFor();
  await navigate(page, "ux");
  await page.evaluate(() => {
    const marker = document.createElement("div");
    marker.textContent = "UI verification · illustrative test report";
    marker.style.cssText =
      "background:#182236;color:white;padding:7px 14px;font:12px/1.5 Inter,system-ui;text-align:center";
    document.body.prepend(marker);
  });
  return { context, page, counts: () => ({ audits, fixes }) };
}
try {
  const report = uxWorkspaceFixture();
  for (const { width, scale } of [
    ...[320, 390, 768, 900, 1024, 1280, 1440].map((width) => ({
      width,
      scale: 1,
    })),
    { width: 720, scale: 2 },
  ]) {
    const { context, page, counts } = await open(report, width, scale);
    const root = page.locator('[data-review-workspace="ux"]');
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.equal(await root.locator("[data-active-finding]").count(), 1);
    const contrast = await page.evaluate(workspaceTextContrast);
    assert.deepEqual(contrast.failures, []);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, `Page overflow at ${width}px`);
    await capture(page, `default-${width}${scale === 2 ? "-2x" : ""}`);
    checks.push({ width, scale, overflow, contrast });
    await choose(page, report, 1);
    await root.getByRole("button", { name: "High 2", exact: true }).click();
    await root
      .getByLabel("UX review area", { exact: true })
      .selectOption("forms");
    await root
      .getByText("Category assessments and strengths", { exact: true })
      .click();
    await navigate(page, "seo");
    assert.equal(await root.isVisible(), false);
    await navigate(page, "ux");
    assert.equal(
      await root
        .getByRole("button", { name: "High 2", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await root.getByLabel("UX review area", { exact: true }).inputValue(),
      "forms",
    );
    assert.equal(
      await root
        .getByText("Category assessments and strengths", { exact: true })
        .evaluate((el) => el.closest("details").open),
      true,
    );
    assert.equal(
      await root.locator("[data-active-finding] h3").innerText(),
      report.ux[1].title,
    );
    await root
      .getByRole("button", { name: "Copy UX plan", exact: true })
      .click();
    await root.getByText(/UX action plan copied/).waitFor();
    const copied = await page.evaluate(() => window.__copied);
    for (const issue of report.ux) assert.ok(copied.includes(issue.title));
    assert.ok(copied.includes("Not opened or tested"));
    assert.ok(copied.includes("BROWSER TESTING STILL NEEDED"));
    const downloadEvent = page.waitForEvent("download");
    await root
      .getByRole("button", { name: "Download UX plan (.txt)", exact: true })
      .click();
    const downloaded = await downloadEvent;
    assert.equal(
      downloaded.suggestedFilename(),
      "bakery.example-ux-action-plan.txt",
    );
    const content = await readFile(await downloaded.path(), "utf8");
    assert.equal(content, copied);
    await root.getByRole("button", { name: "Medium 2", exact: true }).click();
    await root
      .getByRole("heading", {
        name: "No findings match these filters",
        exact: true,
      })
      .waitFor();
    if (width === 1440) await capture(page, "filtered-empty-1440");
    await root
      .getByRole("button", { name: "Reset filters", exact: true })
      .first()
      .click();
    if (width === 1440) {
      await root
        .getByRole("button", {
          name: "Select UX finding 1: " + report.ux[0].title,
          exact: true,
        })
        .focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      assert.equal(
        await root.locator("[data-active-finding] h3").innerText(),
        report.ux[1].title,
      );
      const focus = await page.evaluate(() => ({
        outline: getComputedStyle(document.activeElement).outlineStyle,
        name: document.activeElement.getAttribute("aria-label"),
      }));
      assert.equal(focus.outline, "solid");
      assert.ok(focus.name.startsWith("Select UX finding 2"));
      await root
        .getByRole("button", { name: "Go to finding details", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() =>
          document.activeElement.hasAttribute("data-active-finding"),
        ),
        true,
      );
      await choose(page, report, 0);
      await root
        .getByText("More supporting observations (1)", { exact: true })
        .click();
      await root
        .getByText("Technical details", { exact: true })
        .first()
        .click();
      await capture(page, "expanded-evidence-1440");
      await navigate(page, "seo");
      await navigate(page, "ux");
      assert.equal(
        await root
          .getByText("More supporting observations (1)", { exact: true })
          .evaluate((el) => el.closest("details").open),
        true,
      );
      assert.equal(
        await root
          .getByText("Technical details", { exact: true })
          .first()
          .evaluate((el) => el.closest("details").open),
        true,
      );
      await root
        .getByText("Coverage and remaining checks", { exact: true })
        .click();
      for (const label of [
        "Navigation & findability",
        "Information structure",
        "Controls & next steps",
        "Form clarity",
      ]) {
        await root
          .locator("details")
          .filter({ has: page.locator(`summary > strong:text-is("${label}")`) })
          .last()
          .locator(":scope > summary")
          .click();
      }
      const coverageContrast = await page.evaluate(workspaceTextContrast);
      assert.deepEqual(coverageContrast.failures, []);
      checks.push({ expandedContrast: coverageContrast });
      await capture(page, "coverage-1440");
      await capture(page, "assessments-1440");
      await page.evaluate(() => {
        window.__denyCopy = true;
      });
      await root
        .getByRole("button", { name: "Copy UX plan", exact: true })
        .click();
      await root.getByText(/Copying is unavailable/).waitFor();
      await capture(page, "clipboard-failure-1440");
      await page
        .getByRole("button", { name: "Run again", exact: true })
        .click();
      await navigate(page, "ux");
      assert.equal(
        await root
          .getByRole("button", { name: "All 6", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await root.getByLabel("UX review area", { exact: true }).inputValue(),
        "all",
      );
      assert.equal(
        await root.locator("[data-active-finding] h3").innerText(),
        report.ux[0].title,
      );
      assert.equal(
        await root
          .getByText("Category assessments and strengths", { exact: true })
          .evaluate((el) => el.closest("details").open),
        false,
      );
      assert.deepEqual(counts(), { audits: 2, fixes: 0 });
    } else assert.deepEqual(counts(), { audits: 1, fixes: 0 });
    await context.close();
  }
  for (const state of [
    "empty",
    "legacy",
    "unassessed",
    "zero",
    "long-observation",
    "generation",
    "enlarged-text",
  ]) {
    const report = uxWorkspaceFixture();
    if (state === "empty") report.ux = [];
    if (state === "legacy") delete report.uxAnalysis;
    if (state === "unassessed")
      report.uxAnalysis.criteria.forEach((item) => {
        item.score = null;
      });
    if (state === "zero")
      report.uxAnalysis.criteria.forEach((item) => {
        item.score = 0;
      });
    if (state === "long-observation") {
      report.ux[0].title =
        "Review the declared collection destination and its complete recorded source context";
      report.ux[0].uxEvidence[0].observation = JSON.stringify({
        name: "Review collection details and opening hours ".repeat(8),
        destination:
          report.url + "collection/" + "long-recorded-path/".repeat(18),
        nameFrom: "element content",
      });
    }
    if (state === "generation") report.ux[0].fixSteps = [];
    const width = state === "generation" ? 1440 : state === "enlarged-text" ? 1024 : 390;
    const { context, page, counts } = await open(report, width);
    const root = page.locator('[data-review-workspace="ux"]');
    if (state === "enlarged-text") {
      await root.evaluate((element) => {
        const sizes = [...element.querySelectorAll("*")].map((node) => [node, parseFloat(getComputedStyle(node).fontSize)]);
        for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
      });
    }
    if (state === "empty") {
      await root
        .getByRole("button", {
          name: "Review assessment coverage",
          exact: true,
        })
        .click();
      assert.equal(
        await root
          .getByText("Category assessments and strengths", { exact: true })
          .evaluate((el) => el.closest("details").open),
        true,
      );
    }
    if (state === "zero" || state === "unassessed") {
      const summary = root.getByRole("region", {
        name: "User experience review snapshot",
      });
      assert.ok(
        (await summary.innerText()).includes(
          state === "zero" ? "0\n/100" : "Not assessed",
        ),
      );
    }
    if (state === "generation") {
      await root
        .getByRole("button", { name: "Generate action plan", exact: true })
        .click();
      await root
        .getByRole("alert")
        .filter({ hasText: "Verification provider busy" })
        .waitFor();
      assert.ok(
        await root
          .getByRole("region", { name: "Observed in the collected page" })
          .getByText("Explore", { exact: true })
          .isVisible(),
      );
      await capture(page, "generation-failure-1440");
      await root
        .getByRole("button", { name: "Retry action plan", exact: true })
        .click();
      await root
        .locator("[data-active-finding]")
        .getByRole("heading", {
          name: "Fixture implementation step",
          exact: true,
        })
        .waitFor();
      await root
        .getByRole("button", { name: "Copy UX plan", exact: true })
        .click();
      await root.getByText(/UX action plan copied/).waitFor();
      assert.ok(
        (await page.evaluate(() => window.__copied)).includes(
          "Fixture implementation step",
        ),
      );
      assert.deepEqual(counts(), { audits: 1, fixes: 2 });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    const contrast = await page.evaluate(workspaceTextContrast);
    assert.deepEqual(contrast.failures, []);
    checks.push({ state, width, contrast });
    await capture(page, `${state}-${width}`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  const results = {
    baseURL,
    recordedAt: new Date().toISOString(),
    fixtureOnly: true,
    screenshots: captures,
    checks,
    browserErrors: errors,
    unexpectedRequests: unexpected,
    selection: "passed",
    keyboard: "passed",
    navigationRetention: "passed",
    newReportReset: "passed",
    completeExport: "passed",
    browserTextDownload: "passed",
    clipboardFailure: "passed",
    generationRetry: "passed",
  };
  await writeFile(
    path.join(output, "checks.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ ...results, checks: checks.length, output }));
} finally {
  await browser.close();
}
