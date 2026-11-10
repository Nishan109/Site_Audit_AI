import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GoogleGenAI,
  ThinkingLevel,
  FinishReason,
  BlockedReason,
  type GenerateContentParameters,
} from "@google/genai";
import {
  generateContent,
  generateJson,
  generateJsonBatch,
} from "../src/lib/server/gemini";
import { z } from "zod";
import { AuditError } from "../src/lib/server/errors";
import { requireCandidateCoverage } from "../src/lib/server/verification";

const prototype = Object.getPrototypeOf(
  new GoogleGenAI({ apiKey: "test-only" }).models,
);
const success = {
  text: "An evidence-based assessment.",
  modelVersion: "available-model",
};
function configuration() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-only";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  return () => {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
    if (model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = model;
  };
}

test("Gemini 3 uses thinking levels without a legacy budget or sampling override", async (t) => {
  const restore = configuration();
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      assert.equal(
        request.config?.thinkingConfig?.thinkingLevel,
        ThinkingLevel.LOW,
      );
      assert.equal(request.config?.thinkingConfig?.thinkingBudget, undefined);
      assert.equal(request.config?.temperature, undefined);
      return success;
    },
  );
  try {
    await generateContent([{ text: "Review collected website evidence." }]);
  } finally {
    restore();
  }
});

test("an exhausted preferred model falls back to the current Flash-Lite model", async (t) => {
  const restore = configuration();
  const models: string[] = [];
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      models.push(request.model);
      if (models.length === 1)
        throw Object.assign(new Error("Quota exhausted"), { status: 429 });
      return success;
    },
  );
  try {
    assert.equal(
      (await generateContent([{ text: "Review" }])).modelUsed,
      "available-model",
    );
    assert.deepEqual(models, ["gemini-3.5-flash", "gemini-3.5-flash-lite"]);
  } finally {
    restore();
  }
});

test("Gemini 2.5 Flash retains its supported thinking budget on fallback", async (t) => {
  const restore = configuration();
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      if (request.model !== "gemini-2.5-flash")
        throw Object.assign(new Error("Unavailable model"), { status: 404 });
      assert.equal(request.config?.thinkingConfig?.thinkingBudget, 0);
      assert.equal(request.config?.thinkingConfig?.thinkingLevel, undefined);
      return success;
    },
  );
  try {
    await generateContent([{ text: "Review" }]);
  } finally {
    restore();
  }
});

test("a temporary failure of the final fallback is retried instead of ending the audit", async (t) => {
  const restore = configuration();
  const attempts: string[] = [];
  let finalAttempts = 0;
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      attempts.push(request.model);
      if (request.model !== "gemini-2.5-flash")
        throw Object.assign(new Error("Quota exhausted"), { status: 429 });
      if (++finalAttempts === 1)
        throw Object.assign(new Error("High demand"), { status: 503 });
      return success;
    },
  );
  try {
    assert.equal(
      (await generateContent([{ text: "Review" }])).modelUsed,
      "available-model",
    );
    assert.equal(finalAttempts, 2);
    assert.equal(
      attempts.filter((model) => model === "gemini-3.5-flash").length,
      1,
    );
    assert.equal(attempts.length, 5);
  } finally {
    restore();
  }
});

test("persistent overload has bounded retries and an accurate busy error", async (t) => {
  const restore = configuration();
  const mocked = t.mock.method(
    prototype,
    "generateContentInternal",
    async () => {
      throw Object.assign(new Error("High demand"), { status: 503 });
    },
  );
  try {
    await assert.rejects(
      () => generateContent([{ text: "Review" }]),
      (error) => {
        assert.ok(error instanceof AuditError);
        assert.equal(error.status, 503);
        assert.equal(error.code, "AI_BUSY");
        return true;
      },
    );
    assert.equal(mocked.mock.callCount(), 12);
  } finally {
    restore();
  }
});

test("cancelling during retry backoff prevents further provider requests", async (t) => {
  const restore = configuration();
  const controller = new AbortController();
  const mocked = t.mock.method(
    prototype,
    "generateContentInternal",
    async () => {
      throw Object.assign(new Error("High demand"), { status: 503 });
    },
  );
  const timer = setTimeout(() => controller.abort(), 30);
  try {
    await assert.rejects(
      () => generateContent([{ text: "Review" }], {}, controller.signal),
      (error) => {
        assert.ok(error instanceof AuditError);
        assert.equal(error.code, "AI_TIMEOUT");
        return true;
      },
    );
    assert.equal(mocked.mock.callCount(), 4);
  } finally {
    clearTimeout(timer);
    restore();
  }
});

test("nested socket failures try another model", async (t) => {
  const restore = configuration();
  let attempts = 0;
  t.mock.method(prototype, "generateContentInternal", async () => {
    if (++attempts === 1)
      throw new Error("SDK request failed", {
        cause: new Error("Transport error", {
          cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }),
        }),
      });
    return success;
  });
  try {
    await generateContent([{ text: "Review" }]);
    assert.equal(attempts, 2);
  } finally {
    restore();
  }
});

