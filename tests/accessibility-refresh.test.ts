import { test } from "node:test";
import assert from "node:assert/strict";
import { refreshAccessibilityChecks } from "../src/lib/server/accessibility-refresh";
import {
  applyAccessibilityRefresh,
  accessibilityRefreshSchema,
  hasAccessibilityResults,
} from "../src/lib/accessibility-refresh";
import { extractEvidence } from "../src/lib/server/evidence";
import { POST } from "../src/app/api/accessibility-checks/route";
import type { AuditResult } from "../src/lib/types";
import { audit, url } from "./accessibility-fixtures";
import { accessibilityPlan } from "../src/lib/accessibility-presentation";

const page = extractEvidence(
  "<title>Acorn Bakery</title><main><h1>Saturday bread collection</h1><p>Acorn Bakery bakes white sourdough and rye loaves for Saturday collection in Bath.</p></main>",
  url,
  true,
);
const update = () =>
  accessibilityRefreshSchema.parse({
    requestedUrl: url,
    url,
    checkedAt: "2026-11-07T12:00:00.000Z",
    audit: {
      ...audit,
      requestedUrl: url,
      checkedAt: "2026-11-07T12:00:00.000Z",
    },
  });

test("fresh accessibility collection needs no AI credentials and returns all nine page-specific HTML checks", async (t) => {
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.after(() => {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
  });
  let requested = "";
  const result = await refreshAccessibilityChecks(
    "bakery.example",
    new AbortController().signal,
    async (value) => {
      requested = String(value);
      return { url, pages: [page], warnings: [] };
    },
  );
  assert.equal(requested, url);
  assert.equal(result.requestedUrl, url);
  assert.equal(result.audit.review.pages[0].checks.length, 9);
  assert.equal(result.audit.review.scope.collected, 1);
  assert.equal(result.audit.checkedAt, result.checkedAt);
  assert.equal(hasAccessibilityResults(result.audit, url), true);
});

test("accessibility refresh rejects private targets before collection", async () => {
  let requests = 0;
  await assert.rejects(() =>
    refreshAccessibilityChecks(
      "http://127.0.0.1/",
      new AbortController().signal,
      async () => {
        requests++;
        return { url, pages: [page], warnings: [] };
      },
    ),
  );
  assert.equal(requests, 0);
});

test("cancelled or empty accessibility collection cannot return a successful empty report", async () => {
  await assert.rejects(
    () =>
      refreshAccessibilityChecks(
        url,
        new AbortController().signal,
        async () => ({
          url,
          pages: [],
          warnings: [],
        }),
      ),
    /evidence was incomplete/,
  );
  const controller = new AbortController();
  await assert.rejects(() =>
    refreshAccessibilityChecks(url, controller.signal, async () => {
      controller.abort();
      return { url, pages: [page], warnings: [] };
    }),
  );
});

test("accessibility endpoint rejects malformed input and unsafe URLs with non-cacheable errors", async () => {
  for (const [body, code] of [
    ["bad json", "INVALID_REQUEST"],
    [JSON.stringify({ url: "http://localhost:3000" }), "INVALID_URL"],
  ]) {
    const response = await POST(
      new Request("http://app.example/api/accessibility-checks", {
        method: "POST",
        body,
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).code, "AUTH_REQUIRED");
    assert.ok(code);
  }
});

test("empty, duplicate, mismatched and incomplete accessibility results cannot masquerade as a collected report", () => {
  const valid = update();
  assert.equal(hasAccessibilityResults({ ...audit, review: undefined }), false);
  for (const mutate of [
    (value: typeof valid) => {
      value.audit.review.pages = [];
    },
    (value: typeof valid) => {
      value.audit.review.pages[0].checks.pop();
    },
    (value: typeof valid) => {
      value.audit.review.pages[0].checks[0].pageUrl = "https://other.example/";
    },
    (value: typeof valid) => {
      value.audit.review.pages[0].checks[1].key =
        value.audit.review.pages[0].checks[0].key;
    },
    (value: typeof valid) => {
      value.audit.review.scope.actions = 99;
    },
    (value: typeof valid) => {
      value.audit.requestedUrl = "https://other.example/";
    },
    (value: typeof valid) => {
      value.audit.review.pages[0].url = "not a URL";
    },
    (value: typeof valid) => {
      value.audit.review.pages[0].checks[0].observations = [];
    },
  ]) {
    const value = structuredClone(valid);
    mutate(value);
    assert.equal(accessibilityRefreshSchema.safeParse(value).success, false);
  }
});

test("workspace availability and exports reject mismatched or ambiguous page evidence", () => {
  const mismatched = { ...audit, requestedUrl: "https://other.example/" };
  assert.equal(hasAccessibilityResults(mismatched, url), false);
  const scopeOnly = accessibilityPlan(mismatched, url);
  assert.match(scopeOnly, /Fresh accessibility evidence is not available/);
  assert.match(scopeOnly, /BROWSER AND ASSISTIVE-TECHNOLOGY CHECKLIST/);
  assert.doesNotMatch(
    scopeOnly,
    /OBSERVATIONS AND SOURCE EVIDENCE|Image alternatives/,
  );

  const duplicate = update();
  const second = duplicate.audit.review.pages[1];
  second.url = `${url}#same-page`;
  for (const check of second.checks) check.pageUrl = second.url;
  assert.equal(accessibilityRefreshSchema.safeParse(duplicate).success, false);
});

const report: AuditResult = {
  url,
  analysisId: "report-1",
  analyzedAt: "2026-11-07T10:00:00.000Z",
  summary: "A collected website report.",
  overview: "Marketing findings from the collected website.",
  scores: { Messaging: 80, UX: 80, SEO: 80, Conversion: 80 },
  topIssues: [],
  messaging: [],
  ux: [],
  seo: [],
  conversion: [],
  quickWins: [],
  sources: [url],
  searchQueries: [],
  agentSteps: [
    {
      name: "Messaging Agent",
      status: "completed",
      detail: "Existing verified copy review.",
    },
  ],
};
test("refreshed results persist in the report used by navigation and printing while preserving marketing findings", () => {
  const result = applyAccessibilityRefresh(report, update(), "report-1")!;
  assert.equal(result.accessibilityAudit?.review?.scope.checks, 18);
  assert.equal(result.scores, report.scores);
  assert.equal(result.messaging, report.messaging);
  assert.equal(result.analyzedAt, report.analyzedAt);
  assert.ok(
    result.agentSteps.some(
      (step) =>
        step.name === "Accessibility checks" && step.status === "completed",
    ),
  );
  assert.ok(result.sources.includes(`${url}about`));
  const again = applyAccessibilityRefresh(result, update(), "report-1")!;
  assert.equal(
    again.agentSteps.filter((step) => step.name === "Accessibility checks")
      .length,
    1,
  );
});
test("a refresh for a different website or earlier report cannot overwrite the current report", () => {
  assert.equal(
    applyAccessibilityRefresh(report, update(), "old-report"),
    report,
  );
  assert.equal(
    applyAccessibilityRefresh(
      { ...report, url: "https://other.example/" },
      update(),
      "report-1",
    )?.accessibilityAudit,
    undefined,
  );
  assert.equal(applyAccessibilityRefresh(null, update(), "report-1"), null);
});
