import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reviewedCriteria,
  reviewIssues,
  reviewIssueKey,
  issueSteps,
  type ReviewCriterion,
} from "../src/lib/review-workspace";
import { dashboardModel } from "../src/lib/dashboard";
import { messagingScore } from "../src/lib/messaging";
import { seoScore } from "../src/lib/seo";
import { conversionScore } from "../src/lib/conversion";
import { messagingPlan } from "../src/lib/messaging-presentation";
import { seoPlan } from "../src/lib/seo-presentation";
import { conversionPlan } from "../src/lib/conversion-presentation";
import { quickWinsPlan } from "../src/lib/quick-wins-presentation";
import { specialistFixture } from "./review-workspace-fixtures";

test("workspace assessment eligibility agrees with the dashboard and preserves real zero", () => {
  const result = specialistFixture();
  result.messagingAnalysis!.criteria[0].score = 0;
  result.messagingAnalysis!.criteria[1].sources = [];
  result.seoAnalysis!.criteria[0].sources = [
    {
      ...result.seoAnalysis!.criteria[0].sources[0],
      pageUrl: "https://not-collected.example/",
    },
  ];
  const pages = result.pagesAnalyzed!.map((page) => page.url),
    dashboard = dashboardModel(result);
  const verify = <T extends ReviewCriterion>(
    key: string,
    criteria: T[],
    calculate: (criteria: T[]) => number | null,
  ) => {
    const eligible = reviewedCriteria(criteria, pages, calculate);
    const category = dashboard.categories.find(
      (category) => category.key === key,
    )!;
    assert.equal(calculate(eligible), category.score);
    assert.equal(eligible.length, category.assessed);
  };
  verify("messaging", result.messagingAnalysis!.criteria, messagingScore);
  verify("seo", result.seoAnalysis!.criteria, seoScore);
  verify("conversion", result.conversionAnalysis!.criteria, conversionScore);
  assert.equal(
    reviewedCriteria(
      result.messagingAnalysis!.criteria,
      pages,
      messagingScore,
    )[0].score,
    0,
  );
});

test("invalid, unknown, uncited, duplicate and missing assessments do not enter a score", () => {
  const original = specialistFixture().seoAnalysis!.criteria[0];
  const criteria = [
    { ...original, score: 0 },
    { ...original, score: 100 },
    { ...original, key: "discovery" as const, score: NaN },
    { ...original, key: "content" as const, sources: [] },
    { ...original, key: "structured" as const, score: null },
    { ...original, key: "not-a-criterion" as never, score: 99 },
  ];
  const valid = reviewedCriteria(
    criteria,
    [original.sources[0].pageUrl],
    seoScore,
  );
  assert.equal(valid.length, 1);
  assert.equal(seoScore(valid), 0);
  assert.deepEqual(reviewedCriteria([original], ["invalid-url"], seoScore), []);
});

test("finding identity survives sorting and distinguishes same titles on different pages and exact duplicates", () => {
  const first = specialistFixture().messaging[0],
    second = {
      ...first,
      pageUrl: "https://bakery.example/about",
      priority: "Low" as const,
    };
  const keys = reviewIssues([second, first]).map((record) => record.key);
  assert.deepEqual(
    reviewIssues([first, second]).map((record) => record.key),
    keys,
  );
  assert.notEqual(reviewIssueKey(first), reviewIssueKey(second));
  assert.equal(
    new Set(reviewIssues([first, first, second]).map((record) => record.key))
      .size,
    3,
  );
});

test("new generated steps are isolated by finding while old title-keyed callers remain supported", () => {
  const first = specialistFixture().messaging[0],
    second = { ...first, pageUrl: "https://bakery.example/about" };
  const steps = [
    {
      title: "Page-specific step",
      description: "For the original source page only.",
    },
  ];
  const generated = { [reviewIssueKey(first)]: steps };
  assert.equal(issueSteps(first, generated), steps);
  assert.equal(issueSteps(second, generated), second.fixSteps);
  assert.equal(issueSteps(first, { [first.title]: steps }), steps);
  const report = specialistFixture();
  assert.ok(
    messagingPlan(
      report.messagingAnalysis,
      report.messaging,
      report.url,
      {},
      generated,
    ).includes(steps[0].description),
  );
  assert.ok(
    quickWinsPlan(
      report.quickWins,
      report.url,
      new Set(),
      "effort",
      generated,
    ).includes(steps[0].description),
  );
});

test("section exports use the same eligible criteria and retain full findings", () => {
  const report = specialistFixture();
  report.seoAnalysis!.criteria[0].sources = [];
  report.conversionAnalysis!.criteria[0].score = 0;
  const pages = report.pagesAnalyzed!.map((page) => page.url),
    model = dashboardModel(report);
  const seo = seoPlan(report.seoAnalysis, report.seo, report.url, {}, pages),
    conversion = conversionPlan(
      report.conversionAnalysis,
      report.conversion,
      report.url,
      {},
      pages,
    );
  assert.ok(
    seo.includes(
      `Qualitative on-page score: ${model.categories.find((category) => category.key === "seo")!.score}`,
    ),
  );
  assert.ok(
    conversion.includes(
      String(
        model.categories.find((category) => category.key === "conversion")!
          .score,
      ),
    ),
  );
  for (const finding of report.seo) assert.ok(seo.includes(finding.title));
});
