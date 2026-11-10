import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { extractEvidence } from "../src/lib/server/evidence";
import { extractUXEvidence, uxCatalog } from "../src/lib/server/ux-evidence";
import {
  reviewUX,
  uxDraftSchema,
  uxVerificationSchema,
  contradictsUXNames,
} from "../src/lib/server/ux";
import { UX_CRITERIA, uxScore, type UXSource } from "../src/lib/ux";
import { AuditError } from "../src/lib/server/errors";

const html = `<html><head><title>Developer portfolio</title></head><body><nav aria-label="Main navigation"><a href="#projects">Projects</a><a href="#contact">Contact</a></nav><main><h1>Cloud engineering projects</h1><section id="projects"><h2>Infrastructure projects</h2><p>Explore practical deployment projects and technical work.</p></section><section id="contact"><h2>Contact</h2><form id="contact-form" action="/contact"><label for="name">Your name</label><input id="name" name="name" required><input id="email" name="email" type="email" required><button>Send message</button></form></section></main></body></html>`;
const page = extractEvidence(html, "https://portfolio.example/", true);
const catalog = uxCatalog([page]);
const source = (kind: UXSource["kind"], list = catalog) =>
  list.find((item) => item.kind === kind)!;
const email = catalog.find(
  (item) =>
    item.kind === "field" && JSON.parse(item.observation).id === "email",
)!;
type Draft = z.infer<typeof uxDraftSchema>;
type Verification = z.infer<typeof uxVerificationSchema>;
function criteria(list = catalog, score = 10): Draft["criteria"] {
  return Object.fromEntries(
    UX_CRITERIA.map(({ key }) => {
      const kind =
        key === "navigation"
          ? "navigation"
          : key === "structure"
            ? "heading"
            : key === "controls"
              ? "button"
              : "field";
      return [
        key,
        {
          score,
          reason:
            "The available HTML observations support a limited assessment of this criterion.",
          evidenceIds: [
            (
              source(kind, list) ||
              source(key === "controls" ? "link" : "page", list)
            ).id,
          ],
        },
      ];
    }),
  ) as Draft["criteria"];
}
function draft(): Draft {
  return {
    summary:
      "The page presents engineering projects and a contact form with navigation links.",
    criteria: criteria(),
    strengths: [
      {
        text: "Navigation links identify the Projects and Contact destinations.",
        evidenceIds: [source("navigation").id],
      },
    ],
    issues: [
      {
        criterion: "forms",
        priority: "Medium",
        title: "Email input has no detectable HTML label",
        detail:
          "The email field has no associated label, aria-label or aria-labelledby name in the collected HTML.",
        evidenceIds: [email.id],
        fixSteps: [
          {
            title: "Add a persistent label",
            description:
              "Associate an Email label with the input's existing email ID.",
          },
          {
            title: "Check the interaction",
            description: "Verify the field and label together in a browser.",
          },
        ],
      },
    ],
    quickWins: [
      {
        action: "Associate an Email label with the email input",
        impact: "Makes the purpose of the observed field explicit.",
        effort: "Low",
        issueNumber: 1,
        evidenceIds: [email.id],
      },
    ],
  };
}
function verification(
  candidates: { id: string }[],
  list = catalog,
): Verification {
  const assessment = criteria(list, 80);
  assessment.navigation.score = 90;
  assessment.controls.score = 90;
  assessment.forms.score = 50;
  return {
    summary: {
      text: "The collected HTML contains navigation, section headings and explicit control information for a limited UX review.",
      evidenceIds: [source("page", list).id],
    },
    criteria: assessment,
    checks: candidates.map(({ id }) => ({ id, decision: "supported" })),
  };
}
const prototype = Object.getPrototypeOf(
  new GoogleGenAI({ apiKey: "test-only" }).models,
);
function mockReview(
  t: TestContext,
  proposed = draft(),
  edit?: (value: Verification, prompt: string) => void,
  list = catalog,
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
        return { text: JSON.stringify(proposed), modelVersion: "ux-draft" };
      const result = verification(
        JSON.parse(prompt.split("\nCandidates: ")[1]),
        list,
      );
      edit?.(result, prompt);
      return { text: JSON.stringify(result), modelVersion: "ux-verifier" };
    },
  );
  return prompts;
}

