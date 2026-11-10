// Controlled UI verification. Uses the optional Playwright cache documented in verify-review-ui.mjs.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { specialistFixture } from "../tests/review-workspace-fixtures.ts";
import { workspaceTextContrast } from "./browser-review-utils.mjs";

const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.cache/siteaudit-review-qa/node_modules/playwright-core");
const output = path.resolve("docs/verification/seo-workspace");
const baseURL = process.env.REVIEW_BASE_URL || "http://127.0.0.1:3001";
const errors = [];
const unexpected = [];
const checks = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.REVIEW_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

function fixture() {
  const report = specialistFixture();
  const analysis = report.seoAnalysis;
  const first = analysis.pages[0];
  const second = {
    ...first,
    url: `${first.url}?edition=archive`,
    titles: ["Acorn Bakery collection archive", "Alternate archived title"],
    descriptions: [],
    headersChecked: false,
    responseStatus: null,
    canonicals: [],
    structured: { ...first.structured, jsonLdBlocks: 1, invalidJsonLd: 1 },
  };
  const source = {
    ...analysis.evidence[1],
    pageUrl: second.url,
    observation: JSON.stringify({ declarations: [], headersChecked: false }),
  };
  analysis.pages.push(second);
  analysis.evidence.push(source);
  analysis.checks.push({
    ...analysis.checks[0],
    pageUrl: second.url,
    status: "not-observed",
    detail:
      "No canonical was collected in HTML. Response headers were unavailable.",
    sourceIds: [source.id],
  });
  analysis.scope.pages = 2;
  report.pagesAnalyzed.push({ ...report.pagesAnalyzed[0], url: second.url });
  report.seo[1] = {
    ...report.seo[1],
    pageUrl: second.url,
    seoEvidence: [source],
    fixSteps: [],
  };
  return report;
}

async function navigate(page, section) {
  if (await page.locator("#report-section").isVisible())
    await page.locator("#report-section").selectOption(section);
  else
    await page
      .getByRole("button", {
        name: section === "seo" ? "Search optimization" : "User experience",
        exact: true,
      })
      .first()
      .click();
  await page
    .locator(`[data-review-workspace="${section}"]`)
    .waitFor({ state: "visible" });
}

async function open(report, width, scale = 1) {
  const context = await browser.newContext({
    viewport: { width, height: 960 },
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  let audits = 0;
  let fixes = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          if (window.__denySeoClipboard)
            throw new Error("Clipboard denied for verification");
          window.__seoCopied = value;
        },
      },
    });
    window.print = () => {
      window.__seoPrintRequested = true;
    };
  });
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/api/analyze") {
      audits++;
      await route.fulfill({
        json: { ...report, analysisId: `seo-ui-verification-${audits}` },
      });
    } else if (endpoint === "/api/fix-steps") {
      fixes++;
      await route.fulfill({
        status: fixes === 1 ? 502 : 200,
        json:
          fixes === 1
            ? { error: "Fixture provider busy. Try again." }
            : {
                steps: [
                  {
                    title: "Review the archived page declaration",
                    description:
                      "Compare the recorded page and intended preferred URL before making a change.",
                  },
                ],
              },
      });
    } else {
      unexpected.push(endpoint);
      await route.fulfill({
        status: 500,
        json: { error: "Unexpected verification request" },
      });
    }
  });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  const address = page.getByLabel("Your website address", { exact: true });
  await address.fill(report.url);
  await address.press("Enter");
  await page
    .getByRole("heading", { level: 1, name: "bakery.example", exact: true })
    .waitFor();
  await navigate(page, "seo");
  await page.evaluate(() => {
    const marker = document.createElement("div");
    marker.textContent = "UI verification · illustrative test report";
    marker.style.cssText =
      "background:#182236;color:white;padding:7px 14px;font:12px/1.5 Inter,system-ui;text-align:center";
    document.body.prepend(marker);
  });
  return {
    context,
    page,
    root: page.locator('[data-review-workspace="seo"]'),
    counts: () => ({ audits, fixes }),
  };
}

async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage: true,
  });
}

async function geometry(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(overflow, false, label);
  const contrast = await page.evaluate(workspaceTextContrast);
  assert.deepEqual(contrast.failures, [], label);
  checks.push({ label, overflow, minimumTextContrast: contrast.minimum });
}

