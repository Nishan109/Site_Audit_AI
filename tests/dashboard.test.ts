import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardModel, dashboardPlan, sourceURL } from "../src/lib/dashboard";
import { dashboardFixture, issue, url } from "./dashboard-fixtures";
import { audit as securityAudit } from "./security-fixtures";
import { audit as accessibilityAudit } from "./accessibility-fixtures";
import { report as speedReport } from "./pagespeed-fixtures";

test("the combined score is the equal average of current cited category assessments, never legacy totals or check grades", () => {
  const model = dashboardModel(dashboardFixture());
  assert.deepEqual(
    model.categories.map((item) => item.score),
    [80, 60, 90, 70, 80],
  );
  assert.equal(model.overallScore, 76);
  assert.equal(model.assessed, 5);
  assert.equal(model.categories[4].assessed, 3);
});

test("missing and invalid assessments stay unassessed while a genuine zero remains a valid score", () => {
  const data = dashboardFixture();
  data.messagingAnalysis = undefined;
  data.uxAnalysis = undefined;
  data.seoAnalysis = undefined;
  data.conversionAnalysis = undefined;
  data.aeoAnalysis = undefined;
  assert.equal(dashboardModel(data).overallScore, null);
  assert.equal(dashboardModel(data).assessed, 0);
  data.messagingAnalysis = dashboardFixture().messagingAnalysis;
  for (const item of data.messagingAnalysis!.criteria) item.score = 0;
  assert.equal(dashboardModel(data).overallScore, 0);
  for (const value of [NaN, Infinity, -1, 101]) {
    for (const item of data.messagingAnalysis!.criteria) item.score = value;
    assert.equal(dashboardModel(data).overallScore, null);
  }
});

test("null and uncited criteria are excluded before weighting, and raw scores cannot fill gaps", () => {
  const data = dashboardFixture();
  data.uxAnalysis!.criteria[0].score = 100;
  data.uxAnalysis!.criteria[1].score = 20;
  data.uxAnalysis!.criteria[2].score = null;
  data.uxAnalysis!.criteria[3].sources = [];
  const category = dashboardModel(data).categories.find(
    (item) => item.key === "ux",
  )!;
  assert.equal(category.score, Math.round((100 * 30 + 20 * 25) / 55));
  assert.equal(category.assessed, 2);
  data.uxAnalysis!.criteria.forEach(
    (item) =>
      (item.sources = [
        {
          ...item.sources[0],
          ...dashboardFixture().uxAnalysis!.criteria[0].sources[0],
          pageUrl: "https://other.example/",
        },
      ]),
  );
  assert.equal(dashboardModel(data).categories[1].score, null);
});

test("full findings replace the truncated shortlist and deduplicate the same page/title across perspectives", () => {
  const data = dashboardFixture();
  data.ux.push({ ...data.messaging[1], priority: "Medium" });
  const model = dashboardModel(data);
  assert.equal(model.findings.length, 6);
  assert.deepEqual(model.priorities, { High: 2, Medium: 2, Low: 2 });
  assert.deepEqual(model.findings[0].areas, ["messaging", "ux"]);
  assert.equal(model.findings[0].issue.priority, "High");
  assert.equal(
    model.findings.some(
      (item) => item.issue.title === "Only the saved shortlist",
    ),
    false,
  );
  assert.equal(model.categories.find((item) => item.key === "ux")!.findings, 2);
});

test("unknown and repeated criterion keys cannot inflate the assessed criterion count", () => {
  const data = dashboardFixture();
  const analysis = data.messagingAnalysis!;
  analysis.criteria.push({
    ...analysis.criteria[0],
  });
  const unknown = { ...analysis.criteria[0], key: "unknown" };
  analysis.criteria.push(
    unknown as (typeof analysis.criteria)[number],
  );
  const item = dashboardModel(data).categories[0];
  assert.equal(item.assessed, 4);
  assert.equal(item.score, 80);
});

