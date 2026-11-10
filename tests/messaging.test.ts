import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { extractEvidence } from "../src/lib/server/evidence";
import {
  extractMessagingCopy,
  messagingCatalog,
} from "../src/lib/server/messaging-evidence";
import {
  reviewMessaging,
  messagingDraftSchema,
  messagingVerificationSchema,
  supportableRewrite,
} from "../src/lib/server/messaging";
import { messagingIssueSchema } from "../src/lib/server/schemas";
import { MESSAGING_CRITERIA } from "../src/lib/messaging";
import { AuditError } from "../src/lib/server/errors";

const home = extractEvidence(
  `<html><head><title>Orbital</title><meta name="description" content="Metadata must not be mistaken for a visible headline"></head><body>
  <nav><a href="/about">Learn more</a></nav>
  <main><header><h1>Build without limits.</h1><p>Orbital provides deployment tools for independent developers.</p></header>
  <section><h2>Projects</h2><p>Deploy applications to AWS and GCP.</p><a href="/projects">Learn more</a></section>
  <div><span>Explore our deployment guides.</span></div>
  <p hidden>Invented hidden discount 90%</p><p aria-hidden="true">Hidden fake customers</p><p style="display: none">Hidden claims</p>
  </main><footer><a href="/contact">Contact</a></footer></body></html>`,
  "https://orbital.example/",
  true,
);
const about = extractEvidence(
  `<html><head><title>About Orbital</title></head><body><main><h1>Tools for independent developers</h1><p>Orbital focuses on clear documentation and practical deployment workflows.</p></main></body></html>`,
  "https://orbital.example/about",
  true,
);
const pages = [home, about];
const catalog = messagingCatalog(pages);
const headline = catalog.find(
  (source) => source.quote === "Build without limits.",
)!;
const support = catalog.find((source) =>
  source.quote.startsWith("Orbital provides"),
)!;
const aboutCopy = catalog.find((source) =>
  source.quote.startsWith("Orbital focuses"),
)!;
type Draft = z.infer<typeof messagingDraftSchema>;
type Verification = z.infer<typeof messagingVerificationSchema>;
function criteria(score: number) {
  return Object.fromEntries(
    MESSAGING_CRITERIA.map(({ key }) => [
      key,
      {
        score,
        reason:
          "The collected copy clearly identifies developer deployment tools.",
        evidenceIds: [support.id],
      },
    ]),
  ) as Draft["criteria"];
}
function draft(): Draft {
  return {
    summary:
      "Orbital describes deployment tools, with an abstract main headline.",
    criteria: criteria(10),
    strengths: [
      {
        text: "The supporting sentence identifies deployment tools for independent developers.",
        evidenceId: support.id,
      },
    ],
    issues: [
      {
        criterion: "clarity",
        priority: "Medium",
        title: "Make the headline more concrete",
        detail:
          "The phrase 'Build without limits.' could describe many products; naming deployment tools could make it more specific.",
        evidenceId: headline.id,
        supportingEvidenceIds: [support.id],
        fixSteps: [
          {
            title: "Name the offering",
            description: "Consider a headline that names deployment tools.",
          },
          {
            title: "Retain the audience detail",
            description:
              "Keep the supporting sentence for independent developers.",
          },
        ],
        copySuggestion: {
          original: "Build without limits.",
          replacement: "Deployment tools for independent developers.",
          evidenceIds: [support.id],
        },
      },
    ],
    quickWins: [],
  };
}
function verification(candidates: { id: string }[]): Verification {
  const scores = criteria(80);
  scores.clarity.score = 90;
  scores.specificity.score = 70;
  scores.consistency.score = 85;
  return {
    summary: {
      text: "Orbital identifies deployment tools for independent developers in the supporting copy; a more specific headline is an optional improvement.",
      evidenceIds: [headline.id, support.id],
    },
    criteria: scores,
    checks: candidates.map(({ id }) => ({
      id,
      decision: "supported",
      reason: "The cited source copy supports this particular observation.",
    })),
  };
}

