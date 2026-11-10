import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePageSpeed,
  pageSpeedMetric,
} from "../src/lib/pagespeed-measurement";
import {
  requestPageSpeed,
  PageSpeedError,
} from "../src/lib/server/pagespeed-request";
import { POST } from "../src/app/api/pagespeed/route";
import {
  formatPageSpeedValue,
  pageSpeedResultSchema,
} from "../src/lib/pagespeed";
import { payload, url, report } from "./pagespeed-fixtures";
import { importLighthouseReport } from "../src/lib/lighthouse-import";
const deps = (
  body: unknown = payload,
  status = 200,
  headers?: Record<string, string>,
) => ({
  fetch: (async () => Response.json(body, { status, headers })) as typeof fetch,
  validate: async () => {},
  apiKey: undefined as string | undefined,
});

test("PageSpeed keeps separate lab and field identities, converts scaled CrUX CLS and never substitutes TBT for INP", () => {
  const result = parsePageSpeed(payload, { url });
  assert.equal(result.lab.lcp.value, 3100);
  assert.equal(result.field.lcp.value, 2300);
  assert.equal(result.field.cls.value, 0.08);
  assert.equal(result.lab.cls.value, 0.04);
  assert.equal(result.field.inp.value, 190);
  assert.equal(result.lab.tbt.value, 350);
  assert.equal(result.field.assessment, "passed");
  assert.equal(result.field.ttfb.value, 640);
  assert.equal(
    parsePageSpeed({ lighthouseResult: payload.lighthouseResult }, { url })
      .field.ttfb.value,
    null,
  );
  assert.equal(
    parsePageSpeed({ lighthouseResult: payload.lighthouseResult }, { url })
      .field.inp.value,
    null,
  );
});

test("page and origin datasets never blend to fill missing field measurements", () => {
  const result = parsePageSpeed(
    {
      loadingExperience: {
        id: url,
        metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2100 } },
      },
      originLoadingExperience: {
        id: "https://bakery.example",
        metrics: payload.loadingExperience!.metrics,
      },
    },
    { url },
  );
  assert.equal(result.field.scope, "page");
  assert.equal(result.field.inp.value, null);
  assert.equal(result.field.assessment, "unavailable");
  const fallback = parsePageSpeed(
    {
      originLoadingExperience: {
        id: "https://bakery.example",
        metrics: payload.loadingExperience!.metrics,
      },
    },
    { url },
  );
  assert.equal(fallback.field.scope, "origin");
  assert.equal(fallback.field.assessment, "passed");
  assert.equal(
    parsePageSpeed(
      {
        loadingExperience: {
          id: "https://bakery.example/",
          metrics: payload.loadingExperience!.metrics,
        },
      },
      { url },
    ).field.scope,
    "page",
  );
});

test("unavailable metrics are neutral and threshold values use documented inclusive boundaries", () => {
  for (const value of [null, undefined, -1, NaN, Infinity, "0"])
    assert.equal(pageSpeedMetric(value, "lcp").rating, "unavailable");
  assert.equal(pageSpeedMetric(2500, "lcp").rating, "good");
  assert.equal(pageSpeedMetric(4000, "lcp").rating, "needs-improvement");
  assert.equal(pageSpeedMetric(4001, "lcp").rating, "poor");
  assert.equal(pageSpeedMetric(200, "inp").rating, "good");
  assert.equal(pageSpeedMetric(0.1, "cls").rating, "good");
  assert.equal(pageSpeedMetric(0.25, "cls").rating, "needs-improvement");
  assert.equal(
    pageSpeedMetric(200, "tbt", "desktop").rating,
    "needs-improvement",
  );
  assert.equal(pageSpeedMetric(200, "tbt", "mobile").rating, "good");
  assert.equal(
    pageSpeedMetric(2000, "si", "desktop").rating,
    "needs-improvement",
  );
  assert.equal(formatPageSpeedValue(pageSpeedMetric(190, "inp")), "190 ms");
});

test("runtime errors withhold lab metrics without discarding usable field data", async () => {
  const body = {
    ...payload,
    lighthouseResult: {
      ...payload.lighthouseResult,
      runtimeError: { code: "NO_FCP" },
    },
  };
  const result = await requestPageSpeed(
    url,
    "mobile",
    new AbortController().signal,
    deps(body),
  );
  assert.equal(result.performanceScore, null);
  assert.equal(result.lab.lcp.value, null);
  assert.equal(result.field.assessment, "passed");
  assert.ok(
    result.warnings.some((item) => item.includes("could not complete")),
  );
});