test("a repeated title on a different collected page remains a separate finding", () => {
  const data = dashboardFixture();
  data.pagesAnalyzed!.push({ ...data.pagesAnalyzed![0], url: `${url}about` });
  data.ux.push({ ...data.messaging[1], pageUrl: `${url}about` });
  assert.equal(dashboardModel(data).findings.length, 7);
});

test("incomplete and uncollected citations cannot inflate supported finding counts", () => {
  const data = dashboardFixture();
  data.messaging.push(
    { ...issue("No source"), evidence: "" },
    issue("Wrong page", "High", "https://other.example/"),
  );
  const model = dashboardModel(data);
  assert.equal(model.findings.length, 6);
  assert.equal(model.unsupported, 2);
});

test("coverage deduplicates fragments and sources, excludes unsafe links, and never invents a collected page", () => {
  const data = dashboardFixture();
  data.pagesAnalyzed!.push({ ...data.pagesAnalyzed![0], url: `${url}#main` });
  data.pagesAnalyzed!.push({
    ...data.pagesAnalyzed![0],
    url: "https://missing.example/",
    contentHash: "missing",
  });
  data.sources.push("javascript:alert(1)", "https://name:secret@example.org/");
  const model = dashboardModel(data);
  assert.equal(model.pages.length, 1);
  assert.equal(model.sourceLinks.length, 2);
  assert.equal(model.researchAvailable, false);
  assert.equal(
    sourceURL("https://site.example/page#id"),
    "https://site.example/page",
  );
});

test("research availability requires recorded research instead of inferring success from a source count or agent label", () => {
  const data = dashboardFixture();
  data.agentSteps = [
    { name: "Research Agent", status: "completed", detail: "Old record" },
  ];
  assert.equal(dashboardModel(data).researchAvailable, false);
  data.research = {
    provider: "Recorded research",
    modelUsed: "test",
    summary: "Collected research context.",
    searchedAt: data.analyzedAt,
    sources: [
      "https://research.example/bakery",
      "https://research.example/bakery#one",
    ],
    queries: ["bakery context"],
  };
  assert.equal(dashboardModel(data).researchAvailable, true);
  assert.equal(dashboardModel(data).researchLinks.length, 1);
});

test("quick-win counts require a retained parent finding and exclude duplicate or larger-effort suggestions", () => {
  const data = dashboardFixture();
  const win = {
    action: "Clarify the collection promise",
    impact: "A hypothesis to check.",
    effort: "Low" as const,
    relatedIssue: data.messaging[1],
  };
  data.quickWins = [
    win,
    { ...win },
    { ...win, relatedIssue: issue("Not retained") },
    { ...win, relatedIssue: data.ux[0], effort: "High" },
  ];
  assert.equal(dashboardModel(data).quickWins.length, 1);
});

test("check readiness uses complete section results for the current URL and excludes mismatched device measurements", () => {
  const data = dashboardFixture();
  data.securityAudit = securityAudit;
  data.accessibilityAudit = accessibilityAudit;
  assert.deepEqual(
    dashboardModel(data).checks.map((item) => item.available),
    [true, true, false],
  );
  data.url = "https://other.example/";
  assert.deepEqual(
    dashboardModel(data).checks.map((item) => item.available),
    [false, false, false],
  );
  const speed = speedReport();
  data.url = speed.url;
  data.pageSpeedReports = { mobile: speed };
  assert.equal(dashboardModel(data).checks[2].available, true);
  data.pageSpeedReports = { desktop: speed };
  assert.equal(dashboardModel(data).checks[2].available, false);
});

test("complete exports retain findings beyond a visible shortlist and explain scores, evidence and untested scope", () => {
  const data = dashboardFixture();
  const plan = dashboardPlan(data);
  for (const item of dashboardModel(data).findings)
    assert.ok(plan.includes(item.issue.title));
  for (const text of [
    "76/100",
    "Equal average of 5",
    "SHA-256",
    "not a whole-domain crawl",
    "No current results",
    "Web research: Not available",
  ])
    assert.ok(plan.includes(text), text);
  assert.equal(plan.includes("Only the saved shortlist"), false);
});
