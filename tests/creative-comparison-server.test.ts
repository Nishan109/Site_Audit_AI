import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { creativeComparisonResponse as POST } from "../src/lib/server/creative-comparison-response";
import {
  buildCreativeComparison,
  scoreCreative,
} from "../src/lib/server/creative-comparison";
import { independentCreativeSchema } from "../src/lib/server/schemas";
import {
  isComparisonResult,
  REVIEW_CRITERIA,
  REVIEW_WEIGHTS,
} from "../src/lib/creative-comparison";

const prototype = Object.getPrototypeOf(
  new GoogleGenAI({ apiKey: "test-only" }).models,
);
const strong = independentCreativeSchema.parse({
  criteria: Object.fromEntries(
    REVIEW_CRITERIA.map(({ key }) => [
      key,
      {
        score: 90,
        evidence: `The ${key} is clear: bold dark headline and prominent purple 'View portfolio' button.`,
      },
    ]),
  ),
  strengths: ["High contrast headline and a visible View portfolio button"],
  weaknesses: ["The support text could be shorter"],
  improvements: ["Shorten the line underneath the headline."],
});
const weak = independentCreativeSchema.parse({
  criteria: Object.fromEntries(
    REVIEW_CRITERIA.map(({ key }) => [
      key,
      {
        score: 35,
        evidence: `The ${key} is difficult to read: faint gray text and a small bottom-right button.`,
      },
    ]),
  ),
  strengths: ["The simple layout leaves generous space"],
  weaknesses: ["Faint headline and distant low-contrast call to action"],
  improvements: ["Darken the headline and bring the button closer to it."],
});
// Signature-valid test payloads: pixels are not sent anywhere in these mocked
// provider tests. The live verification uses real PNG artwork separately.
const image = (id: string) =>
  "data:image/png;base64," +
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from(id),
  ]).toString("base64");
const imageStrong = image("strong"),
  imageWeak = image("weak");
const request = (body: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/analyze-creatives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://example.com",
      imageA: imageWeak,
      imageB: imageStrong,
      ...body,
    }),
  });
function configuration() {
  const key = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-only";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  return () => {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
    if (model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = model;
  };
}
function parts(request: GenerateContentParameters) {
  return (
    request.contents as {
      parts: { text?: string; inlineData?: { data: string } }[];
    }[]
  )[0].parts;
}
function responseFor(request: GenerateContentParameters) {
  const data = parts(request).find((part) => part.inlineData)?.inlineData?.data;
  return {
    text: JSON.stringify(data === imageStrong.split(",")[1] ? strong : weak),
    modelVersion: request.model,
  };
}

test("the same assessments select the stronger content in either upload slot", () => {
  const forward = buildCreativeComparison(strong, weak, "Overall clarity");
  const reversed = buildCreativeComparison(weak, strong, "Overall clarity");
  assert.equal(forward.winner, "Creative A");
  assert.equal(reversed.winner, "Creative B");
  assert.deepEqual(forward.creativeA, reversed.creativeB);
  assert.deepEqual(forward.creativeB, reversed.creativeA);
  assert.ok(reversed.rationale.includes(weak.criteria.message.evidence));
  assert.ok(reversed.rationale.includes(strong.criteria.message.evidence));
  assert.equal(isComparisonResult(reversed), true);
});

test("close scores tie symmetrically; a larger gap can favor either creative", () => {
  const scored = (score: number) => ({
    ...strong,
    criteria: Object.fromEntries(
      REVIEW_CRITERIA.map(({ key }) => [
        key,
        { ...strong.criteria[key], score },
      ]),
    ) as typeof strong.criteria,
  });
  for (const [a, b, winner] of [
    [80, 83, "Tie"],
    [83, 80, "Tie"],
    [80, 80, "Tie"],
    [80, 84, "Creative B"],
    [84, 80, "Creative A"],
  ] as const) {
    const result = buildCreativeComparison(
      scored(a),
      scored(b),
      "Overall clarity",
    );
    assert.equal(result.winner, winner);
    assert.equal(isComparisonResult(result), true);
  }
});

test("the selected focus changes weighting using a consistent explicit rubric", () => {
  const a = structuredClone(strong),
    b = structuredClone(strong);
  a.criteria.message.score = 95;
  a.criteria.action.score = 35;
  b.criteria.message.score = 35;
  b.criteria.action.score = 95;
  assert.equal(
    buildCreativeComparison(a, b, "Message & audience").winner,
    "Creative A",
  );
  assert.equal(
    buildCreativeComparison(a, b, "Call to action").winner,
    "Creative B",
  );
  for (const weights of Object.values(REVIEW_WEIGHTS))
    assert.equal(
      Object.values(weights).reduce((a, b) => a + b, 0),
      100,
    );
  assert.equal(scoreCreative(strong, "Overall clarity"), 90);
});