test("UX extraction records names, form ownership, privacy and actual submit controls", () => {
  const result = extractUXEvidence(
    `<body><main><form id="f"><label for="email">Email address</label><input id="email" type="email" value="private-prefill@example.test"><label>Message<textarea name="message"></textarea></label><button type="button" aria-label="Open help"><svg><path d="M0 0"></path></svg></button><button>Send</button><input type="hidden" value="private-token"></form><span id="outside-label" hidden>Company</span><input id="outside" form="f" aria-labelledby="outside-label"><button><svg><title>Search</title></svg></button><input hidden value="another-private-value"></main></body>`,
    page.url,
  );
  const fields = result.sources
    .filter((item) => item.kind === "field")
    .map((item) => JSON.parse(item.observation));
  assert.equal(fields.length, 3);
  assert.equal(
    fields.find((field) => field.id === "email").name,
    "Email address",
  );
  assert.equal(
    fields.find((field) => field.fieldName === "message").nameFrom,
    "label element",
  );
  assert.equal(fields.find((field) => field.id === "outside").form, "form-1");
  assert.equal(fields.find((field) => field.id === "outside").name, "Company");
  const form = JSON.parse(
    result.sources.find((item) => item.kind === "form")!.observation,
  );
  assert.equal(form.fields, 3);
  assert.equal(form.submitControls.length, 1);
  assert.equal(form.submitControls[0].name, "Send");
  assert.ok(
    result.sources.some(
      (item) =>
        item.kind === "button" &&
        JSON.parse(item.observation).name === "Search",
    ),
  );
  assert.ok(!JSON.stringify(result).includes("private-prefill"));
  assert.ok(!JSON.stringify(result).includes("private-token"));
  assert.ok(!JSON.stringify(result).includes("another-private-value"));
});

test("radio groups, disabled and readonly fields do not inflate form question counts", () => {
  const result = extractUXEvidence(
    `<form><input type="radio" name="plan" required aria-label="Basic"><input type="radio" name="plan" aria-label="Pro"><input type="text" name="name" required aria-label="Name"><input disabled required name="disabled"><input readonly required name="readonly"><fieldset disabled><legend><input name="legend" aria-label="Legend control"></legend><input name="fieldset-disabled" required></fieldset></form>`,
    page.url,
  );
  const form = JSON.parse(
    result.sources.find((item) => item.kind === "form")!.observation,
  );
  assert.equal(form.editableQuestions, 3);
  assert.equal(form.requiredQuestions, 2);
  const plain = result.sources
    .filter((item) => item.kind === "field")
    .map((item) => JSON.parse(item.observation));
  assert.equal(plain.find((item) => item.fieldName === "name").type, "text");
  assert.equal(
    plain.find((item) => item.fieldName === "fieldset-disabled").disabled,
    true,
  );
  assert.equal(
    plain.find((item) => item.fieldName === "legend").disabled,
    false,
  );
});

test("fragment evidence reports only HTML target presence, not tested link behavior", () => {
  const result = extractUXEvidence(
    `<nav><a href="#known">Known</a><a href="#runtime">Menu</a><a href="#">Open dialog</a></nav><main id="known"><button aria-controls="runtime" aria-expanded="false" aria-label="Open menu"></button></main>`,
    page.url,
  );
  const links = result.sources
    .filter((item) => item.kind === "link")
    .map((item) => JSON.parse(item.observation));
  assert.equal(links[0].targetInInitialHTML, true);
  assert.equal(links[1].targetInInitialHTML, false);
  assert.equal(links[2].targetInInitialHTML, "not an on-page fragment");
  assert.ok(links.every((item) => item.destinationKind.includes("not tested")));
  assert.ok(!JSON.stringify(result).includes('"broken":true'));
});

test("sampling keeps observations valid JSON and discloses omitted content", () => {
  const inputs = Array.from(
    { length: 190 },
    (_, i) =>
      `<label for="f${i}">${"Long label ".repeat(50)} ${i}</label><input id="f${i}" name="field${i}">`,
  ).join("");
  const result = extractUXEvidence(
    `<nav aria-label="Main"><a href="/">Home</a></nav><form>${inputs}</form>`,
    page.url,
  );
  assert.equal(result.truncated, true);
  assert.ok(result.sources.length <= 140);
  assert.ok(result.sources.some((item) => item.kind === "navigation"));
  for (const item of result.sources)
    assert.doesNotThrow(() => JSON.parse(item.observation));
});

test("UX findings use verified element observations and independently reassessed scores", async (t) => {
  const prompts = mockReview(t);
  const result = await reviewUX([page], AbortSignal.timeout(2000));
  assert.equal(prompts.length, 2);
  assert.equal(result.data.score, 80);
  assert.equal(result.data.issues.length, 1);
  assert.equal(result.data.issues[0].evidenceType, "html-observation");
  assert.equal(
    result.data.quickWins[0].relatedIssue?.title,
    result.data.issues[0].title,
  );
  assert.equal(
    result.data.quickWins[0].uxEvidence[0].observation,
    email.observation,
  );
  assert.equal(
    result.data.issues[0].uxEvidence[0].observation,
    email.observation,
  );
  assert.equal(result.analysis.method, "html-ux-review-v1");
  assert.equal(result.analysis.scope.forms, 1);
  assert.ok(
    result.analysis.unassessed.some((text) => text.includes("validation")),
  );
  assert.equal(result.modelUsed, "ux-draft / ux-verifier");
});