test("nested certificate errors stop immediately without weakening TLS validation", async (t) => {
  const restore = configuration();
  const mocked = t.mock.method(
    prototype,
    "generateContentInternal",
    async () => {
      throw new TypeError("fetch failed", {
        cause: new Error("TLS connection failed", {
          cause: Object.assign(new Error("certificate"), {
            code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
          }),
        }),
      });
    },
  );
  try {
    await assert.rejects(
      () => generateContent([{ text: "Review" }]),
      (error) => error instanceof AuditError && error.code === "AI_CONNECTION",
    );
    assert.equal(mocked.mock.callCount(), 1);
  } finally {
    restore();
  }
});

test("invalid settings and authentication errors are not retried", async (t) => {
  const restore = configuration();
  let status = 400;
  const mocked = t.mock.method(
    prototype,
    "generateContentInternal",
    async () => {
      throw Object.assign(new Error("Rejected"), { status });
    },
  );
  try {
    await assert.rejects(
      () => generateContent([{ text: "Review" }]),
      (error) =>
        error instanceof AuditError && error.code === "AI_REQUEST_INVALID",
    );
    assert.equal(mocked.mock.callCount(), 1);
    status = 403;
    await assert.rejects(
      () => generateContent([{ text: "Review" }]),
      (error) =>
        error instanceof AuditError && error.code === "AI_CONFIGURATION",
    );
    assert.equal(mocked.mock.callCount(), 2);
  } finally {
    restore();
  }
});

test("a slow model leaves time for an available fallback", async (t) => {
  const restore = configuration();
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) =>
    originalTimeout(milliseconds === 30_000 ? 15 : milliseconds),
  );
  const models: string[] = [];
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      models.push(request.model);
      if (models.length > 1) return success;
      const signal = request.config!.abortSignal!;
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      );
    },
  );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await generateContent([
      { text: "Review the uploaded images" },
    ]);
    assert.equal(result.modelUsed, "available-model");
    assert.deepEqual(models, ["gemini-3.5-flash", "gemini-3.5-flash-lite"]);
  } finally {
    clearTimeout(keepAlive);
    restore();
  }
});

test("an incomplete JSON report retries unchanged evidence and schema on a fallback model", async (t) => {
  const restore = configuration();
  const requests: GenerateContentParameters[] = [];
  const schema = z.object({
    score: z.number().int().min(0).max(100),
    summary: z.string().min(20),
  });
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      requests.push(request);
      return {
        text: JSON.stringify(
          requests.length === 1
            ? { summary: "The collected page supports this review." }
            : { score: 0, summary: "The collected page supports this review." },
        ),
        modelVersion: request.model,
      };
    },
  );
  try {
    const result = await generateJson(
      "Review only this supplied evidence; do not fill missing facts.",
      schema,
    );
    assert.equal(result.data.score, 0);
    assert.equal(result.modelUsed, "gemini-3.5-flash-lite");
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0].contents, requests[1].contents);
    assert.deepEqual(
      requests[0].config?.responseJsonSchema,
      requests[1].config?.responseJsonSchema,
    );
  } finally {
    restore();
  }
});

test("malformed JSON and an empty AI response use bounded fallbacks without repairing data", async (t) => {
  const restore = configuration();
  let attempts = 0;
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => ({
      text: ['{"score":', " ", '{"score":42}'][attempts++],
      modelVersion: request.model,
    }),
  );
  try {
    const result = await generateJson(
      "Review the collected evidence.",
      z.object({ score: z.number() }),
    );
    assert.equal(result.data.score, 42);
    assert.equal(attempts, 3);
  } finally {
    restore();
  }
});

test("persistent invalid JSON reports still fail schema validation after at most one attempt per model", async (t) => {
  const restore = configuration();
  const call = t.mock.method(
    prototype,
    "generateContentInternal",
    async () => ({ text: '{"score":150}' }),
  );
  try {
    await assert.rejects(
      () => generateJson("Review", z.object({ score: z.number().max(100) })),
      z.ZodError,
    );
    assert.equal(call.mock.callCount(), 4);
  } finally {
    restore();
  }
});

test("a token-limited response is not accepted as complete merely because its JSON parses", async (t) => {
  const restore = configuration();
  let attempts = 0;
  t.mock.method(prototype, "generateContentInternal", async () => ({
    text: '{"score":55}',
    candidates: [
      {
        finishReason:
          ++attempts === 1 ? FinishReason.MAX_TOKENS : FinishReason.STOP,
      },
    ],
  }));
  try {
    const result = await generateJson(
      "Review",
      z.object({ score: z.number() }),
    );
    assert.equal(result.data.score, 55);
    assert.equal(attempts, 2);
  } finally {
    restore();
  }
});

