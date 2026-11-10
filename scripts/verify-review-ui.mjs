import { workspaceTextContrast } from "./browser-review-utils.mjs";
// Isolated browser verification: no fixtures or test routes are included in the app.
// Install the optional driver into ignored local tooling:
// npm install --prefix node_modules/.cache/siteaudit-review-qa --no-audit --no-fund --package-lock=false playwright-core
// Run: node scripts/run-with-ca.mjs --import tsx scripts/verify-review-ui.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { specialistFixture } from "../tests/review-workspace-fixtures.ts";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.cache/siteaudit-review-qa/node_modules/playwright-core");
const output = path.resolve("docs/verification/specialist-workspaces");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.REVIEW_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = specialistFixture();
const findings = [];
const errors = [];
const sections = {
  messaging: "Messaging & copy",
  seo: "Search optimization",
  conversion: "Conversion",
  quickwins: "Quick wins",
};
const unexpectedRequests = [];
let screenshotCount = 0;
async function capture(page, options) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot(options);
  screenshotCount++;
}

try {
  for (const { width, scale } of [
    ...[320, 390, 768, 900, 1024, 1280, 1440].map((width) => ({
      width,
      scale: 1,
    })),
    { width: 720, scale: 2 },
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: scale === 2 ? 500 : 1000 },
      deviceScaleFactor: scale,
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__reviewCopied = value;
          },
        },
      }),
    );
    await page.route("**/api/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/api/analyze")
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(report),
        });
      else {
        unexpectedRequests.push(new URL(route.request().url()).pathname);
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Unexpected request during isolated UI verification",
          }),
        });
      }
    });
    await page.goto(process.env.REVIEW_BASE_URL || "http://127.0.0.1:3000", {
      waitUntil: "networkidle",
    });
    await page.addStyleTag({
      content: "nextjs-portal { display:none !important; }",
    }); // Development indicator is absent in production.
    await page
      .getByLabel("Your website address", { exact: true })
      .fill(report.url);
    await page
      .getByLabel("Your website address", { exact: true })
      .press("Enter");
    await page
      .getByRole("heading", { name: "bakery.example", exact: true })
      .waitFor()
      .catch(async (error) => {
        await capture(page, {
          path: path.join(output, "verification-failure.png"),
          fullPage: true,
        });
        console.log(
          JSON.stringify({
            browserErrors: errors,
            body: (await page.locator("body").innerText()).slice(0, 1800),
            unexpectedRequests,
          }),
        );
        throw error;
      });
    await page.evaluate(() => {
      const banner = document.createElement("div");
      banner.textContent = "UI verification · illustrative test report";
      banner.style.cssText =
        "padding:7px 14px;background:#182236;color:white;font:12px Inter,system-ui;line-height:1.5;text-align:center";
      document.body.prepend(banner);
    });
    const navigate = async (section) => {
      if (await page.locator("#report-section").isVisible())
        await page.locator("#report-section").selectOption(section);
      else
        await page
          .getByRole("button", { name: sections[section], exact: true })
          .first()
          .click();
      await page
        .getByRole("heading", {
          level: 2,
          name: new RegExp(sections[section].replace("&", "\\&")),
        })
        .waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
    };
    for (const section of Object.keys(sections)) {
      await navigate(section);
      const contrast = await page.evaluate(workspaceTextContrast);
      assert.deepEqual(
        contrast.failures,
        [],
        `${section}: text contrast below 4.5:1`,
      );
      await capture(page, {
        path: path.join(
          output,
          `${section}-${scale === 2 ? "zoom-200" : width}.png`,
        ),
        fullPage: true,
      });
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: window.innerWidth,
      }));
      assert.ok(
        overflow.scroll <= overflow.width + 1,
        `${section} overflows at ${width}px: ${JSON.stringify(overflow)}`,
      );
      findings.push({
        section,
        width,
        deviceScale: scale,
        zoomEquivalent:
          scale === 2 ? "200% reflow on a 1440px canvas" : undefined,
        overflow: false,
        minimumMeasuredTextContrast: contrast.minimum,
      });
    }
    if (width === 1440) {
      await navigate("messaging");
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      await page.keyboard.press("Tab");
      if (await page.locator("[data-active-finding]").count()) {
        const pick = page.getByRole("button", {
          name: `Select finding 1: ${report.messaging[0].title}`,
          exact: true,
        });
        await pick.focus();
        assert.ok(
          await pick.evaluate(
            (element) =>
              parseFloat(getComputedStyle(element).outlineWidth) >= 2,
          ),
        );
        await pick.press("Enter");
        assert.equal(await pick.getAttribute("aria-pressed"), "true");
      } else {
        const hide = page.getByRole("button", {
          name: `Hide details: ${report.messaging[0].title}`,
          exact: true,
        });
        await hide.focus();
        assert.ok(
          await hide.evaluate(
            (element) =>
              parseFloat(getComputedStyle(element).outlineWidth) >= 2,
          ),
        );
        await hide.press("Enter");
        await page
          .getByRole("button", {
            name: `View details: ${report.messaging[0].title}`,
            exact: true,
          })
          .press("Enter");
      }
      const draft = page.getByRole("textbox", {
        name: `Wording draft for ${report.messaging[0].title}`,
      });
      await draft.fill("My carefully reviewed collection headline.");
      await navigate("seo");
      await page.getByLabel("SEO finding focus area").selectOption("metadata");
      await navigate("conversion");
      await page
        .getByLabel("Finding focus area", { exact: true })
        .selectOption("actions");
      await navigate("quickwins");
      await page
        .getByRole("button", {
          name: `Mark done: ${report.quickWins[0].action}`,
          exact: true,
        })
        .press("Space");
      await navigate("messaging");
      assert.equal(
        await draft.inputValue(),
        "My carefully reviewed collection headline.",
      );
      await page
        .getByRole("button", { name: /^Copy (full )?plan$/, exact: true })
        .click();
      const copied = await page.evaluate(() => window.__reviewCopied);
      assert.ok(copied.includes("My carefully reviewed collection headline."));
      assert.ok(copied.includes(report.messaging[2].title));
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download messaging plan", exact: true })
        .click();
      const download = await pending;
      const downloaded = path.join(output, download.suggestedFilename());
      await download.saveAs(downloaded);
      assert.equal(await readFile(downloaded, "utf8"), copied);
      await navigate("seo");
      assert.equal(
        await page.getByLabel("SEO finding focus area").inputValue(),
        "metadata",
      );
      await page
        .getByRole("button", { name: "Page signals", exact: true })
        .click();
      await capture(page, {
        path: path.join(output, "seo-inspector-1440.png"),
        fullPage: true,
      });
      await navigate("conversion");
      assert.equal(
        await page.getByLabel("Finding focus area", { exact: true }).inputValue(),
        "actions",
      );
      await page
        .getByRole("button", { name: "Actions & forms", exact: true })
        .click();
      await capture(page, {
        path: path.join(output, "conversion-inspector-1440.png"),
        fullPage: true,
      });
      await navigate("quickwins");
      assert.equal(
        await page
          .getByRole("button", {
            name: `Mark as to do: ${report.quickWins[0].action}`,
            exact: true,
          })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page
        .getByText("View steps & evidence", { exact: true })
        .first()
        .click();
      await capture(page, {
        path: path.join(output, "quickwins-details-1440.png"),
        fullPage: true,
      });
    }
    if (width === 390) {
      await navigate("seo");
      await page
        .getByRole("button", { name: "Page signals", exact: true })
        .click();
      await capture(page, {
        path: path.join(output, "seo-inspector-390.png"),
        fullPage: true,
      });
      await navigate("conversion");
      await page
        .getByRole("button", { name: "Actions & forms", exact: true })
        .click();
      await capture(page, {
        path: path.join(output, "conversion-inspector-390.png"),
        fullPage: true,
      });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedRequests, []);
  await writeFile(
    path.join(output, "checks.json"),
    JSON.stringify(
      {
        findings,
        browserErrors: errors,
        unexpectedRequests,
        fixtureOnly: true,
        navigationState: "passed",
        draftExport: "passed",
        textDownload: "passed",
        keyboard: "passed",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      screenshots: screenshotCount,
      widths: [320, 390, 768, 900, 1024, 1280, 1440],
      zoomEquivalent: "200% reflow: 720 CSS pixels at 2x device scale",
      sections: 4,
      browserErrors: errors.length,
      unexpectedRequests: unexpectedRequests.length,
      navigationState: "passed",
      draftExport: "passed",
      textDownload: "passed",
      keyboard: "passed",
      output,
    }),
  );
} finally {
  await browser.close();
}