test("a too-short optional copy replacement retries the draft before independent verification", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-only";
  process.env.GEMINI_MODEL = "schema-retry-test";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  });
  const valid = draft();
  valid.issues.push({
    ...structuredClone(valid.issues[0]),
    title: "Clarify the main heading",
  });
  const incomplete = structuredClone(valid);
  incomplete.issues[1].copySuggestion!.replacement = "";
  const prompts: string[] = [];
  const draftModels: string[] = [];
  let verificationCalls = 0;
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      const prompt = (request.contents as { parts: { text: string }[] }[])[0]
        .parts[0].text;
      if (prompt.includes("\nCandidates: ")) {
        verificationCalls++;
        return {
          text: JSON.stringify(
            verification(JSON.parse(prompt.split("\nCandidates: ")[1])),
          ),
          modelVersion: "independent-verifier",
        };
      }
      prompts.push(prompt);
      draftModels.push(request.model);
      return {
        text: JSON.stringify(draftModels.length === 1 ? incomplete : valid),
        modelVersion: request.model,
      };
    },
  );
  const review = await reviewMessaging(pages, AbortSignal.timeout(5000));
  assert.deepEqual(draftModels, ["schema-retry-test", "gemini-3.5-flash-lite"]);
  assert.equal(prompts[0], prompts[1]);
  assert.equal(verificationCalls, 1);
  // Existing evidence-based deduplication still merges the repeated criticism.
  assert.equal(review.data.issues.length, 1);
  assert.ok(
    review.data.issues.every(
      (issue) =>
        issue.copySuggestion?.replacement ===
        valid.issues[0].copySuggestion!.replacement,
    ),
  );
  assert.ok(
    review.data.issues.every(
      (issue) => issue.messagingEvidence?.[0].pageUrl === headline.pageUrl,
    ),
  );
});
const prototype = Object.getPrototypeOf(
  new GoogleGenAI({ apiKey: "test-only" }).models,
);
function mockReview(
  t: TestContext,
  proposed = draft(),
  inspect?: (result: Verification, prompt: string) => void,
) {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  t.after(() => {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
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
        return { text: JSON.stringify(proposed), modelVersion: "draft-model" };
      const candidates = JSON.parse(prompt.split("\nCandidates: ")[1]);
      const result = verification(candidates);
      inspect?.(result, prompt);
      return {
        text: JSON.stringify(result),
        modelVersion: "verification-model",
      };
    },
  );
  return prompts;
}

test("copy extraction preserves main/context distinctions and excludes hidden/metadata content", () => {
  assert.equal(headline.region, "main");
  assert.equal(headline.kind, "heading");
  assert.ok(
    catalog.some(
      (source) =>
        source.quote === "Learn more" && source.region === "navigation",
    ),
  );
  assert.ok(
    catalog.some(
      (source) => source.quote === "Learn more" && source.region === "main",
    ),
  );
  assert.ok(
    catalog.some((source) => source.quote === "Explore our deployment guides."),
  );
  assert.ok(!JSON.stringify(catalog).includes("Hidden"));
  assert.ok(!JSON.stringify(catalog).includes("Invented hidden discount"));
  assert.ok(!JSON.stringify(catalog).includes("Metadata must not"));
  assert.equal(
    new Set(catalog.map((source) => source.id)).size,
    catalog.length,
  );
  assert.equal(aboutCopy.pageUrl, about.url);
  assert.ok(
    catalog.some(
      (source) => source.kind === "link" && source.destination === "/projects",
    ),
  );
});

test("main copy survives a long navigation menu and sampling is disclosed", () => {
  const menu = Array.from(
    { length: 190 },
    (_, i) => `<a href="/${i}">Navigation item ${i}</a>`,
  ).join("");
  const result = extractMessagingCopy(
    `<body><nav>${menu}</nav><main><h1>Our actual offering</h1><p>Practical tools for independent developers.</p></main></body>`,
  );
  assert.equal(result.blocks[0].text, "Our actual offering");
  assert.equal(result.truncated, true);
  assert.equal(result.blocks.length, 160);
});

test("inline values stay in complete sentences instead of creating artificial copy gaps", () => {
  const result = extractMessagingCopy(
    `<body><main><div><span class="explanation">The average donation in <span>the United States</span> is around <span>$13</span>. Many first-time donors give <span>$2.75</span>.</span><p>Thank you for supporting free information.</p></div></main></body>`,
  );
  assert.ok(
    result.blocks.some(
      (block) =>
        block.text ===
        "The average donation in the United States is around $13. Many first-time donors give $2.75.",
    ),
  );
  assert.ok(
    !result.blocks.some((block) =>
      block.text.includes("donation in is around"),
    ),
  );
  const bare = extractMessagingCopy(
    "<body>A resource for independent developers with practical deployment guides.</body>",
  );
  assert.equal(
    bare.blocks[0].text,
    "A resource for independent developers with practical deployment guides.",
  );
  const link = extractMessagingCopy(
    '<main><h1>Our bakery</h1><a href="/order">Click here</a></main>',
  ).blocks.filter((block) => block.text === "Click here");
  assert.equal(link.length, 1);
  assert.equal(link[0].kind, "link");
  assert.equal(link[0].destination, "/order");
});

