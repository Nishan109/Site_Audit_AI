import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import type { MessagingAnalysis } from "../src/lib/messaging";
import { MESSAGING_CRITERIA } from "../src/lib/messaging";
import type { Issue, AuditResult } from "../src/lib/types";
import {
  messagingPlan,
  messagingIssueKey,
} from "../src/lib/messaging-presentation";
let Section: typeof import("../src/components/MessagingSection").default;
let TabPanel: typeof import("../src/components/TabPanel").default;
let IssueCard: typeof import("../src/components/IssueCard").default;
before(async () => {
  Section = (await import("../src/components/MessagingSection")).default;
  TabPanel = (await import("../src/components/TabPanel")).default;
  IssueCard = (await import("../src/components/IssueCard")).default;
});
afterEach(cleanup);
const source = {
  id: "M1-C1",
  pageUrl: "https://orbital.example/services",
  quote: "Deployment tools for independent developers.",
  kind: "body copy",
  region: "main",
};
const analysis: MessagingAnalysis = {
  method: "copy-evidence-review-v1",
  summary:
    "Orbital identifies its deployment tools and audience in supporting copy.",
  summarySources: [source],
  strengths: [
    {
      text: "The copy names its developer audience and deployment offering.",
      source,
    },
  ],
  criteria: MESSAGING_CRITERIA.map(({ key }) => ({
    key,
    score: 82,
    reason:
      "The supporting sentence states the offering and the intended reader.",
    sources: [source],
  })),
  scope: { pages: 1, blocks: 8, truncated: true },
  verification: { checked: 4, retained: 3, withheld: 1 },
};
const issue: Issue = {
  title: "Clarify the portfolio headline",
  detail:
    "Build without limits does not name the actual deployment tools described in supporting copy.",
  priority: "High",
  messagingCriterion: "clarity",
  evidence: "Build without limits.",
  pageUrl: source.pageUrl,
  messagingEvidence: [
    { ...source, id: "M1-C2", kind: "heading", quote: "Build without limits." },
    source,
  ],
  copySuggestion: {
    original: "Build without limits.",
    replacement: source.quote,
    sources: [source],
  },
  fixSteps: [
    {
      title: "Name the offering",
      description: "Consider naming deployment tools in the headline.",
    },
    {
      title: "Read the supporting copy",
      description:
        "Read the proposed headline with the audience sentence in context.",
    },
  ],
};
const secondIssue: Issue = {
  ...issue,
  title: "Simplify the supporting sentence",
  priority: "Low",
  messagingCriterion: "consistency",
  copySuggestion: undefined,
};
const mount = (issues = [secondIssue, issue]) =>
  render(
    createElement(Section, {
      analysis,
      issues,
      url: "https://orbital.example",
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );

test("copy finding queue preserves priority order and combines wording/area filters", () => {
  const view = mount();
  const queue = within(
    view.getByRole("group", { name: "Select a copy finding" }),
  );
  const choices = queue.getAllByRole("button");
  assert.ok(choices[0].textContent?.includes(issue.title));
  assert.ok(choices[1].textContent?.includes(secondIssue.title));
  assert.equal(choices[0].getAttribute("aria-pressed"), "true");
  fireEvent.click(choices[1]);
  assert.ok(view.getByRole("heading", { name: secondIssue.title }));
  fireEvent.click(view.getByText(/^More filters/));
  fireEvent.click(view.getByRole("button", { name: "With wording options 1" }));
  assert.ok(view.getByRole("heading", { name: issue.title }));
  assert.equal(view.queryByRole("heading", { name: secondIssue.title }), null);
  fireEvent.change(view.getByLabelText("Copy improvement focus area"), {
    target: { value: "consistency" },
  });
  assert.ok(view.getByText("No improvements match these filters."));
  fireEvent.click(view.getByRole("button", { name: "Show all improvements" }));
  fireEvent.click(
    view.getByRole("button", {
      name: `Select finding 2: ${secondIssue.title}`,
    }),
  );
  assert.ok(view.getByRole("heading", { name: secondIssue.title }));
});

test("editing and restoring wording keeps the source and original audit score intact", () => {
  const view = mount([issue]);
  const draft = view.getByRole("textbox", {
    name: `Wording draft for ${issue.title}`,
  }) as HTMLTextAreaElement;
  assert.equal(draft.value, source.quote);
  fireEvent.change(draft, { target: { value: "My own wording draft." } });
  assert.ok(view.getByText("Edited by you"));
  assert.ok(view.getByText(/Your changes have not been reviewed by AI/));
  assert.equal(
    view
      .getByRole("meter", { name: "Messaging and copy assessment" })
      .getAttribute("aria-valuenow"),
    "82",
  );
  fireEvent.click(view.getByRole("button", { name: "Restore suggestion" }));
  assert.equal(draft.value, source.quote);
  assert.ok(view.getByText("AI wording option"));
  assert.equal(view.queryByText("Edited by you"), null);
});

test("copying wording uses the current edited draft and an empty draft cannot be copied", async () => {
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  const view = mount([issue]);
  const draft = view.getByRole("textbox", {
    name: `Wording draft for ${issue.title}`,
  });
  fireEvent.change(draft, {
    target: { value: "Edited wording that I will verify." },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy wording" }));
  });
  assert.equal(copied, "Edited wording that I will verify.");
  assert.ok(view.getByText(/These edits have not been reviewed by AI/));
  fireEvent.change(draft, { target: { value: " " } });
  assert.equal(
    (view.getByRole("button", { name: "Copy wording" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test("copy plan includes filtered-out findings and labels user edits as unreviewed", async () => {
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  const view = mount();
  fireEvent.change(
    view.getByRole("textbox", { name: `Wording draft for ${issue.title}` }),
    { target: { value: "My edited headline." } },
  );
  fireEvent.click(view.getByText(/^More filters/));
  fireEvent.click(view.getByRole("button", { name: "With wording options 1" }));
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy full plan" }));
  });
  for (const text of [
    issue.title,
    secondIssue.title,
    "My edited headline.",
    "Your edited draft · not reviewed by AI",
    source.pageUrl,
    "do not update the original audit scores",
  ])
    assert.ok(copied.includes(text));
});

test("editing while a clipboard operation is pending cannot report stale success", async () => {
  let resolve!: () => void;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    },
  });
  const view = mount([issue]);
  fireEvent.click(view.getByRole("button", { name: "Copy wording" }));
  fireEvent.change(
    view.getByRole("textbox", { name: `Wording draft for ${issue.title}` }),
    { target: { value: "A newer draft." } },
  );
  await act(async () => {
    resolve();
  });
  assert.equal(view.queryByText(/Suggested wording copied/), null);
});

test("download exports actual draft content and copy denial offers a usable alternative", async (t) => {
  let exported: Blob | undefined;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    exported = blob as Blob;
    return "blob:copy-plan";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "orbital.example-messaging-plan.txt");
    },
  );
  const view = mount([issue]);
  fireEvent.change(
    view.getByRole("textbox", { name: `Wording draft for ${issue.title}` }),
    { target: { value: "The current draft." } },
  );
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy full plan" }));
  });
  assert.ok(view.getByText(/Copying is unavailable/));
  fireEvent.click(
    view.getByRole("button", { name: "Download messaging plan" }),
  );
  const text = await exported!.text();
  assert.ok(text.includes("The current draft."));
  assert.ok(text.includes(source.pageUrl));
});

