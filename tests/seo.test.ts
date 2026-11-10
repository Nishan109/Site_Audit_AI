import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { extractEvidence } from "../src/lib/server/evidence";
import {
  extractSEOEvidence,
  seoCatalog,
  seoChecks,
} from "../src/lib/server/seo-evidence";
import {
  reviewSEO,
  seoDraftSchema,
  seoVerificationSchema,
  contradictsSEOFacts,
  unsupportedSEOClaim,
} from "../src/lib/server/seo";
import { SEO_CRITERIA, seoScore } from "../src/lib/seo";
import { AuditError } from "../src/lib/server/errors";

const page = extractEvidence(
  '<html lang="en"><head><title>Acorn Bakery in Bath</title><link rel="canonical" href="/"></head><body><main><h1>Sourdough bread for Saturday collection</h1><p>Acorn Bakery bakes white sourdough and rye tin loaves for collection at our Bath bakery on Saturdays.</p><a href="/menu">Our bread menu</a></main></body></html>',
  "https://bakery.example/",
  true,
  { status: 200, xRobotsTag: [], link: [] },
);
const catalog = seoCatalog([page]);
type Draft = z.infer<typeof seoDraftSchema>;
type Verification = z.infer<typeof seoVerificationSchema>;
const source = (kind: (typeof catalog)[number]["kind"]) =>
  catalog.find((item) => item.kind === kind)!;
function draft(): Draft {
  return {
    strengths: [
      {
        text: "The title specifically identifies the bakery and its location.",
        evidenceIds: [source("metadata").id],
      },
    ],
    issues: [
      {
        criterion: "metadata",
        priority: "Low",
        title: "Add a page-specific meta description",
        detail:
          "No description was collected in the initial HTML. A concise description can express this page's offering, although a search engine may choose another snippet.",
        evidenceIds: [source("metadata").id],
        fixSteps: [
          {
            title: "Summarize the actual page",
            description:
              "Write a short description of sourdough collection in Bath using only the page's facts.",
          },
          {
            title: "Add the description in the page head",
            description:
              "Publish a description meta element and inspect the new page HTML.",
          },
        ],
      },
    ],
    quickWins: [
      {
        action: "Add a factual description of Saturday bread collection",
        impact:
          "Provides a page-specific summary that may be considered for a search snippet.",
        effort: "Low",
        issueNumber: 1,
        evidenceIds: [source("metadata").id],
      },
    ],
  };
}
function verification(candidates: { id: string }[]): Verification {
  const criteria = Object.fromEntries(
    SEO_CRITERIA.map(({ key }) => [
      key,
      {
        score: key === "metadata" ? 70 : 90,
        reason:
          "The cited observations support a limited on-page assessment of these signals.",
        evidenceIds: [
          source(
            key === "discovery"
              ? "canonical"
              : key === "structured"
                ? "structured"
                : key === "content"
                  ? "content"
                  : "metadata",
          ).id,
        ],
      },
    ]),
  ) as Verification["criteria"];
  return {
    summary: {
      text: "The collected bakery page has a specific title and a resolved canonical preference, while no meta description was collected.",
      evidenceIds: [source("metadata").id, source("canonical").id],
    },
    criteria,
    checks: candidates.map(({ id }) => ({ id, decision: "supported" })),
  };
}
const prototype = Object.getPrototypeOf(
  new GoogleGenAI({ apiKey: "test-only" }).models,
);
function mockReview(
  t: TestContext,
  proposed = draft(),
  change?: (result: Verification, prompt: string) => void,
) {
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  t.after(() => {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  });
  const prompts: string[] = [];
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      const prompt = (request.contents as { parts: { text: string }[] }[])[0]
        .parts[0].text;
      prompts.push(prompt);
      if (prompts.length === 1)
        return { text: JSON.stringify(proposed), modelVersion: "seo-draft" };
      const result = verification(
        prompt.includes("\nCandidates: ")
          ? JSON.parse(prompt.split("\nCandidates: ")[1])
          : [],
      );
      change?.(result, prompt);
      return {
        text: JSON.stringify(result),
        modelVersion:
          prompts.length > 2 ? "seo-reassessment" : "seo-verification",
      };
    },
  );
  return prompts;
}