try {
  for (const width of [320, 390, 768, 900, 1024, 1280, 1440]) {
    const report = fixture();
    const { context, page, root, counts } = await open(report, width);
    const active = root.locator("[data-active-finding]");
    const signals = root.getByRole("region", {
      name: "Collected page signals",
    });
    const findings = root.getByRole("region", { name: "Supported findings" });
    assert.equal(await signals.count(), 0);
    assert.equal(
      await root
        .getByRole("meter", { name: "On-page SEO assessment" })
        .getAttribute("aria-valuenow"),
      "79",
    );
    await geometry(page, `Findings ${width}px`);
    await capture(page, `findings-${width}`);
    const choice = root.getByLabel("Choose an SEO finding", { exact: true });
    if (await choice.isVisible()) await choice.selectOption({ index: 1 });
    else
      await root
        .getByRole("button", {
          name: `Select SEO finding 2: ${report.seo[1].title}`,
          exact: true,
        })
        .press("Enter");
    assert.equal(
      await active.locator("h4").first().innerText(),
      report.seo[1].title,
    );
    await active
      .getByRole("button", { name: "Inspect source page", exact: true })
      .press("Enter");
    await signals.waitFor();
    assert.equal(await findings.count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Collected page signals",
    );
    const picker = signals.getByLabel("SEO page to inspect", { exact: true });
    assert.equal(await picker.inputValue(), report.seoAnalysis.pages[1].url);
    await signals
      .getByRole("heading", { name: "Acorn Bakery collection archive" })
      .waitFor();
    await signals
      .getByText("Alternate archived title", { exact: false })
      .waitFor();
    await signals.getByText("Canonical & directives", { exact: true }).click();
    await signals.getByText("Structured data", { exact: true }).click();
    await geometry(page, `Page signals ${width}px`);
    await capture(page, `page-signals-${width}`);
    if (width === 1440) {
      await navigate(page, "ux");
      await navigate(page, "seo");
      assert.equal(await picker.inputValue(), report.seoAnalysis.pages[1].url);
      assert.ok(
        await signals.getByText("HTTP status", { exact: true }).isVisible(),
      );
      await picker.selectOption(report.url);
      await signals
        .getByRole("heading", {
          name: report.seoAnalysis.pages[0].titles[0],
          exact: true,
        })
        .waitFor();
      await picker.selectOption(report.seoAnalysis.pages[1].url);
    }
    await signals
      .getByRole("button", { name: "View findings for this page" })
      .click();
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Supported findings",
    );
    assert.equal(
      await findings.getByLabel("SEO finding page").inputValue(),
      report.seoAnalysis.pages[1].url,
    );
    assert.match(
      await findings.getByRole("status").innerText(),
      /1 of 2 findings/,
    );
    assert.deepEqual(counts(), { audits: 1, fixes: 0 });
    if (width === 1440) {
      await active
        .getByRole("button", { name: "Generate action plan" })
        .click();
      await active
        .getByRole("alert")
        .filter({ hasText: "Fixture provider busy" })
        .waitFor();
      assert.ok(
        await active
          .getByText("What was collected", { exact: true })
          .isVisible(),
      );
      await active.getByRole("button", { name: "Retry action plan" }).click();
      await active
        .getByRole("heading", { name: "Review the archived page declaration" })
        .waitFor();
      const downloadPending = page.waitForEvent("download");
      await root
        .getByRole("button", { name: "Download SEO plan (.txt)" })
        .click();
      const download = await downloadPending;
      assert.equal(
        download.suggestedFilename(),
        "bakery.example-seo-action-plan.txt",
      );
      const downloaded = await readFile(await download.path(), "utf8");
      assert.ok(
        downloaded.includes(report.seo[0].title) &&
          downloaded.includes("Review the archived page declaration"),
      );
      await root
        .getByRole("button", { name: "Copy SEO plan", exact: true })
        .click();
      assert.equal(await page.evaluate(() => window.__seoCopied), downloaded);
      assert.ok(
        (await page.locator("#siteaudit-print-root").textContent()).includes(
          downloaded,
        ),
      );
      await page.getByText("Export report", { exact: true }).click();
      await page.getByRole("button", { name: /Print \/ save as PDF/ }).click();
      assert.equal(await page.evaluate(() => window.__seoPrintRequested), true);
      await page.evaluate(() => {
        window.__denySeoClipboard = true;
      });
      await root
        .getByRole("button", { name: "Copy SEO plan", exact: true })
        .click();
      await root.getByText(/Copying is unavailable/).waitFor();
      await page
        .getByRole("button", { name: "Run again", exact: true })
        .click();
      await navigate(page, "seo");
      assert.equal(
        await root
          .getByRole("button", { name: "Findings 2", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(await root.getByLabel("SEO finding page").inputValue(), "");
      assert.deepEqual(counts(), { audits: 2, fixes: 2 });
    }
    await context.close();
  }

  for (const state of ["partial", "empty", "large-text"]) {
    const report = fixture();
    if (state === "empty") report.seo = [];
    if (state === "partial") {
      report.seoAnalysis.summary = "Withheld summary must never render";
      report.seoAnalysis.assessmentValidation = {
        reassessed: true,
        summaryWithheld: true,
        withheldCriteria: ["discovery"],
      };
    }
    const { context, page, root, counts } = await open(
      report,
      state === "large-text" ? 1024 : 390,
    );
    if (state === "partial") {
      assert.ok(
        await root.getByText(/only verified areas contribute/).isVisible(),
      );
      assert.equal(
        await root
          .getByText("Withheld summary must never render", { exact: true })
          .count(),
        0,
      );
    }
    if (state === "empty") {
      await root
        .getByRole("heading", {
          name: "No supported on-page fixes in this sample",
        })
        .waitFor();
      await capture(page, "empty-390");
      await root
        .getByRole("button", { name: "Inspect collected pages" })
        .click();
    }
    if (state === "large-text") {
      await root
        .getByRole("button", { name: "Page signals", exact: true })
        .click();
      await root.evaluate((element) => {
        const sizes = [...element.querySelectorAll("*")].map((node) => [
          node,
          parseFloat(getComputedStyle(node).fontSize),
        ]);
        for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
      });
    }
    await geometry(page, state);
    await capture(
      page,
      state === "large-text"
        ? "page-signals-large-text-1024"
        : `${state}-detail-390`,
    );
    assert.deepEqual(counts(), { audits: 1, fixes: 0 });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  await writeFile(
    path.join(output, "checks.json"),
    JSON.stringify(
      {
        baseURL,
        fixtureOnly: true,
        checks,
        errors,
        unexpected,
        verified: [
          "Page cross-links",
          "Keyboard focus",
          "Navigation retention",
          "New-report reset",
          "Generation failure and retry",
          "Actual text download",
          "Clipboard denial",
          "Complete print content",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      output,
      layoutChecks: checks.length,
      browserErrors: errors.length,
      unexpectedRequests: unexpected.length,
    }),
  );
} finally {
  await browser.close();
}
