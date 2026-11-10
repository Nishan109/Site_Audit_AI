import "./component-environment";
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { cleanup, render, fireEvent, act } from "@testing-library/react";
import { UX_CRITERIA, type UXAnalysis } from "../src/lib/ux";
import type { Issue } from "../src/lib/types";
import {
  describeUXSource,
  uxActionPlan,
  uxIssueArea,
} from "../src/lib/ux-presentation";
let IssueCard: typeof import("../src/components/IssueCard").default;
let ScoreBars: typeof import("../src/components/ScoreBars").default;
let Section: typeof import("../src/components/UXSection").default;
before(async () => {
  IssueCard = (await import("../src/components/IssueCard")).default;
  ScoreBars = (await import("../src/components/ScoreBars")).default;
  Section = (await import("../src/components/UXSection")).default;
});
afterEach(cleanup);
const source = {
  id: "U1-E1",
  pageUrl: "https://portfolio.example/contact",
  kind: "field" as const,
  location: "main · field 2",
  observation: '{"id":"email","name":"","nameFrom":"none detected in HTML"}',
};
const analysis: UXAnalysis = {
  method: "html-ux-review-v1",
  summary:
    "The collected page contains clear navigation and an email field with no detectable HTML label.",
  summarySources: [source],
  criteria: UX_CRITERIA.map(({ key }) => ({
    key,
    score: key === "forms" ? null : 80,
    reason:
      key === "forms"
        ? "Not enough form evidence was available in this limited sample."
        : "The collected HTML supports this limited assessment.",
    sources: [source],
  })),
  strengths: [
    {
      text: "The main navigation identifies the Projects destination.",
      sources: [source],
    },
  ],
  scope: {
    pages: 1,
    sources: 10,
    navigation: 1,
    headings: 2,
    links: 3,
    buttons: 1,
    forms: 1,
    fields: 2,
    truncated: true,
  },
  verification: { checked: 5, retained: 4, withheld: 1 },
  unassessed: [
    "Rendered desktop/mobile layout, spacing and visual readability",
    "Entering data, submitting forms, validation and success/error feedback",
  ],
};

const formIssue: Issue = {
  title: "Give the email field a clear label",
  priority: "High",
  uxCriterion: "forms",
  detail: "The email input has no associated label in the collected HTML.",
  evidenceType: "html-observation",
  evidence: source.observation,
  pageUrl: source.pageUrl,
  uxEvidence: [source],
  fixSteps: [
    {
      title: "Add an Email label",
      description: "Associate a visible Email label with the email field.",
    },
    {
      title: "Check the form in a browser",
      description:
        "Verify the new label and keyboard interaction before closing the finding.",
    },
  ],
};
const navigationSource = {
  ...source,
  id: "U1-E2",
  kind: "link" as const,
  location: "navigation · link 1",
  observation:
    '{"name":"Click here","nameFrom":"element content","destination":"https://portfolio.example/projects","destinationKind":"same origin; destination not tested"}',
};
const navigationIssue: Issue = {
  ...formIssue,
  title: "Clarify the projects link",
  priority: "Low",
  uxCriterion: "navigation",
  uxEvidence: [navigationSource],
  detail: "The Projects destination uses the ambiguous label Click here.",
};
const mountSection = (issues = [navigationIssue, formIssue]) =>
  render(
    createElement(Section, {
      analysis,
      issues,
      url: "https://portfolio.example",
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );

test("UX findings are prioritized and area filters preserve real finding identity", () => {
  const view = mountSection();
  assert.ok(view.getByRole("heading", { name: formIssue.title }));
  const queue = view.getAllByRole("button", { name: /^Select UX finding/ });
  assert.ok(queue[0].textContent?.includes(formIssue.title));
  assert.ok(queue[1].textContent?.includes(navigationIssue.title));
  fireEvent.change(view.getByLabelText("UX review area"), {
    target: { value: "forms" },
  });
  assert.ok(view.getByRole("heading", { name: formIssue.title }));
  assert.equal(
    view.queryByRole("heading", { name: navigationIssue.title }),
    null,
  );
  assert.ok(view.getByText(/Showing 1 of 2 findings/));
  fireEvent.click(view.getByRole("button", { name: "Reset filters" }));
  fireEvent.click(
    view.getByRole("button", {
      name: `Select UX finding 2: ${navigationIssue.title}`,
    }),
  );
  assert.ok(view.getByRole("heading", { name: navigationIssue.title }));
});

test("improvement plans and source evidence stay together without a new AI request", (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("No additional request expected");
  });
  const view = mountSection([formIssue]);
  assert.ok(view.getByRole("heading", { name: "Add an Email label" }));
  assert.ok(view.getByText("Observed in the collected page"));
  assert.ok(view.getByText(/Review the affected page and interaction/));
  assert.equal(fetch.mock.callCount(), 0);
});