test("provider content blocks stop immediately instead of routing around the block", async (t) => {
  const restore = configuration();
  const call = t.mock.method(
    prototype,
    "generateContentInternal",
    async () => ({
      text: "",
      candidates: [{ finishReason: FinishReason.SAFETY }],
    }),
  );
  try {
    await assert.rejects(
      () => generateJson("Review", z.object({ score: z.number() })),
      (error) =>
        error instanceof AuditError && error.code === "AI_RESPONSE_BLOCKED",
    );
    assert.equal(call.mock.callCount(), 1);
  } finally {
    restore();
  }
});

test("an unspecified prompt-feedback reason does not reject an otherwise valid report", async (t) => {
  const restore = configuration();
  t.mock.method(prototype, "generateContentInternal", async () => ({
    text: '{"score":55}',
    promptFeedback: { blockReason: BlockedReason.BLOCKED_REASON_UNSPECIFIED },
    candidates: [{ finishReason: FinishReason.STOP }],
  }));
  try {
    assert.equal(
      (await generateJson("Review", z.object({ score: z.number() }))).data
        .score,
      55,
    );
  } finally {
    restore();
  }
});

test("a cancelled request cannot accept a late valid response or start an invalid-response fallback", async (t) => {
  const restore = configuration();
  const controller = new AbortController();
  const call = t.mock.method(prototype, "generateContentInternal", async () => {
    controller.abort();
    return { text: '{"score":55}' };
  });
  try {
    await assert.rejects(
      () =>
        generateJson(
          "Review",
          z.object({ score: z.number() }),
          controller.signal,
        ),
      (error) => error instanceof AuditError && error.code === "AI_TIMEOUT",
    );
    assert.equal(call.mock.callCount(), 1);
  } finally {
    restore();
  }
});

test("invalid JSON in one batch assessment cancels its sibling and retries both on one model", async (t) => {
  const restore = configuration();
  const requests: GenerateContentParameters[] = [];
  let cancelled = false;
  t.mock.method(
    prototype,
    "generateContentInternal",
    async (request: GenerateContentParameters) => {
      requests.push(request);
      const prompt = (request.contents as { parts: { text: string }[] }[])[0]
        .parts[0].text;
      if (request.model === "gemini-3.5-flash") {
        if (prompt === "Review A") return { text: '{"missing":true}' };
        const signal = request.config!.abortSignal!;
        return new Promise((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => {
              cancelled = true;
              reject(signal.reason);
            },
            { once: true },
          ),
        );
      }
      return {
        text: JSON.stringify({ score: prompt === "Review A" ? 20 : 80 }),
        modelVersion: request.model,
      };
    },
  );
  try {
    const result = await generateJsonBatch(
      [
        { prompt: "Review A", images: [] },
        { prompt: "Review B", images: [] },
      ],
      z.object({ score: z.number() }),
    );
    assert.equal(cancelled, true);
    assert.deepEqual(
      result.map((item) => item.data.score),
      [20, 80],
    );
    assert.deepEqual(
      result.map((item) => item.modelUsed),
      ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"],
    );
    assert.deepEqual(
      requests.map((item) => item.model),
      [
        "gemini-3.5-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
      ],
    );
  } finally {
    restore();
  }
});

test("an omitted verification decision retries instead of accepting a partially reviewed report", async (t) => {
  const restore = configuration();
  let attempts = 0;
  const candidates = [{ id: "issue-1" }, { id: "strength-1" }];
  const schema = z.object({
    checks: z.array(
      z.object({
        id: z.string(),
        decision: z.enum(["supported", "unsupported"]),
      }),
    ),
  });
  t.mock.method(prototype, "generateContentInternal", async () => ({
    text: JSON.stringify({
      checks: (++attempts === 1 ? candidates.slice(0, 1) : candidates).map(
        (candidate) => ({ ...candidate, decision: "supported" }),
      ),
    }),
  }));
  try {
    const result = await generateJson(
      "Verify every supplied candidate exactly once.",
      schema,
      undefined,
      [],
      (data) => requireCandidateCoverage(candidates, data.checks, "UX"),
    );
    assert.equal(attempts, 2);
    assert.deepEqual(
      result.data.checks.map((check) => check.id),
      ["issue-1", "strength-1"],
    );
  } finally {
    restore();
  }
});

test("candidate coverage rejects omissions, duplicate decisions and invented IDs; empty candidates require empty checks", () => {
  const candidates = [{ id: "issue-1" }, { id: "strength-1" }];
  for (const checks of [
    [],
    [{ id: "issue-1" }],
    [{ id: "issue-1" }, { id: "issue-1" }],
    [{ id: "issue-1" }, { id: "invented" }],
  ]) {
    assert.throws(
      () => requireCandidateCoverage(candidates, checks, "UX"),
      (error) =>
        error instanceof AuditError && error.code === "INVALID_AI_RESPONSE",
    );
  }
  requireCandidateCoverage([], [], "UX");
  assert.throws(() => requireCandidateCoverage([], [{ id: "invented" }], "UX"));
});
