import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { extractEvidence } from "../src/lib/server/evidence";
import { conversionCatalog } from "../src/lib/server/conversion-evidence";
import {
  reviewConversion,
  conversionDraftSchema,
  conversionVerificationSchema,
  unsupportedConversionClaim,
  contradictsConversionFacts,
  unestablishedButtonClaim,
} from "../src/lib/server/conversion";
import { conversionScore, CONVERSION_CRITERIA } from "../src/lib/conversion";
import { auditSchema } from "../src/lib/server/schemas";
import { AuditError } from "../src/lib/server/errors";

const page = extractEvidence(
  '<html><head><title>Ada — Engineer</title></head><body><main><h1>Ada builds reliable cloud infrastructure</h1><p>Explore Ada’s Terraform projects and contact Ada about cloud engineering roles.</p><a href="/projects">Explore</a><a href="mailto:ada@example.com">Email Ada about a role</a></main></body></html>',
  "https://portfolio.example/",
  true,
);
const catalog = conversionCatalog([page]);
const source = (kind: (typeof catalog)[number]["kind"]) =>
  catalog.find((item) => item.kind === kind)!;
type Draft = z.infer<typeof conversionDraftSchema>;
type Verification = z.infer<typeof conversionVerificationSchema>;
function draft(): Draft {
  return {
    strengths: [
      {
        text: "The email link identifies the contact action and its purpose.",
        evidenceIds: [source("link").id],
      },
    ],
    issues: [
      {
        criterion: "actions",
        priority: "Low",
        title: "Clarify the project exploration label",
        detail:
          "The collected Explore link does not name its project destination in the label itself; a more specific label is a clarity hypothesis.",
        evidenceIds: [source("link").id],
        fixSteps: [
          {
            title: "Name the destination",
            description:
              "Consider View projects when it matches the existing destination.",
          },
          {
            title: "Verify the affected path",
            description:
              "Check the destination and surrounding context before publishing the label.",
          },
        ],
      },
    ],
    quickWins: [
      {
        action: "Consider a project-specific link label",
        impact:
          "Could make the declared next step more explicit; validate in context.",
        effort: "Low",
        issueNumber: 1,
        evidenceIds: [source("link").id],
      },
    ],
  };
}
function verification(candidates: { id: string }[]): Verification {
  return {
    summary: {
      text: "Ada’s portfolio provides project exploration and email contact options in its collected page content.",
      evidenceIds: [source("copy").id, source("link").id],
    },
    goal: {
      text: "Explore Ada’s work or contact Ada about a cloud engineering role.",
      evidenceIds: [source("copy").id],
    },
    actionIds: [source("link").id],
    criteria: Object.fromEntries(
      CONVERSION_CRITERIA.map(({ key }) => [
        key,
        {
          score: key === "actions" ? 70 : key === "expectations" ? 80 : 90,
          reason:
            "The cited observations support a limited clarity assessment of the available next steps.",
          evidenceIds: [
            source(
              key === "actions" ? "link" : key === "forms" ? "page" : "copy",
            ).id,
          ],
        },
      ]),
    ) as Verification["criteria"],
    checks: candidates.map(({ id }) => ({ id, decision: "supported" })),
  };
}
const prototype = Object.getPrototypeOf(
  new GoogleGenAI({ apiKey: "test-only" }).models,
);
function mockReview(
  t: TestContext,
  proposed = draft(),
  change?: (result: Verification) => void,
) {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  t.after(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
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
        return {
          text: JSON.stringify(proposed),
          modelVersion: "conversion-draft",
        };
      const result = verification(
        JSON.parse(prompt.split("\nCandidates: ")[1]),
      );
      change?.(result);
      return {
        text: JSON.stringify(result),
        modelVersion: "conversion-verifier",
      };
    },
  );
  return prompts;
}
const unsupported = (error: unknown) =>
  error instanceof AuditError && error.code === "UNSUPPORTED_FINDING";