test("wording drafts survive report navigation and reset for a new audit", () => {
  const report: AuditResult = {
    url: "https://orbital.example",
    analyzedAt: "2026-11-07T10:00:00Z",
    analysisId: "audit-1",
    summary: analysis.summary,
    overview: analysis.summary,
    scores: { Messaging: 82, UX: 80, SEO: 80, Conversion: 80 },
    messaging: [issue],
    messagingAnalysis: analysis,
    ux: [],
    seo: [],
    conversion: [],
    quickWins: [],
    topIssues: [],
    searchQueries: [],
    sources: [],
    agentSteps: [],
  };
  const props = {
    result: report,
    generatedFixSteps: {},
    onFixStepsLoaded: () => {},
  };
  const view = render(
    createElement(TabPanel, { ...props, activeTab: "messaging" }),
  );
  fireEvent.change(
    view.getByRole("textbox", { name: `Wording draft for ${issue.title}` }),
    { target: { value: "Draft retained between sections." } },
  );
  view.rerender(createElement(TabPanel, { ...props, activeTab: "ux" }));
  assert.equal(
    view.queryByRole("textbox", { name: `Wording draft for ${issue.title}` }),
    null,
  );
  view.rerender(createElement(TabPanel, { ...props, activeTab: "messaging" }));
  assert.equal(
    (
      view.getByRole("textbox", {
        name: `Wording draft for ${issue.title}`,
      }) as HTMLTextAreaElement
    ).value,
    "Draft retained between sections.",
  );
  view.rerender(
    createElement(TabPanel, {
      ...props,
      result: { ...report, analysisId: "audit-2" },
      activeTab: "messaging",
    }),
  );
  assert.equal(
    (
      view.getByRole("textbox", {
        name: `Wording draft for ${issue.title}`,
      }) as HTMLTextAreaElement
    ).value,
    source.quote,
  );
});

