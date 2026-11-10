import { test } from "node:test";
import assert from "node:assert/strict";
import { groundedReviewSchemas } from "../src/lib/server/grounded-review";
import { issueSchema, quickWinSchema } from "../src/lib/server/schemas";
import {
  extractEvidence,
  evidenceCatalog,
  assertEvidence,
} from "../src/lib/server/evidence";

const pages = [
  extractEvidence(
    "<title>Orbital</title><main><h1>Deployment tools for developers</h1><p>Manage your application deployments.</p></main>",
    "https://orbital.example/",
    true,
  ),
];
const source = evidenceCatalog(pages)[0];
const grounded = groundedReviewSchemas(pages);
const issue = {
  priority: "Low",
  title: "Clarify the deployment offering",
  detail: "Consider naming the specific tools offered to developers.",
  evidence: source.id,
  fixSteps: [
    {
      title: "Review the headline",
      description: "Check whether the headline names the actual offering.",
    },
    {
      title: "Clarify the tools",
      description: "Use only supported details in a proposed revision.",
    },
  ],
};
test("category output selects known citation IDs and the server owns source URLs", () => {
  const result = grounded.categorySchema.parse({
    score: 80,
    summary: "The page describes tools for developers.",
    issues: [{ ...issue, pageUrl: "https://invented.example/wrong" }],
    quickWins: [],
  });
  const [resolved] = grounded.resolve(result.issues);
  assert.equal(resolved.pageUrl, source.pageUrl);
  assert.equal(resolved.evidence, source.quote);
  assert.doesNotThrow(() => assertEvidence([resolved], pages));
});
test("invented IDs and raw unverified quotations cannot pass the category schema", () => {
  for (const evidence of [
    "P99-E99",
    "An invented quotation from the website",
  ]) {
    assert.equal(
      grounded.categorySchema.safeParse({
        score: 80,
        summary: "A summary of the collected page content.",
        issues: [{ ...issue, evidence }],
        quickWins: [],
      }).success,
      false,
    );
  }
  assert.throws(() => grounded.resolve([{ evidence: "P99-E99" }]));
});

test("a source-matched short control label remains valid evidence without padding or invented words", () => {
  assert.equal(
    issueSchema.parse({ ...issue, evidence: "Go", pageUrl: pages[0].url })
      .evidence,
    "Go",
  );
  assert.equal(
    quickWinSchema.parse({
      action: "Clarify the Go label",
      impact: "Explains the destination more clearly.",
      effort: "Low",
      evidence: "Go",
      pageUrl: pages[0].url,
    }).evidence,
    "Go",
  );
  assert.equal(
    issueSchema.safeParse({ ...issue, evidence: " ", pageUrl: pages[0].url })
      .success,
    false,
  );
});
