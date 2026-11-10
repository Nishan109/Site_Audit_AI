import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonCopy,
  comparisonReady,
  isComparisonResult,
  reviewText,
  type ComparisonCreative,
  type CreativeReview,
} from "../src/lib/creative-comparison";
import { parseComparisonOptions } from "../src/lib/server/creative";
import { AuditError } from "../src/lib/server/errors";
const creative: ComparisonCreative = {
  headline: "A clear next step",
  copy: "Explore the offering.",
  fit: "contain",
  position: "center",
  asset: {
    src: "data:image/png;base64,test-only",
    name: "first.png",
    width: 1080,
    height: 1080,
  },
};
const result = {
  winner: "Creative A" as const,
  rationale:
    "The first direction has a clearer headline and a more visible call to action.",
  creativeA: {
    score: 82,
    strengths: ["Readable headline"],
    weaknesses: ["Simplify the secondary copy"],
  },
  creativeB: {
    score: 67,
    strengths: ["Clear imagery"],
    weaknesses: ["Improve text contrast"],
  },
  recommendations: ["Test the clearer direction with your audience."],
};
test("comparing requires two images and no pending review or upload", () => {
  const both = { A: creative, B: creative };
  assert.equal(comparisonReady(both, false, false), true);
  assert.equal(
    comparisonReady(
      { ...both, B: { ...creative, asset: undefined } },
      false,
      false,
    ),
    false,
  );
  assert.equal(comparisonReady(both, true, false), false);
  assert.equal(comparisonReady(both, false, true), false);
});
test("review copy contains only the supplied message and fits the server limit", () => {
  assert.equal(comparisonCopy({ ...creative, headline: " ", copy: " " }), "");
  assert.equal(
    comparisonCopy(creative),
    "Headline: A clear next step\nPrimary text: Explore the offering.",
  );
  assert.ok(
    comparisonCopy({
      ...creative,
      headline: "a".repeat(120),
      copy: "b".repeat(3000),
    }).length < 4000,
  );
});
test("the review response guard rejects malformed or out-of-range assessments", () => {
  assert.equal(isComparisonResult(result), true);
  for (const invalid of [
    null,
    {},
    { ...result, winner: "Neither" },
    { ...result, winner: "Creative B" },
    { ...result, creativeA: { ...result.creativeA, score: 60 } },
    { ...result, creativeA: { ...result.creativeA, score: 101 } },
    { ...result, creativeB: { ...result.creativeB, strengths: [{}] } },
    { ...result, recommendations: [] },
  ])
    assert.equal(isComparisonResult(invalid), false);
});
test("review context is optional but invalid requests are client errors", () => {
  assert.deepEqual(parseComparisonOptions({}), {
    textA: "",
    textB: "",
    focus: "Overall clarity",
    audience: "",
  });
  assert.equal(
    parseComparisonOptions({
      focus: "Visual hierarchy",
      audience: "  Recruiters  ",
    }).audience,
    "Recruiters",
  );
  for (const body of [
    { focus: "Predict CTR" },
    { audience: "a".repeat(181) },
    { textA: [] },
    { textB: "b".repeat(4001) },
  ])
    assert.throws(
      () => parseComparisonOptions(body),
      (error) => error instanceof AuditError && error.status === 400,
    );
});
test("the review export records real assessment details without performance estimates", () => {
  const review: CreativeReview = {
    result,
    revision: 1,
    reviewedAt: "2026-11-07T12:00:00Z",
    model: "test-model",
    focus: "Overall clarity",
    audience: "Recruiters",
    names: { A: "first.png", B: "second.png" },
  };
  const output = reviewText(review, "https://example.com/");
  for (const text of [
    result.rationale,
    "first.png",
    "second.png",
    "82/100",
    "Recruiters",
    result.recommendations[0],
    "not an A/B experiment",
  ])
    assert.ok(output.includes(text));
  assert.ok(!output.includes("predictedCtr"));
  assert.ok(!output.includes("conversion lift"));
});