test("plan helper preserves empty edits instead of silently restoring an AI suggestion", () => {
  const text = messagingPlan(analysis, [issue], "https://orbital.example", {
    [messagingIssueKey(issue, 0)]: "",
  });
  assert.ok(text.includes("(Draft is empty)"));
  assert.ok(text.includes("Your edited draft"));
});
test("messaging review exposes source copy, score reasons, strengths and sampling limits", () => {
  const view = render(
    createElement(Section, {
      analysis,
      issues: [],
      url: "https://orbital.example",
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );
  assert.ok(view.getByText(analysis.summary));
  assert.ok(view.getByText(analysis.strengths[0].text));
  assert.ok(view.getByText("1 page reviewed"));
  assert.ok(view.getByText(/8 copy blocks reviewed/));
  fireEvent.click(view.getByText("How this score was assessed"));
  for (const rubric of MESSAGING_CRITERIA)
    assert.ok(view.getByText(rubric.label));
  assert.ok(
    view.getByText(
      /Draft suggestions that could not be supported were withheld/,
    ),
  );
  assert.ok(view.getByText(/Some copy was shortened or excluded/));
  assert.ok(
    view
      .getAllByRole("link", { hidden: true })
      .some((link) => link.getAttribute("href") === source.pageUrl),
  );
});
test("a source-backed wording option stays attached to the real issue and its action plan", () => {
  const issue = {
    priority: "Medium" as const,
    title: "Name the offering in the headline",
    detail:
      "The headline is abstract, though supporting copy names deployment tools.",
    evidence: "Build without limits.",
    pageUrl: source.pageUrl,
    fixSteps: [
      {
        title: "Consider clearer wording",
        description: "Name deployment tools in a proposed headline.",
      },
    ],
    copySuggestion: {
      original: "Build without limits.",
      replacement: source.quote,
      sources: [source],
    },
  };
  const view = render(
    createElement(IssueCard, {
      issue,
      url: "https://orbital.example",
      index: 0,
    }),
  );
  const suggestion = within(
    view.getByRole("region", { name: "Suggested wording" }),
  );
  assert.ok(suggestion.getByText(issue.copySuggestion.original));
  assert.ok(suggestion.getByText(issue.copySuggestion.replacement));
  assert.ok(suggestion.getByText("Facts used in this suggestion"));
  fireEvent.click(view.getByRole("button", { name: /View action plan/ }));
  assert.ok(view.getByText("Name deployment tools in a proposed headline."));
});
test("ordinary and older issues do not acquire an invented wording suggestion", () => {
  const view = render(
    createElement(IssueCard, {
      issue: {
        priority: "Low",
        title: "An existing content finding",
        detail: "This finding was created before the copy review upgrade.",
      },
      url: "https://orbital.example",
      index: 0,
    }),
  );
  assert.equal(view.queryByRole("region", { name: "Suggested wording" }), null);
});