test("SEO extraction preserves metadata, relative/base canonicals and header directives without a fake indexing verdict", () => {
  const result = extractSEOEvidence(
    '<html lang="en"><head><base href="https://example.com/products/"><title>A useful product title</title><meta NAME="DESCRIPTION" content="A factual product summary."><link rel="alternate CANONICAL" href="../item"><meta name="Googlebot" content="noindex, follow"></head><body><main><h1>Product</h1><p>Actual product information for a visitor.</p></main></body></html>',
    "https://example.com/source",
    {
      status: 200,
      xRobotsTag: ["bingbot: noindex"],
      link: [
        '<https://example.com/item>; rel="canonical", <https://example.com/next>; rel="next"',
      ],
    },
  );
  assert.equal(result.canonicals.length, 2);
  assert.ok(
    result.canonicals.every(
      (item) => item.resolved === "https://example.com/item",
    ),
  );
  assert.equal(result.canonicals[1].method, "HTTP header");
  assert.equal(result.directives[0].agent, "googlebot");
  assert.equal(result.directives[1].value, "bingbot: noindex");
  assert.equal(result.descriptions[0], "A factual product summary.");
  assert.equal(result.headersChecked, true);
  assert.equal(result.responseStatus, 200);
  assert.equal("indexed" in result, false);
});

test("relative canonical URLs, distinct HTTP targets and unavailable headers remain distinct", () => {
  const result = extractSEOEvidence(
    '<head><link rel="canonical" href="../preferred"></head>',
    "https://example.com/products/source",
  );
  assert.equal(result.canonicals[0].resolved, "https://example.com/preferred");
  assert.equal(result.headersChecked, false);
  assert.equal(result.responseStatus, null);
  const conflicted = extractEvidence(
    '<head><title>Example</title><link rel="canonical" href="/a"></head><body><h1>Example content</h1></body>',
    "https://example.com/",
    true,
    {
      status: 200,
      xRobotsTag: [],
      link: ['<https://example.com/b>; rel="canonical"'],
    },
  );
  const check = seoChecks([conflicted]).find((check) =>
    check.id.endsWith("canonical"),
  )!;
  assert.equal(check.status, "review");
  assert.match(check.detail, /Different canonical targets/);
});

test("structured-data extraction distinguishes valid JSON syntax, parse failures, microdata and RDFa", () => {
  const result = extractSEOEvidence(
    '<head><script type="application/ld+json">{"@graph":[{"@type":"Person"},{"@type":["WebSite","Organization"]}]}</script><script type="application/ld+json">{bad-json}</script></head><body><main itemscope itemtype="https://schema.org/Person"><div vocab="https://schema.org/" typeof="ProfilePage">A profile</div></main></body>',
    "https://example.com/",
  );
  assert.equal(result.structured.jsonLdBlocks, 2);
  assert.equal(result.structured.invalidJsonLd, 1);
  assert.deepEqual(result.structured.jsonLdTypes, [
    "Person",
    "WebSite",
    "Organization",
  ]);
  assert.deepEqual(result.structured.microdataTypes, [
    "https://schema.org/Person",
  ]);
  assert.deepEqual(result.structured.rdfaTypes, ["ProfilePage"]);
  assert.equal("richResultsEligible" in result.structured, false);
});

test("long title/description values are observations rather than arbitrary length failures", () => {
  const title = "Descriptive title ".repeat(6),
    description = "Factual information about the page. ".repeat(7);
  const page = extractEvidence(
    `<head><title>${title}</title><meta name="description" content="${description}"></head><body><h1>Information</h1></body>`,
    "https://example.com/",
    true,
  );
  const checks = seoChecks([page]);
  assert.equal(
    checks.find((check) => check.id.endsWith("title"))!.status,
    "observed",
  );
  assert.equal(
    checks.find((check) => check.id.endsWith("description"))!.status,
    "observed",
  );
  assert.equal(
    checks.find((check) => check.id.endsWith("canonical"))!.status,
    "not-observed",
  );
  assert.equal(
    checks.find((check) => check.id.endsWith("structured"))!.status,
    "not-observed",
  );
});

test("known observations contradict missing-title/canonical claims, including HTTP canonicals", () => {
  assert.equal(
    contradictsSEOFacts(
      "Missing canonical: add a canonical tag",
      [source("canonical")],
      [page],
    ),
    true,
  );
  assert.equal(
    contradictsSEOFacts("Missing page title", [source("metadata")], [page]),
    true,
  );
  assert.equal(
    contradictsSEOFacts(
      "Add a missing meta description",
      [source("metadata")],
      [page],
    ),
    false,
  );
  assert.equal(
    unsupportedSEOClaim("Description exceeds the 160 characters limit"),
    true,
  );
  assert.equal(unsupportedSEOClaim("This page is not indexed"), true);
  assert.equal(
    unsupportedSEOClaim(
      "The canonical preference has not been checked in Search Console",
    ),
    false,
  );
});