test("invalid scores and error-mode audits do not produce plausible invented grades", () => {
  const result = parsePageSpeed(
    {
      lighthouseResult: {
        categories: { performance: { score: 1.8 } },
        audits: {
          "largest-contentful-paint": {
            numericValue: 1500,
            scoreDisplayMode: "error",
          },
        },
      },
    },
    { url },
  );
  assert.equal(result.performanceScore, null);
  assert.equal(result.lab.lcp.value, null);
  assert.equal(result.field.assessment, "unavailable");
});

test("modern insights and legacy opportunities retain estimates and descriptions without treating CLS as milliseconds", () => {
  const result = parsePageSpeed(
    {
      lighthouseResult: {
        audits: {
          ...payload.lighthouseResult!.audits,
          "layout-shift-insight": {
            title: "Layout shifts",
            score: 0,
            metricSavings: { CLS: 0.05 },
          },
        },
      },
    },
    { url },
  );
  assert.ok(
    result.opportunities.some((item) => item.id === "render-blocking-insight"),
  );
  assert.ok(
    result.opportunities.some(
      (item) =>
        item.description.includes("Learn more") &&
        !item.description.includes("](https"),
    ),
  );
  const cls = result.opportunities.find(
    (item) => item.id === "layout-shift-insight",
  )!;
  assert.equal(cls.savingsMs, null);
  assert.deepEqual(cls.metricSavings, [
    { metric: "CLS", value: 0.05, unit: "" },
  ]);
});

test("device selection, public URL validation, API key handling and no-store reach the actual provider request", async () => {
  const options = deps();
  options.apiKey = "test-only-secret";
  let validated = false;
  options.validate = async (target?: string) => {
    assert.equal(target, url);
    validated = true;
  };
  options.fetch = async (input, init) => {
    assert.equal(validated, true);
    const target = new URL(String(input));
    assert.equal(target.origin, "https://www.googleapis.com");
    assert.equal(target.searchParams.get("strategy"), "desktop");
    assert.equal(target.searchParams.get("key"), "test-only-secret");
    assert.equal(init?.cache, "no-store");
    return Response.json({
      ...payload,
      lighthouseResult: {
        ...payload.lighthouseResult,
        configSettings: { formFactor: "desktop" },
      },
    });
  };
  const result = await requestPageSpeed(
    url,
    "desktop",
    new AbortController().signal,
    options,
  );
  assert.equal(result.strategy, "desktop");
  assert.equal(JSON.stringify(result).includes("test-only-secret"), false);
});

test("429 and explicit quota errors preserve quota identity without leaking provider messages or credentials", async () => {
  for (const status of [429, 403])
    await assert.rejects(
      () =>
        requestPageSpeed(
          url,
          "mobile",
          new AbortController().signal,
          deps(
            {
              error: {
                message: "secret-key-in-provider-error",
                errors: [{ reason: "dailyLimitExceeded" }],
              },
            },
            status,
            { "Retry-After": "60" },
          ),
        ),
      (error) => {
        assert.ok(error instanceof PageSpeedError);
        assert.equal(error.code, "PAGESPEED_QUOTA");
        assert.equal(error.status, 429);
        assert.equal(error.retryAfterSeconds, 60);
        assert.equal(error.message.includes("secret-key"), false);
        return true;
      },
    );
});

test("configuration failures, malformed provider data and empty measurements remain explicit failures", async () => {
  for (const [body, status, code] of [
    [{}, 403, "PAGESPEED_CONFIGURATION"],
    [
      { error: { errors: "malformed-provider-error" } },
      403,
      "PAGESPEED_CONFIGURATION",
    ],
    [
      { lighthouseResult: { audits: "invalid" } },
      200,
      "PAGESPEED_INVALID_RESPONSE",
    ],
    [{ lighthouseResult: {} }, 200, "PAGESPEED_NO_MEASUREMENTS"],
  ] as const)
    await assert.rejects(
      () =>
        requestPageSpeed(
          url,
          "mobile",
          new AbortController().signal,
          deps(body, status),
        ),
      (error) => error instanceof PageSpeedError && error.code === code,
    );
});

test("private URLs, unknown strategies and parent cancellation never trigger provider work", async () => {
  let calls = 0;
  const options = deps();
  options.fetch = async () => {
    calls++;
    return Response.json(payload);
  };
  await assert.rejects(() =>
    requestPageSpeed(
      "http://localhost:3000",
      "mobile",
      new AbortController().signal,
      options,
    ),
  );
  await assert.rejects(() =>
    requestPageSpeed(url, "tablet", new AbortController().signal, options),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() =>
    requestPageSpeed(url, "mobile", controller.signal, options),
  );
  assert.equal(calls, 0);
});