test("conversion observations retain real mail links, names and copy with site-specific identities", () => {
  const email = catalog.find((source) =>
    source.observation.includes("mailto:ada@example.com"),
  );
  assert.ok(email);
  assert.ok(
    catalog.some(
      (item) => item.kind === "copy" && item.observation.includes("Terraform"),
    ),
  );
  assert.ok(
    catalog.every(
      (item) => item.pageUrl === page.url && item.id.startsWith("C1-E"),
    ),
  );
  assert.equal(
    catalog.some((item) => item.kind === "form"),
    false,
  );
});
test("form observations exclude hidden values and count editable radio questions once", () => {
  const formPage = extractEvidence(
    '<main><form><input type="hidden" name="csrf" value="do-not-collect-secret"><label for="email">Your email</label><input id="email" name="email" required value="private-value"><fieldset><legend>Enquiry type</legend><label><input type="radio" name="reason" required>Project</label><label><input type="radio" name="reason">Role</label></fieldset><input readonly aria-label="Reference"><input disabled aria-label="Disabled"><button>Send enquiry</button></form></main>',
    "https://example.com/",
    true,
  );
  const sources = conversionCatalog([formPage]),
    form = JSON.parse(
      sources.find((source) => source.kind === "form")!.observation,
    );
  assert.equal(form.editableQuestions, 2);
  assert.equal(form.requiredQuestions, 2);
  assert.ok(
    form.submitControls.some(
      (control: { name: string }) => control.name === "Send enquiry",
    ),
  );
  assert.equal(
    JSON.stringify(sources).includes("do-not-collect-secret"),
    false,
  );
  assert.equal(JSON.stringify(sources).includes("private-value"), false);
});
test("independent conversion verification preserves evidence and excludes unobserved forms from weighting", async (t) => {
  const prompts = mockReview(t),
    result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(prompts.length, 2);
  assert.equal(result.data.score, 79);
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "forms")!.score,
    null,
  );
  assert.equal(result.data.issues[0].conversionCriterion, "actions");
  assert.equal(
    result.data.quickWins[0].relatedIssue?.title,
    result.data.issues[0].title,
  );
  assert.equal(
    result.data.quickWins[0].conversionEvidence[0].observation,
    source("link").observation,
  );
  assert.equal(
    result.data.issues[0].conversionEvidence[0].observation,
    source("link").observation,
  );
  assert.equal(result.analysis.actions[0].id, source("link").id);
  assert.equal(result.modelUsed, "conversion-draft / conversion-verifier");
  assert.ok(!prompts[1].includes('"score":70'));
  const parsed = auditSchema.shape.conversion.parse(result.data.issues);
  assert.equal(parsed[0].evidenceType, "conversion-observation");
});
test("an incomplete optional quick-win benefit is withheld while the valid conversion review succeeds", async (t) => {
  const proposed = draft();
  proposed.quickWins[0].impact = "";
  mockReview(t, proposed);
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.quickWins.length, 0);
  assert.ok(result.analysis.verification.withheld >= 1);
});
test("unmeasured lift, broken forms and visual assertions are withheld with their dependent quick wins", async (t) => {
  const proposed = draft();
  proposed.issues[0].detail =
    "This broken form will increase conversions by 35% after fixing mobile layout.";
  mockReview(t, proposed);
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 0);
  assert.equal(result.data.quickWins.length, 0);
  assert.ok(result.analysis.verification.withheld >= 2);
  for (const claim of [
    "Increase completed enquiries by 25%",
    "Conversion rates are low",
    "Broken checkout",
    "Place this above the fold",
  ])
    assert.equal(unsupportedConversionClaim(claim), true, claim);
  assert.equal(
    unsupportedConversionClaim("Make the enquiry destination clearer"),
    false,
  );
});
test("a real named control cannot support an invented missing-label criticism", () => {
  assert.equal(
    contradictsConversionFacts(
      "The link has no accessible label",
      [source("link")],
      [page],
    ),
    true,
  );
});
test("unknown JavaScript button destinations are a testing limitation rather than a conversion defect", () => {
  const button = {
    ...source("link"),
    kind: "button" as const,
    observation: JSON.stringify({
      name: "View architecture",
      destination: "not established by initial HTML",
    }),
  };
  assert.equal(
    unestablishedButtonClaim(
      "Several interactive buttons lack explicit destinations or established navigation behaviors in the initial HTML markup.",
      [button],
    ),
    true,
  );
  assert.equal(
    unestablishedButtonClaim(
      "The label Go does not identify the destination to visitors.",
      [button],
    ),
    false,
  );
  assert.equal(
    contradictsConversionFacts(
      "Buttons lack explicit destinations in initial HTML.",
      [button],
      [page],
    ),
    true,
  );
});
test("uncertain advice cannot survive verification or leave an unrelated quick win", async (t) => {
  mockReview(t, draft(), (result) => {
    result.checks.find((item) => item.id === "issue-1")!.decision = "uncertain";
  });
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 0);
  assert.equal(result.data.quickWins.length, 0);
});
test("invented verifier citations fail explicitly", async (t) => {
  mockReview(t, draft(), (result) => {
    result.summary.evidenceIds = ["C99-E99"];
  });
  await assert.rejects(
    reviewConversion([page], AbortSignal.timeout(2000)),
    unsupported,
  );
});
test("a non-control preview selection is withheld without discarding the verified review", async (t) => {
  mockReview(t, draft(), (result) => {
    result.actionIds = [source("copy").id];
  });
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(result.analysis.actions.length, 0);
  assert.equal(result.data.issues.length, 1);
});
test("missing candidate verification fails rather than producing a partial success", async (t) => {
  mockReview(t, draft(), (result) => {
    result.checks.pop();
  });
  await assert.rejects(
    reviewConversion([page], AbortSignal.timeout(2000)),
    (error: unknown) =>
      error instanceof AuditError && error.code === "INVALID_AI_RESPONSE",
  );
});
test("a final summary cannot introduce unperformed conversion tests", async (t) => {
  mockReview(t, draft(), (result) => {
    result.summary.text =
      "The portfolio conversion rates are low and its broken form loses enquiries.";
  });
  await assert.rejects(
    reviewConversion([page], AbortSignal.timeout(2000)),
    unsupported,
  );
});
test("a numeric action score must cite actual action observations", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.actions.evidenceIds = [source("copy").id];
  });
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "actions")?.score,
    null,
  );
  assert.equal(result.data.score, 86);
  assert.equal(result.data.issues.length, 1);
});

test("an unsupported conversion criterion explanation is excluded without discarding verified findings", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.actions.reason =
      "The broken checkout cannot submit and the low conversion rates lose revenue.";
  });
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  const item = result.analysis.criteria.find((item) => item.key === "actions")!;
  assert.equal(item.score, null);
  assert.match(item.reason, /could not be verified/);
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.quickWins.length, 1);
  assert.equal(
    JSON.stringify(result.analysis).includes("low conversion rates"),
    false,
  );
});

test("unknown criterion citations are withheld and cannot become displayed conversion evidence", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.decision.evidenceIds = ["C99-E999"];
  });
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "decision")?.score,
    null,
  );
  assert.equal(result.data.issues.length, 1);
  assert.equal(JSON.stringify(result.analysis).includes("C99-E999"), false);
});
test("fully unassessed conversion criteria never manufacture a numeric score", async (t) => {
  mockReview(t, draft(), (result) => {
    for (const item of Object.values(result.criteria)) {
      item.score = null;
      item.evidenceIds = [];
    }
  });
  const result = await reviewConversion([page], AbortSignal.timeout(2000));
  assert.equal(result.data.score, null);
  assert.equal(conversionScore(result.analysis.criteria), null);
});