test("absence guards preserve supported improvements and negative conflict statements", () => {
  assert.equal(
    contradictsSEOFacts(
      "Add location context to the page title",
      [source("metadata")],
      [page],
    ),
    false,
  );
  assert.equal(
    contradictsSEOFacts(
      "No canonical conflicts were observed",
      [source("canonical")],
      [page],
    ),
    false,
  );
  assert.equal(
    contradictsSEOFacts(
      "The canonical declaration is missing",
      [source("canonical")],
      [page],
    ),
    true,
  );
});

test("an unmeasured ranking claim is retried once and withheld from the summary without discarding verified findings", async (t) => {
  const prompts = mockReview(t, draft(), (result) => {
    result.summary.text =
      "This bakery ranks first in Google for sourdough bread in Bath.";
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(prompts.length, 3);
  assert.equal(result.analysis.assessmentValidation?.summaryWithheld, true);
  assert.equal(result.data.summary.includes("ranks first"), false);
  assert.equal(result.data.issues.length, 1);
  assert.deepEqual(result.analysis.summarySources, []);
});

test("score explanations cannot contradict real metadata", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.metadata.reason =
      "The page title is missing, so the page cannot provide a descriptive title.";
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "metadata")!.score,
    null,
  );
  assert.deepEqual(result.analysis.assessmentValidation?.withheldCriteria, [
    "metadata",
  ]);
  assert.equal(result.data.score, 90);
  assert.equal(result.data.issues.length, 1);
});

test("the independent SEO review returns real sources and excludes absent structured data from scoring", async (t) => {
  const prompts = mockReview(t);
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(prompts.length, 2);
  assert.equal(result.data.score, 83);
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "structured")!.score,
    null,
  );
  assert.equal(result.data.issues[0].seoCriterion, "metadata");
  assert.equal(
    result.data.issues[0].seoEvidence[0].observation,
    source("metadata").observation,
  );
  assert.equal(result.data.issues[0].evidenceType, "seo-observation");
  assert.equal(
    result.data.quickWins[0].relatedIssue?.title,
    result.data.issues[0].title,
  );
  assert.equal(
    result.data.quickWins[0].seoEvidence[0].observation,
    source("metadata").observation,
  );
  assert.equal(result.analysis.evidence?.length, catalog.length);
  assert.equal(result.modelUsed, "seo-draft / seo-verification");
  assert.ok(!prompts[1].includes('"score":70'));
});

test("a real citation does not rescue an invented missing canonical or its quick win", async (t) => {
  const proposed = draft();
  proposed.issues[0].criterion = "discovery";
  proposed.issues[0].title = "Missing canonical tag";
  proposed.issues[0].detail =
    "No canonical is present, so add a canonical to this page.";
  proposed.issues[0].evidenceIds = [source("canonical").id];
  const prompts = mockReview(t, proposed);
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 0);
  assert.equal(result.data.quickWins.length, 0);
  assert.ok(result.analysis.verification.withheld >= 2);
  assert.ok(
    !JSON.parse(prompts[1].split("\nCandidates: ")[1]).some(
      (item: { id: string }) => item.id === "issue-1",
    ),
  );
});

test("an uncertain description criticism and its dependent quick win are withheld", async (t) => {
  mockReview(t, draft(), (result) => {
    result.checks.find((item) => item.id === "issue-1")!.decision = "uncertain";
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 0);
  assert.equal(result.data.quickWins.length, 0);
});

test("invented score citations remain withheld after reassessment and cannot become displayed evidence", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.metadata.evidenceIds = ["S9-E99"];
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "metadata")!.score,
    null,
  );
  assert.equal(JSON.stringify(result.analysis).includes("S9-E99"), false);
});