test("verified messaging uses corrected rubric scores, real sources and grounded suggested copy", async (t) => {
  const prompts = mockReview(t);
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(prompts.length, 2);
  assert.ok(!prompts[1].includes('"score":10'));
  assert.ok(prompts[1].includes(aboutCopy.quote));
  assert.ok(prompts[0].includes("reference sites"));
  assert.ok(
    prompts[0].includes("Navigation/footer text is not a hero headline"),
  );
  assert.equal(result.data.score, 82);
  assert.equal(result.data.issues.length, 1);
  const issue = result.data.issues[0];
  assert.equal(issue.evidence, headline.quote);
  assert.equal(issue.pageUrl, headline.pageUrl);
  assert.equal(
    issue.copySuggestion?.replacement,
    "Deployment tools for independent developers.",
  );
  assert.ok(
    issue.copySuggestion?.sources.some((source) => source.id === support.id),
  );
  assert.deepEqual(messagingIssueSchema.parse(issue), issue);
  assert.equal(result.analysis.summarySources[0].quote, headline.quote);
  assert.equal(result.analysis.strengths[0].source.quote, support.quote);
  assert.equal(result.analysis.verification.withheld, 0);
  assert.equal(result.modelUsed, "draft-model / verification-model");
});

test("a genuine quote cannot preserve a criticism contradicted by surrounding copy", async (t) => {
  const proposed = draft();
  proposed.issues[0].title = "No explanation of what Orbital offers";
  proposed.issues[0].detail =
    "The website never explains what Orbital offers or who it serves.";
  mockReview(t, proposed, (result, prompt) => {
    assert.ok(prompt.includes(support.quote));
    assert.ok(prompt.includes(aboutCopy.quote));
    result.checks.find((check) => check.id === "issue-1")!.decision =
      "unsupported";
  });
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.issues.length, 0);
  assert.ok(result.analysis.verification.withheld >= 1);
  assert.equal(result.analysis.strengths.length, 1);
});

test("a rewrite with an invented capability is withheld while a valid issue survives", async (t) => {
  const proposed = draft();
  proposed.issues[0].copySuggestion!.replacement =
    "Deployment tools with managed Kubernetes clusters for independent developers.";
  mockReview(t, proposed, (result) => {
    result.checks.find((check) => check.id === "rewrite-1")!.decision =
      "unsupported";
  });
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.issues[0].copySuggestion, undefined);
  assert.equal(result.analysis.verification.withheld, 1);
});

test("uncollected evidence, invented numbers and inaccurate original quotes are rejected before verification", async (t) => {
  const proposed = draft();
  proposed.issues[0].copySuggestion!.replacement =
    "Deployment tools with 99.9% uptime and 30 days free.";
  proposed.strengths[0].evidenceId = "M99-C99";
  const prompts = mockReview(t, proposed);
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.issues[0].copySuggestion, undefined);
  assert.equal(result.analysis.strengths.length, 0);
  assert.equal(result.analysis.verification.withheld, 2);
  const candidates = JSON.parse(prompts[1].split("\nCandidates: ")[1]);
  assert.ok(
    !candidates.some((item: { id: string }) => item.id === "rewrite-1"),
  );
  assert.equal(
    supportableRewrite(
      "Not the original headline",
      "A grounded suggestion",
      headline,
      [headline, support],
    ),
    false,
  );
  assert.equal(
    supportableRewrite(
      headline.quote,
      "Artisanal organic handmade deployment tools.",
      headline,
      [headline, support],
    ),
    false,
  );
  assert.equal(
    supportableRewrite(
      headline.quote,
      "Contact hello@invented.example",
      headline,
      [headline, support],
    ),
    false,
  );
});