test("a real observation cannot preserve a contradictory criticism or its quick win", async (t) => {
  const proposed = draft();
  proposed.issues[0].title = "The Send message button has no name";
  proposed.issues[0].detail =
    "The form submission button is unnamed and gives no indication of its purpose.";
  proposed.issues[0].criterion = "controls";
  proposed.issues[0].evidenceIds = [source("button").id];
  mockReview(t, proposed, (result, prompt) => {
    assert.ok(prompt.includes("Send message"));
    assert.ok(!result.checks.some((check) => check.id === "issue-1"));
  });
  const result = await reviewUX([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 0);
  assert.equal(result.data.quickWins.length, 0);
  assert.equal(result.analysis.verification.withheld, 2);
});

test("existing native and ARIA names deterministically contradict claims that controls are unnamed", () => {
  const named = {
    ...source("button"),
    observation: '{"name":"Open menu","nameFrom":"aria-label"}',
  };
  assert.equal(
    contradictsUXNames("Menu button has no accessible name", [named]),
    true,
  );
  assert.equal(contradictsUXNames("Unnamed menu button", [named]), true);
  assert.equal(
    contradictsUXNames("Make the existing label more specific", [named]),
    false,
  );
  assert.equal(
    contradictsUXNames("Email input is missing a label", [email]),
    false,
  );
  assert.equal(
    contradictsUXNames("Inputs have no associated labels", [named, email]),
    false,
  );
  const form = {
    ...source("form"),
    observation:
      '{"fieldLabels":[{"name":"","nameFrom":"none detected in HTML"}]}',
  };
  assert.equal(
    contradictsUXNames("Form inputs have no labels", [form, named]),
    false,
  );
});

test("visual defects and unrelated citations are withheld before the second review", async (t) => {
  const proposed = draft();
  proposed.issues[0].title = "Mobile navigation padding is too small";
  proposed.issues[0].detail =
    "The responsive menu has insufficient padding and poor contrast on mobile.";
  proposed.issues.push({
    ...structuredClone(draft().issues[0]),
    evidenceIds: [source("heading").id],
  });
  const prompts = mockReview(t, proposed);
  const result = await reviewUX([page], AbortSignal.timeout(2000));
  assert.equal(result.data.issues.length, 0);
  assert.equal(result.data.quickWins.length, 0);
  const candidates = JSON.parse(prompts[1].split("\nCandidates: ")[1]);
  assert.ok(
    !candidates.some((item: { id: string }) => item.id.startsWith("issue-")),
  );
});

test("no observed forms means an unassessed criterion, not a penalty or an invented perfect score", async (t) => {
  const noForms = extractEvidence(
    `<main><h1>Project index</h1><nav><a href="/projects">Projects</a></nav><p>Explore the technical project index and related documentation.</p></main>`,
    page.url,
    true,
  );
  const list = uxCatalog([noForms]);
  const proposed = {
    ...draft(),
    strengths: [],
    issues: [],
    quickWins: [],
    criteria: criteria(list),
  };
  mockReview(
    t,
    proposed,
    (result) => {
      result.criteria.forms = {
        score: 100,
        reason:
          "The site has no forms, so it is incorrectly assigned a perfect form score.",
        evidenceIds: [source("page", list).id],
      };
    },
    list,
  );
  const result = await reviewUX([noForms], AbortSignal.timeout(2000));
  assert.equal(
    result.analysis.criteria.find((item) => item.key === "forms")!.score,
    null,
  );
  assert.equal(result.data.score, 87);
  assert.ok(
    !result.analysis.unassessed.some((text) =>
      text.includes("submitting forms"),
    ),
  );
});

test("an entirely unassessed UX review has no invented numeric score", async (t) => {
  mockReview(t, draft(), (result) => {
    for (const item of Object.values(result.criteria)) item.score = null;
  });
  const result = await reviewUX([page], AbortSignal.timeout(2000));
  assert.equal(result.data.score, null);
  assert.equal(uxScore(result.analysis.criteria), null);
});

test("a final score cannot cite unrelated or invented evidence", async (t) => {
  mockReview(t, draft(), (result) => {
    result.criteria.forms.evidenceIds = [source("heading").id];
  });
  await assert.rejects(
    () => reviewUX([page], AbortSignal.timeout(2000)),
    (error) =>
      error instanceof AuditError && error.code === "UNSUPPORTED_FINDING",
  );
});

test("the verifier must cover candidates exactly once and cannot add issues", async (t) => {
  mockReview(t, draft(), (result) => {
    result.checks.push({ id: "invented-finding", decision: "supported" });
  });
  await assert.rejects(
    () => reviewUX([page], AbortSignal.timeout(2000)),
    (error) =>
      error instanceof AuditError && error.code === "INVALID_AI_RESPONSE",
  );
});

test("an incomplete first UX verification is retried and all retained advice still receives an evidence decision", async (t) => {
  let attempts = 0;
  mockReview(t, draft(), (result) => {
    if (++attempts === 1) result.checks.pop();
  });
  const result = await reviewUX([page], AbortSignal.timeout(2000));
  assert.equal(attempts, 2);
  assert.ok(result.data.issues.length > 0);
  assert.ok(result.data.issues.every((issue) => issue.uxEvidence.length > 0));
});

test("positive browser-test claims in the final summary fail rather than masquerade as measured UX", async (t) => {
  mockReview(t, draft(), (result) => {
    result.summary.text =
      "The page has excellent mobile responsiveness and contrast across every screen size.";
  });
  await assert.rejects(
    () => reviewUX([page], AbortSignal.timeout(2000)),
    (error) => error instanceof AuditError && error.code === "INVALID_UX_SCOPE",
  );
});
