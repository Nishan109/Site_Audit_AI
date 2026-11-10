// Uses isolated API fixtures and the real application. No fixture route ships with the site.
// Optional driver: npm install --prefix node_modules/.cache/siteaudit-review-qa --no-audit --no-fund --package-lock=false playwright-core
// Run: node scripts/run-with-ca.mjs --import tsx scripts/verify-messaging-ui.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { specialistFixture } from "../tests/review-workspace-fixtures.ts";
import { workspaceTextContrast } from "./browser-review-utils.mjs";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.cache/siteaudit-review-qa/node_modules/playwright-core");
const output = path.resolve("docs/verification/messaging-editor");
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
        name:
          section === "messaging" ? "Messaging & copy" : "Search optimization",
        exact: true,
      })
      .first()
      .click();
  await page
    .locator(`[data-review-workspace="${section}"]`)
    .waitFor({ state: "visible" });
}
async function choose(page, report, index) {
  if (await page.getByLabel("Choose a messaging finding").isVisible())
    await page.getByLabel("Choose a messaging finding").selectOption({ index });
  else
    await page
      .getByRole("button", {
        name: `Select finding ${index + 1}: ${report.messaging[index].title}`,
        exact: true,
      })
      .click();
  await page
    .getByRole("heading", { name: report.messaging[index].title, exact: true })
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
  await page.goto(process.env.REVIEW_BASE_URL || "http://127.0.0.1:3000", {
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
  await navigate(page, "messaging");
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
  const report = specialistFixture();
  for (const { width, scale } of [
    ...[320, 390, 768, 900, 1024, 1280, 1440].map((width) => ({
      width,
      scale: 1,
    })),
    { width: 720, scale: 2 },
  ]) {
    const { context, page, counts } = await open(report, width, scale);
    const contrast = await page.evaluate(workspaceTextContrast);
    assert.deepEqual(contrast.failures, []);
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.equal(await page.locator("[data-active-finding]").count(), 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    assert.equal(overflow, false, `Overflow at ${width}px`);
    const order = await page
      .locator("[data-active-finding]")
      .evaluate((element) => {
        const editor = element.querySelector(
          'section[aria-label^="Wording option"]',
        );
        const steps = [...element.querySelectorAll("summary")].find((node) =>
          node.textContent.includes("Implementation steps"),
        );
        return !!(
          editor.compareDocumentPosition(steps) &
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      });
    assert.equal(order, true);
    assert.deepEqual(counts(), { audits: 1, fixes: 0 });
    await capture(page, `messaging-${scale === 2 ? "zoom-200" : width}`);
    checks.push({
      width,
      deviceScale: scale,
      zoomEquivalent:
        scale === 2 ? "200% reflow on a 1440px canvas" : undefined,
      overflow: false,
      minimumTextContrast: contrast.minimum,
      editorBeforeSteps: true,
    });
    if (width === 390) {
      await page
        .getByText("Supporting facts for this draft", { exact: true })
        .click();
      await capture(page, "supporting-facts-390");
      await choose(page, report, 2);
      assert.equal(
        await page.getByRole("textbox", { name: /Wording draft/ }).count(),
        0,
      );
      await capture(page, "no-wording-option-390");
    }
    if (width === 1440) {
      const score = await page
        .getByRole("meter", { name: "Messaging and copy assessment" })
        .getAttribute("aria-valuenow");
      const secondChoice = page.getByRole("button", {
        name: `Select finding 2: ${report.messaging[1].title}`,
        exact: true,
      });
      await secondChoice.press("Enter");
      assert.equal(await secondChoice.getAttribute("aria-pressed"), "true");
      await page
        .getByRole("heading", { name: report.messaging[1].title, exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: `Select finding 1: ${report.messaging[0].title}`,
          exact: true,
        })
        .press("Enter");
      await page.keyboard.press("Tab");
      const edit = page.getByRole("button", {
        name: "Edit draft",
        exact: true,
      });
      await edit.focus();
      assert.ok(
        await edit.evaluate(
          (element) => parseFloat(getComputedStyle(element).outlineWidth) >= 2,
        ),
      );
      await edit.press("Enter");
      assert.equal(
        await page
          .getByRole("textbox", { name: /Wording draft/ })
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page
        .getByRole("textbox", { name: /Wording draft/ })
        .fill("My first reviewed draft.");
      await choose(page, report, 1);
      await page
        .getByRole("textbox", { name: /Wording draft/ })
        .fill("My second reviewed draft.");
      await navigate(page, "seo");
      await navigate(page, "messaging");
      assert.equal(
        await page.getByRole("textbox", { name: /Wording draft/ }).inputValue(),
        "My second reviewed draft.",
      );
      await choose(page, report, 0);
      assert.equal(
        await page.getByRole("textbox", { name: /Wording draft/ }).inputValue(),
        "My first reviewed draft.",
      );
      assert.equal(
        await page
          .getByRole("meter", { name: "Messaging and copy assessment" })
          .getAttribute("aria-valuenow"),
        score,
      );
      await capture(page, "edited-draft-1440");
      await page.getByRole("button", { name: "High 1", exact: true }).click();
      await page
        .getByRole("button", { name: "Copy full plan", exact: true })
        .click();
      const copied = await page.evaluate(() => window.__copied);
      for (const text of [
        "My first reviewed draft.",
        "My second reviewed draft.",
        report.messaging[2].title,
        report.url,
        "not reviewed by AI",
      ])
        assert.ok(copied.includes(text));
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download messaging plan", exact: true })
        .click();
      const downloaded = await pending;
      const file = path.join(output, downloaded.suggestedFilename());
      await downloaded.saveAs(file);
      assert.equal(await readFile(file, "utf8"), copied);
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .click();
      await page.getByText(/^More filters/).click();
      await page
        .getByLabel("Copy improvement focus area")
        .selectOption("consistency");
      await page
        .getByRole("button", { name: "With wording options 2", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "No improvements match these filters.",
          exact: true,
        })
        .waitFor();
      await capture(page, "filtered-empty-1440");
      await page
        .getByRole("button", { name: "Show all improvements", exact: true })
        .click();
      await page.evaluate(() => {
        window.__denyCopy = true;
      });
      await page
        .getByRole("button", { name: "Copy wording", exact: true })
        .click();
      await page.getByText(/Copying is unavailable/).waitFor();
      await capture(page, "clipboard-failure-1440");
      await page.evaluate(() => {
        window.__denyCopy = false;
      });
      await page
        .getByRole("button", { name: "Restore suggestion", exact: true })
        .click();
      assert.equal(
        await page.getByRole("textbox", { name: /Wording draft/ }).inputValue(),
        report.messaging[0].copySuggestion.replacement,
      );
      await page
        .getByRole("button", { name: "Run again", exact: true })
        .click();
      await navigate(page, "messaging");
      assert.equal(
        await page.getByRole("textbox", { name: /Wording draft/ }).inputValue(),
        report.messaging[0].copySuggestion.replacement,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "All 3", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.deepEqual(counts(), { audits: 2, fixes: 0 });
    }
    await context.close();
  }
  for (const state of ["empty", "legacy", "long-copy", "generation"]) {
    const report = specialistFixture();
    if (state === "empty") {
      report.messaging = [];
      report.quickWins = report.quickWins.filter(
        (win) => win.category !== "messaging",
      );
    }
    if (state === "legacy") delete report.messagingAnalysis;
    if (state === "long-copy") {
      report.messaging[0].copySuggestion.original =
        "This collected example includes a longer description of the Saturday collection service in Bath. ".repeat(
          7,
        );
      report.messaging[0].messagingEvidence[0].quote =
        report.messaging[0].copySuggestion.original;
      report.messaging[0].detail =
        "The collected wording provides a detailed explanation of the offering. Review the full wording in context when making this editorial change. ".repeat(
          4,
        );
      report.messaging[0].title =
        "Review a longer collected message without losing its source context or collection details";
    }
    if (state === "generation") report.messaging[0].fixSteps = undefined;
    const { context, page, counts } = await open(
      report,
      state === "generation" ? 1440 : 390,
    );
    if (state === "empty") {
      await page
        .getByRole("button", { name: "Review assessment & scope", exact: true })
        .click();
      assert.equal(
        await page
          .getByText("Assessment details", { exact: true })
          .evaluate((element) => element.closest("details").open),
        true,
      );
    }
    if (state === "long-copy") {
      await page
        .getByRole("button", { name: "Read full current copy", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Show less current copy", exact: true })
          .getAttribute("aria-expanded"),
        "true",
      );
      await page
        .getByRole("button", { name: "Read full explanation", exact: true })
        .click();
    }
    if (state === "generation") {
      await page
        .getByRole("textbox", { name: /Wording draft/ })
        .fill("Retain this draft through a failed generation.");
      await page.getByText("Implementation steps", { exact: true }).click();
      await page
        .getByRole("button", { name: "Generate action plan", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Verification provider busy" })
        .waitFor();
      await capture(page, "generation-failure-1440");
      await page
        .getByRole("button", { name: "Retry action plan", exact: true })
        .click();
      await page
        .locator("[data-active-finding]")
        .getByRole("heading", {
          name: "Fixture implementation step",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page.getByRole("textbox", { name: /Wording draft/ }).inputValue(),
        "Retain this draft through a failed generation.",
      );
      assert.deepEqual(counts(), { audits: 1, fixes: 2 });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await capture(page, `${state}-${state === "generation" ? 1440 : 390}`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  const results = {
    fixtureOnly: true,
    screenshots: captures,
    checks,
    browserErrors: errors,
    unexpectedRequests: unexpected,
    selection: "passed",
    keyboard: "passed",
    navigationRetention: "passed",
    newReportReset: "passed",
    fullDraftAwareExport: "passed",
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