test("supported messaging quick wins retain their exact source and verified parent finding", async (t) => {
  const proposed = draft();
  proposed.quickWins.push({
    action: "Clarify the headline wording",
    impact: "May make the actual offering easier to understand.",
    effort: "Low",
    evidenceId: headline.id,
    issueNumber: 1,
  });
  mockReview(t, proposed);
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(
    result.data.quickWins[0].relatedIssue?.title,
    result.data.issues[0].title,
  );
  assert.equal(
    result.data.quickWins[0].messagingEvidence[0].quote,
    headline.quote,
  );
});
test("uncertain quick wins and duplicate criticisms are not presented as established findings", async (t) => {
  const proposed = draft();
  proposed.issues.push(structuredClone(proposed.issues[0]));
  proposed.quickWins.push({
    action: "Add testimonials from paying customers",
    impact: "Reduce uncertainty for visitors.",
    effort: "Low",
    evidenceId: headline.id,
    issueNumber: 1,
  });
  mockReview(t, proposed, (result) => {
    result.checks.find((check) => check.id === "win-1")!.decision = "uncertain";
  });
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.quickWins.length, 0);
});

test("a quick win cannot survive a rejected parent issue even if the checker approves it", async (t) => {
  const proposed = draft();
  proposed.quickWins.push({
    action: "Clarify the headline wording",
    impact: "Makes the offering easier to understand.",
    effort: "Low",
    evidenceId: headline.id,
    issueNumber: 1,
  });
  mockReview(t, proposed, (result) => {
    result.checks.find((check) => check.id === "issue-1")!.decision =
      "unsupported";
  });
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.quickWins.length, 0);
  assert.equal(result.data.issues.length, 0);
});

test("verification must cover every candidate exactly once", async (t) => {
  mockReview(t, draft(), (result) => {
    result.checks.push(result.checks[0]);
  });
  await assert.rejects(
    () => reviewMessaging(pages, AbortSignal.timeout(1000)),
    (error) =>
      error instanceof AuditError && error.code === "INVALID_AI_RESPONSE",
  );
});

test("unused verbose verification notes do not invalidate supported messaging findings", async (t) => {
  mockReview(t, draft(), (result) => {
    Object.assign(result.checks[0], {
      reason: "An unused provider explanation. ".repeat(100),
    });
  });
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.score, 82);
});

test("final scores and summary cannot cite invented copy IDs", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.clarity.evidenceIds = ["M9-C90"];
  });
  await assert.rejects(
    () => reviewMessaging(pages, AbortSignal.timeout(1000)),
    (error) =>
      error instanceof AuditError && error.code === "UNSUPPORTED_FINDING",
  );
});

test("empty readable-copy evidence fails explicitly without a template review", async () => {
  await assert.rejects(
    () => reviewMessaging([], AbortSignal.timeout(1000)),
    (error) =>
      error instanceof AuditError &&
      error.code === "INSUFFICIENT_COPY_EVIDENCE",
  );
});

test("rewrite checks reject invented offers and currency claims even when a number appears elsewhere", () => {
  const original = {
    ...support,
    quote: "We provide 30 deployment tools for developers.",
  };
  assert.equal(
    supportableRewrite(
      original.quote,
      "Get deployment tools for $30.",
      original,
      [original],
    ),
    false,
  );
  assert.equal(
    supportableRewrite(
      original.quote,
      "Get unlimited deployment tools for free.",
      original,
      [original],
    ),
    false,
  );
  assert.equal(
    supportableRewrite(original.quote, original.quote, original, [original]),
    false,
  );
  const priced = { ...support, quote: "The toolkit costs $30." };
  assert.equal(
    supportableRewrite(
      original.quote,
      "Deployment toolkit for $30.",
      original,
      [original, priced],
    ),
    true,
  );
});

test("responsive date variants are annotated and cannot produce a static formatting defect", async (t) => {
  const collected = extractMessagingCopy(
    '<main><p><span class="hidden md:inline">Jan 2024 – Present</span><span class="md:hidden">Jan 2024</span></p></main>',
  );
  assert.ok(
    collected.blocks.some((block) =>
      block.renderingNote?.includes("responsive display classes"),
    ),
  );
  const proposed = draft();
  proposed.issues[0].title = "Minor formatting quirk in date range string";
  proposed.issues[0].detail = "The date string merges text without spacing.";
  const prompts = mockReview(t, proposed);
  const result = await reviewMessaging(pages, AbortSignal.timeout(1000));
  assert.equal(result.data.issues.length, 0);
  const candidates = JSON.parse(prompts[1].split("\nCandidates: ")[1]);
  assert.ok(
    !candidates.some(
      (item: { id: string }) =>
        item.id === "issue-1" || item.id === "rewrite-1",
    ),
  );
});