test("PageSpeed route rejects malformed requests before external requests", async () => {
  const response = await POST(
    new Request("http://app.example/api/pagespeed", {
      method: "POST",
      body: "bad",
    }),
  );
  assert.equal(response.status, 401);
});

test("the validated report cannot treat an unavailable value as poor or a missing value as zero", () => {
  const value = report();
  value.lab.lcp = { value: null, unit: "ms", rating: "poor" };
  assert.equal(pageSpeedResultSchema.safeParse(value).success, false);
});

test("a provider response for the wrong device cannot be relabeled as the selected test", async () => {
  await assert.rejects(
    () =>
      requestPageSpeed(
        url,
        "desktop",
        new AbortController().signal,
        deps(payload),
      ),
    (error) =>
      error instanceof PageSpeedError &&
      error.code === "PAGESPEED_INVALID_RESPONSE",
  );
});

test("field assessments and metric units must remain consistent with supplied measurements", () => {
  const incomplete = report();
  incomplete.field.inp = { value: null, unit: "ms", rating: "unavailable" };
  assert.equal(pageSpeedResultSchema.safeParse(incomplete).success, false);
  const wrongUnit = report();
  wrongUnit.lab.cls.unit = "ms";
  assert.equal(pageSpeedResultSchema.safeParse(wrongUnit).success, false);
  const wrongScope = report();
  wrongScope.field.scope = "unavailable";
  assert.equal(pageSpeedResultSchema.safeParse(wrongScope).success, false);
});

test("Google quota without a retry header pauses calls across devices and expires", async (t) => {
  let now = Date.parse("2026-11-09T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  const quota = { blockedUntil: 0 };
  const options = { ...deps(), quota };
  options.fetch = async () => {
    calls++;
    return calls === 1
      ? Response.json({}, { status: 429 })
      : Response.json(payload);
  };
  const run = (device: string) =>
    requestPageSpeed(url, device, new AbortController().signal, options);
  await assert.rejects(
    () => run("mobile"),
    (error) =>
      error instanceof PageSpeedError && error.retryAfterSeconds === 60,
  );
  now += 15000;
  await assert.rejects(
    () => run("desktop"),
    (error) =>
      error instanceof PageSpeedError && error.retryAfterSeconds === 45,
  );
  assert.equal(calls, 1);
  now += 45000;
  assert.equal((await run("mobile")).performanceScore, 82);
  assert.equal(calls, 2);
});

test("an HTTP-date Retry-After is respected when Google limits requests", async (t) => {
  const now = Date.parse("2026-11-09T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  const headers = { "retry-after": new Date(now + 120_000).toUTCString() };
  await assert.rejects(
    () =>
      requestPageSpeed(
        url,
        "mobile",
        new AbortController().signal,
        deps({}, 429, headers),
      ),
    (error) =>
      error instanceof PageSpeedError && error.retryAfterSeconds === 120,
  );
});

test("Lighthouse import keeps the original run time and exact page identity with lab-only data", () => {
  const source = {
    ...payload.lighthouseResult,
    finalUrl: undefined,
    finalDisplayedUrl: url,
    gatherMode: "navigation",
    loadingExperience: payload.loadingExperience,
  };
  const imported = importLighthouseReport(
    JSON.stringify(source),
    url,
    "mobile",
  );
  assert.equal(imported.method, "lighthouse-import-v1");
  assert.equal(imported.analyzedAt, source.fetchTime);
  assert.equal(imported.performanceScore, 82);
  assert.equal(imported.lab.lcp.value, 3100);
  assert.equal(imported.field.scope, "unavailable");
  assert.equal(imported.field.inp.value, null);
  assert.throws(
    () =>
      importLighthouseReport(
        JSON.stringify(source),
        `${url}?edition=archive`,
        "mobile",
      ),
    /different page/,
  );
  assert.throws(
    () => importLighthouseReport(JSON.stringify(source), url, "desktop"),
    /selected desktop/,
  );
  assert.throws(
    () =>
      importLighthouseReport(
        JSON.stringify({ ...source, gatherMode: "timespan" }),
        url,
        "mobile",
      ),
    /Navigation/,
  );
  assert.throws(
    () =>
      importLighthouseReport(
        JSON.stringify({
          ...source,
          categories: { performance: { score: null } },
          audits: {},
        }),
        url,
        "mobile",
      ),
    /no usable/,
  );
});