test("the API isolates images, maps B correctly, and swaps evidence with content", async (t) => {
  const restore = configuration();
  const captured: GenerateContentParameters[] = [];
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      captured.push(request);
      assert.equal(parts(request).filter((part) => part.inlineData).length, 1);
      assert.ok(
        !JSON.stringify(request.config?.responseJsonSchema).includes(
          '"winner"',
        ),
      );
      return responseFor(request);
    },
  );
  try {
    const first = await POST(request());
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Cache-Control"), "no-store");
    const result = await first.json();
    assert.equal(result.winner, "Creative B");
    assert.equal(result.creativeB.score, 90);
    assert.deepEqual(result.creativeA.strengths, weak.strengths);
    assert.deepEqual(result.creativeB.strengths, strong.strengths);
    assert.equal(result.creativeB.predictedCtr, "Not measured");
    assert.equal(result.reviewMethod, "independent-rubric-v1");
    assert.equal(isComparisonResult(result), true);
    assert.equal(captured.length, 2);
    // No slot name is supplied to either isolated request; equal context/copy
    // gives byte-identical instructions, regardless of which slot owns it.
    assert.equal(parts(captured[0])[0].text, parts(captured[1])[0].text);
    const reversed = await (
      await POST(request({ imageA: imageStrong, imageB: imageWeak }))
    ).json();
    assert.equal(reversed.winner, "Creative A");
    assert.deepEqual(reversed.creativeA, result.creativeB);
    assert.deepEqual(reversed.creativeB, result.creativeA);
  } finally {
    restore();
  }
});

test("identical images and normalized copy get one genuine assessment and an exact tie", async (t) => {
  const restore = configuration();
  const mocked = t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => responseFor(request),
  );
  try {
    const response = await POST(
      request({
        imageA: imageStrong,
        imageB: imageStrong,
        textA: "  View portfolio\r\nExplore work.  ",
        textB: "View portfolio\nExplore work.",
      }),
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(mocked.mock.callCount(), 1);
    assert.equal(data.winner, "Tie");
    assert.equal(data.identicalInputs, true);
    assert.deepEqual(data.creativeA, data.creativeB);
    assert.ok(data.rationale.includes("same image and supplied copy"));
    assert.equal(isComparisonResult(data), true);
  } finally {
    restore();
  }
});

test("identical images with different supplied copy are assessed separately", async (t) => {
  const restore = configuration();
  const captured: GenerateContentParameters[] = [];
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      captured.push(request);
      return {
        text: JSON.stringify(
          parts(request)[0].text!.includes('"Clear portfolio invitation"')
            ? strong
            : weak,
        ),
        modelVersion: request.model,
      };
    },
  );
  try {
    const data = await (
      await POST(
        request({
          imageA: imageStrong,
          imageB: imageStrong,
          textA: "Confusing message",
          textB: "Clear portfolio invitation",
        }),
      )
    ).json();
    assert.equal(captured.length, 2);
    assert.equal(data.identicalInputs, false);
    assert.equal(data.winner, "Creative B");
    assert.ok(
      !parts(captured[0])[0].text!.includes('"Clear portfolio invitation"'),
    );
  } finally {
    restore();
  }
});

test("a failure in one assessment cancels its sibling and reruns both on one fallback model", async (t) => {
  const restore = configuration();
  const captured: GenerateContentParameters[] = [];
  let siblingAborted = false;
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      captured.push(request);
      if (request.model === "gemini-3.5-flash") {
        const data = parts(request).find((part) => part.inlineData)?.inlineData
          ?.data;
        if (data === imageWeak.split(",")[1])
          throw Object.assign(new Error("Quota exhausted"), { status: 429 });
        const signal = request.config!.abortSignal!;
        return new Promise((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => {
              siblingAborted = true;
              reject(signal.reason);
            },
            { once: true },
          ),
        );
      }
      return responseFor(request);
    },
  );
  try {
    const response = await POST(request());
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(siblingAborted, true);
    assert.deepEqual(
      captured.map((item) => item.model),
      [
        "gemini-3.5-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
      ],
    );
    assert.equal(data.modelUsed, "gemini-3.5-flash-lite");
    assert.equal(data.winner, "Creative B");
  } finally {
    restore();
  }
});

test("invalid AI criteria fail the comparison without returning a substitute winner", async (t) => {
  const restore = configuration();
  t.mock.method(prototype, "generateContentInternal", async () => ({
    text: JSON.stringify({ winner: "Creative A", creativeA: { score: 85 } }),
  }));
  try {
    const response = await POST(request());
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.equal(data.code, "INVALID_AI_RESPONSE");
    assert.equal(data.winner, undefined);
  } finally {
    restore();
  }
});

test("cancelling a comparison aborts both independent requests", async (t) => {
  const restore = configuration();
  const controller = new AbortController();
  let calls = 0,
    aborted = 0;
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      calls++;
      const signal = request.config!.abortSignal!;
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted++;
            reject(signal.reason);
          },
          { once: true },
        );
        if (calls === 2) controller.abort();
      });
    },
  );
  try {
    const original = request();
    const response = await POST(
      new Request(original, { signal: controller.signal }),
    );
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, "AI_TIMEOUT");
    assert.equal(calls, 2);
    assert.equal(aborted, 2);
  } finally {
    restore();
  }
});