test("copy exports every finding and the real testing limits even when a filter is active", async () => {
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  const view = mountSection();
  fireEvent.change(view.getByLabelText("UX review area"), {
    target: { value: "forms" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy UX plan" }));
  });
  const { waitFor } = await import("@testing-library/react");
  await waitFor(() => assert.ok(view.getByText(/UX action plan copied/)));
  for (const text of [
    formIssue.title,
    navigationIssue.title,
    "BROWSER TESTING STILL NEEDED",
    source.pageUrl,
    "Add an Email label",
  ])
    assert.ok(copied.includes(text));
  assert.ok(!copied.includes("all tests passed"));
});

test("copy failure provides a download alternative without a false success", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  const view = mountSection();
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy UX plan" }));
  });
  const { waitFor } = await import("@testing-library/react");
  await waitFor(() => assert.ok(view.getByText(/Copying is unavailable/)));
  assert.equal(view.queryByText(/UX action plan copied/), null);
});

test("UX download contains the evidence-backed plan and original actions", async (t) => {
  let exported: Blob | undefined;
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    exported = blob as Blob;
    return "blob:test-plan";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "portfolio.example-ux-action-plan.txt");
    },
  );
  const view = mountSection();
  fireEvent.click(
    view.getByRole("button", { name: "Download UX plan (.txt)" }),
  );
  const text = await exported!.text();
  assert.ok(text.includes(formIssue.title));
  assert.ok(text.includes(source.pageUrl));
  assert.ok(text.includes("not measure the complete user experience"));
});

test("plain-language observations preserve name and destination limits without claiming live failures", () => {
  const rows = describeUXSource(navigationSource);
  assert.deepEqual(
    rows.find((row) => row.label === "Label"),
    { label: "Label", value: "Click here" },
  );
  assert.deepEqual(
    rows.find((row) => row.label === "Live destination"),
    { label: "Live destination", value: "Not opened or tested" },
  );
  assert.equal(uxIssueArea({ ...formIssue, uxCriterion: undefined }), "forms");
  assert.ok(
    uxActionPlan(undefined, [], "https://portfolio.example").includes(
      "No supported usability improvements",
    ),
  );
});
test("UX review shows evidence, unassessed criteria and real browser-testing limits", () => {
  const view = render(
    createElement(Section, {
      analysis,
      issues: [],
      url: "https://portfolio.example",
      generatedFixSteps: {},
      onFixStepsLoaded: () => {},
    }),
  );
  fireEvent.click(view.getByText("Category assessments and strengths"));
  assert.ok(view.getByText(analysis.summary));
  fireEvent.click(view.getByText("How the UX score was assessed"));
  assert.ok(view.getByText("Not assessed"));
  fireEvent.click(view.getByText("Form clarity", { selector: "strong" }));
  assert.ok(view.getByText(/Excluded from the score/));
  fireEvent.click(view.getByText("Coverage and remaining checks"));
  assert.ok(view.getByText("What still needs browser testing"));
  assert.ok(view.getByText(analysis.unassessed[1]));
  assert.ok(
    view.getByText(/Unsupported or untestable draft advice was withheld/),
  );
  assert.ok(
    view
      .getAllByRole("link", { hidden: true })
      .some((link) => link.getAttribute("href") === source.pageUrl),
  );
});
test("UX evidence is labeled as an HTML observation rather than a quote of website copy", () => {
  const issue = {
    priority: "Medium" as const,
    title: "Email field has no detectable HTML label",
    detail:
      "The collected HTML contains an email input with no label association.",
    evidenceType: "html-observation" as const,
    uxEvidence: [source],
    evidence: source.observation,
    pageUrl: source.pageUrl,
    fixSteps: [
      {
        title: "Add a field label",
        description: "Associate the label with the email input ID.",
      },
    ],
  };
  const view = render(
    createElement(IssueCard, {
      issue,
      url: "https://portfolio.example",
      index: 0,
    }),
  );
  fireEvent.click(view.getByText("View HTML evidence"));
  assert.equal(view.container.querySelector("blockquote"), null);
  assert.ok(view.getByText(source.location));
  assert.ok(
    view.container.querySelector("pre")!.textContent!.includes('"id": "email"'),
  );
});
test("a missing UX score displays Not assessed and does not create a zero-value meter", () => {
  const view = render(
    createElement(ScoreBars, {
      scores: { Messaging: 80, UX: null, SEO: 70, Conversion: 60 },
    }),
  );
  assert.ok(view.getByText("Not assessed"));
  assert.equal(view.queryByRole("meter", { name: "User experience" }), null);
});