test("fully unassessed criteria do not produce a fabricated SEO score", async (t) => {
  mockReview(t, draft(), (result) => {
    for (const item of Object.values(result.criteria)) {
      item.score = null;
      item.evidenceIds = [];
    }
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(result.data.score, null);
  assert.equal(seoScore(result.analysis.criteria), null);
});

test("valid JSON-LD parsing and negated syntax errors are not contradictions", () => {
  const valid = extractEvidence(
    '<head><title>Cloud guides</title><script type="application/ld+json">{"@type":"WebSite","name":"Cloud guides"}</script></head><body><h1>Cloud guides</h1></body>',
    page.url,
    true,
  );
  const sources = seoCatalog([valid]).filter(
    (item) => item.kind === "structured",
  );
  for (const reason of [
    "JSON-LD parsing succeeds with valid syntax.",
    "No JSON-LD syntax errors were detected.",
    "The JSON-LD contains no invalid syntax.",
    "The JSON-LD is not malformed.",
    "JSON-LD syntax errors were not found.",
  ])
    assert.equal(contradictsSEOFacts(reason, sources, [valid]), false, reason);
  for (const reason of [
    "The JSON-LD contains malformed data.",
    "JSON-LD failed to parse.",
    "The JSON-LD has syntax errors.",
  ])
    assert.equal(contradictsSEOFacts(reason, sources, [valid]), true, reason);
  assert.equal(
    contradictsSEOFacts(
      "No missing page title was observed",
      [source("metadata")],
      [page],
    ),
    false,
  );
  assert.equal(
    contradictsSEOFacts(
      "There is no need to add a canonical",
      [source("canonical")],
      [page],
    ),
    false,
  );
});
test("a successful field reassessment preserves other scores, sources and verified findings", async (t) => {
  const prompts = mockReview(t, draft(), (result, prompt) => {
    if (prompt.includes("\nCandidates: "))
      result.criteria.metadata.reason =
        "The page title is missing, preventing a descriptive search title.";
    else {
      result.criteria.metadata.reason =
        "The actual title identifies the bakery and location, while a meta description was not collected.";
      result.criteria.discovery.score = 5;
    }
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(prompts.length, 3);
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "metadata")!.score,
    70,
  );
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "discovery")!.score,
    90,
  );
  assert.deepEqual(result.analysis.assessmentValidation, {
    reassessed: true,
    summaryWithheld: false,
    withheldCriteria: [],
  });
  assert.equal(result.data.score, 83);
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.quickWins.length, 1);
  assert.ok(result.modelUsed.includes("seo-reassessment"));
});
test("failure of the optional reassessment keeps verified work and marks the affected area unassessed", async (t) => {
  mockReview(t, draft(), (result, prompt) => {
    if (!prompt.includes("\nCandidates: "))
      throw new AuditError(
        "Optional reassessment unavailable",
        502,
        "AI_UNAVAILABLE",
      );
    result.criteria.metadata.reason =
      "The page title is missing, preventing a descriptive search title.";
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "metadata")!.score,
    null,
  );
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.analysis.assessmentValidation?.reassessed, true);
});
test("an entirely unverifiable assessment has no invented SEO score or summary", async (t) => {
  mockReview(t, draft(), (result) => {
    result.summary.text =
      "This bakery ranks first on Google for bread in Bath.";
    for (const item of Object.values(result.criteria))
      item.evidenceIds = ["S9-E99"];
  });
  const result = await reviewSEO([page], AbortSignal.timeout(2000));
  assert.equal(result.data.score, null);
  assert.equal(result.analysis.assessmentValidation?.summaryWithheld, true);
  assert.equal(result.data.summary.includes("ranks first"), false);
  assert.equal(result.data.issues.length, 1);
});
test("incomplete candidate verification still fails rather than accepting unverified findings", async (t) => {
  const prompts = mockReview(t, draft(), (result) => {
    result.checks.pop();
  });
  await assert.rejects(
    reviewSEO([page], AbortSignal.timeout(2000)),
    (error: unknown) =>
      error instanceof AuditError && error.code === "INVALID_AI_RESPONSE",
  );
  // One draft, then one verification attempt per configured fallback model.
  assert.equal(prompts.length, 5);
});
test("parent cancellation during reassessment cannot be converted to a completed report", async (t) => {
  const controller = new AbortController();
  mockReview(t, draft(), (result, prompt) => {
    if (!prompt.includes("\nCandidates: ")) {
      controller.abort();
      throw new AuditError("Cancelled", 504, "AI_TIMEOUT");
    }
    result.criteria.metadata.reason =
      "The page title is missing, preventing a descriptive search title.";
  });
  await assert.rejects(reviewSEO([page], controller.signal));
});
