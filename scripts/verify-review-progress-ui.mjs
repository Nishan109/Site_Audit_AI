// Controlled browser verification. Run with node --import tsx scripts/verify-review-progress-ui.mjs.
// The optional local Playwright driver is documented in verify-review-ui.mjs.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { auditActivity } from "../src/lib/server/audit-activity.ts";
import { auditResponse } from "../src/lib/server/audit-stream.ts";
import { REVIEW_STAGES } from "../src/lib/review-progress.ts";
import { dashboardFixture } from "../tests/dashboard-fixtures.ts";
import { workspaceTextContrast } from "./browser-review-utils.mjs";

const require = createRequire(import.meta.url);
const {
  chromium,
} = require("../node_modules/.cache/siteaudit-review-qa/node_modules/playwright-core");
const output = path.resolve("docs/verification/review-progress");
const baseURL = process.env.REVIEW_BASE_URL || "http://localhost:3001";
const origin = new URL(baseURL).origin;
const checks = [];
const errors = [];
let session;

const server = createServer(async (request, reply) => {
  reply.setHeader("Access-Control-Allow-Origin", origin);
  reply.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  reply.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") {
    reply.writeHead(204).end();
    return;
  }

  const test = session;
  const connection = new AbortController();
  reply.once("close", () => {
    if (!reply.writableFinished) connection.abort();
  });
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const result = await auditResponse(
      new Request(`http://localhost${request.url}`, {
        method: "POST",
        headers: request.headers,
        body: Buffer.concat(chunks),
        signal: connection.signal,
      }),
      async (url, signal, emit) => {
        test.calls++;
        test.address = url;
        const activity = auditActivity(signal, emit);
        const delay = (ms) => sleep(ms, undefined, { signal, ref: false });
        signal.addEventListener("abort", () => test.aborted.resolve(), {
          once: true,
        });
        await activity.run(
          "evidence",
          async () => {
            await delay(test.capture ? 1100 : 35);
            emit({ type: "stage_updated", stage: "evidence", relatedPages: 2 });
            await delay(30);
          },
          () => ({ status: "complete", count: 2, excluded: 1 }),
        );
        await activity.run(
          "research",
          () => delay(test.capture ? 1050 : 35),
          () => ({ status: "unavailable" }),
        );
        await Promise.all([
          activity.run(
            "messaging",
            async () => {
              await Promise.race([test.release.promise, delay(20_000)]);
              await delay(20);
            },
            () => ({ status: "complete", count: 0 }),
          ),
          activity.run(
            "ux",
            async () => {
              await Promise.race([test.release.promise, delay(20_000)]);
              await delay(120);
            },
            () => ({ status: "complete", count: 2 }),
          ),
        ]);
        for (const [id] of REVIEW_STAGES.slice(4))
          await activity.run(id, () => {});
        return {
          ...dashboardFixture(),
          initialReviewTiming: activity.timing(),
        };
      },
    );
    result.headers.forEach((value, name) => reply.setHeader(name, value));
    reply.writeHead(result.status);
    reply.flushHeaders();
    if (result.body) Readable.fromWeb(result.body).pipe(reply);
    else reply.end();
  } catch (error) {
    if (!connection.signal.aborted) errors.push(error.message);
    reply.destroy();
  }
});

await mkdir(output, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/api/analyze`;
const browser = await chromium.launch({
  executablePath:
    process.env.REVIEW_BROWSER ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const contrastSource = workspaceTextContrast
  .toString()
  .replace("[data-review-workspace]", "[data-review-progress]");
const contrastCheck = new Function(`return (${contrastSource})()`);
try {
  for (const width of [320, 390, 768, 1024, 1280, 1440, 640]) {
    const capture = width === 390 || width === 1440;
    const zoom = width === 640;
    const abort = width === 1024;
    session = {
      calls: 0,
      capture,
      aborted: Promise.withResolvers(),
      release: Promise.withResolvers(),
    };
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((url) => {
      const fetchRequest = window.fetch.bind(window);
      window.fetch = (input, init) =>
        fetchRequest(input === "/api/analyze" ? url : input, init);
    }, endpoint);
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    if (zoom)
      await page.evaluate(() => {
        document.documentElement.style.zoom = "2";
      });
    const submitted = capture
      ? "https://bakery.example/collection?edition=saturday"
      : `https://bakery.example/collection?edition=${"long-value-".repeat(16)}`;
    const field = page.getByRole("textbox", { name: "Your website address" });
    await field.fill(submitted);
    await field.press("Enter");
    const root = page.locator("[data-review-progress]");
    const active = root.getByRole("region", { name: "Currently working on" });
    await active.getByText("Messaging", { exact: true }).waitFor();
    await active.getByText("User experience", { exact: true }).waitFor();
    await active.getByText(/Web research unavailable/).waitFor();
    assert.ok(
      await root.getByText("Complete with limits", { exact: true }).isVisible(),
    );
    assert.equal(
      await page.getByRole("button", { name: "Export report" }).count(),
      0,
    );
    assert.equal(session.calls, 1);
    assert.equal(session.address, submitted);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, `Horizontal overflow at ${width}px`);
    const contrast = await page.evaluate(contrastCheck);
    assert.deepEqual(contrast.failures, []);
    checks.push({
      width,
      zoom: zoom ? 200 : 100,
      horizontalOverflow: overflow,
      minimumTextContrast: contrast.minimum,
    });

    if (capture) {
      const before = await root.locator("[data-review-elapsed]").textContent();
      await page.waitForFunction(
        (previous) =>
          document.querySelector("[data-review-elapsed]").textContent !==
          previous,
        before,
      );
      await page.evaluate(() => {
        const label = document.createElement("div");
        label.textContent = "UI verification · controlled audit";
        label.style.cssText =
          "background:#182236;color:white;padding:7px 14px;font:12px/1.5 Inter,system-ui;text-align:center";
        document.body.prepend(label);
      });
      await page.screenshot({
        path: path.join(output, `live-review-${width}.png`),
        fullPage: true,
      });
    }

    if (abort) {
      await page.evaluate(() => {
        const now = performance.now.bind(performance);
        Object.defineProperty(performance, "now", {
          configurable: true,
          value: () => now() + 26_000,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await root
        .getByRole("heading", { name: "Last reported activity" })
        .waitFor();
      await root.getByRole("button", { name: "Cancel review" }).press("Enter");
      assert.equal(await field.inputValue(), submitted);
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "url-input",
      );
      await Promise.race([
        session.aborted.promise,
        sleep(5_000).then(() => {
          throw new Error("Browser cancellation did not reach the audit");
        }),
      ]);
    } else {
      session.release.resolve();
      await page
        .getByRole("heading", { level: 1, name: "bakery.example" })
        .waitFor();
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "report-title",
      );
      assert.equal(await root.count(), 0);
    }
    console.log(JSON.stringify(checks.at(-1)));
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "checks.json"),
    JSON.stringify(
      {
        mode: "Controlled audit work through the real streaming response helper and browser UI",
        checks,
        flows: [
          "Parallel activity before report",
          "Optional research limitation",
          "Exact submitted URL",
          "Stale progress after simulated hidden-tab delay",
          "Keyboard cancellation and downstream abort",
          "Report focus and handoff",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
