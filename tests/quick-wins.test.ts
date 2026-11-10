import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleQuickWins,
  unsupportedQuickWinOutcome,
  usableQuickWinBenefit,
  unprovenFormAssociationClaim,
} from "../src/lib/server/quick-wins";
import { auditSchema } from "../src/lib/server/schemas";
import {
  orderedQuickWins,
  quickWinKey,
  quickWinsPlan,
} from "../src/lib/quick-wins-presentation";
import {
  copyIssue,
  copySource,
  copyWin,
  controlIssue,
  controlWin,
  url,
} from "./quick-wins-fixtures";
import type { QuickWinGroup } from "../src/lib/server/quick-wins";

const groups = (): QuickWinGroup[] => [
  { category: "ux", issues: [controlIssue], quickWins: [controlWin] },
  { category: "messaging", issues: [copyIssue], quickWins: [copyWin] },
];
test("the shortlist preserves the real parent, source type and stable server-generated task identity", () => {
  const result = assembleQuickWins(groups());
  assert.equal(result.quickWins[0].action, copyWin.action);
  assert.equal(result.quickWins[1].relatedIssue.title, controlIssue.title);
  assert.equal(
    result.quickWins[1].uxEvidence![0].observation,
    controlWin.uxEvidence![0].observation,
  );
  assert.equal(result.quickWins[1].evidenceType, "html-observation");
  assert.equal(
    result.quickWins[0].messagingEvidence![0].quote,
    copySource.quote,
  );
  assert.equal(
    result.quickWins[0].id,
    assembleQuickWins(groups()).quickWins[0].id,
  );
  assert.equal(result.selection.retained, 2);
  assert.deepEqual(
    auditSchema.shape.quickWins.parse(result.quickWins),
    result.quickWins,
  );
});
test("larger-effort work and orphaned suggestions stay out of the quick-win shortlist", () => {
  const result = assembleQuickWins([
    {
      category: "messaging",
      issues: [copyIssue],
      quickWins: [
        { ...copyWin, effort: "High" },
        { ...copyWin, relatedIssue: undefined },
        {
          ...copyWin,
          relatedIssue: { ...copyIssue, evidence: "another page quote" },
        },
      ],
    },
  ]);
  assert.equal(result.quickWins.length, 0);
  assert.equal(result.selection.highEffortExcluded, 1);
  assert.equal(result.selection.unlinkedExcluded, 2);
});
test("uncited tasks, unrelated source pages and promised performance lifts are excluded", () => {
  const result = assembleQuickWins([
    {
      category: "messaging",
      issues: [copyIssue],
      quickWins: [
        { ...copyWin, messagingEvidence: [] },
        {
          ...copyWin,
          messagingEvidence: [
            { ...copySource, pageUrl: "https://other.example/" },
          ],
        },
        { ...copyWin, impact: "This will increase conversions by 35%." },
      ],
    },
  ]);
  assert.equal(result.quickWins.length, 0);
  assert.equal(result.selection.unsupportedExcluded, 3);
  assert.equal(
    unsupportedQuickWinOutcome("Will improve search rankings for this website"),
    true,
  );
  assert.equal(
    unsupportedQuickWinOutcome(
      "May help visitors understand the next step; test in context.",
    ),
    false,
  );
});
test("duplicate tasks and multiple suggestions for one finding are consolidated without collapsing distinct findings", () => {
  const duplicate = {
    ...copyWin,
    action: "Make Saturday collection explicit!",
  };
  const another = { ...copyWin, action: "Simplify the collection wording" };
  const secondIssue = {
    ...copyIssue,
    title: "Clarify collection instructions",
  };
  const distinct = {
    ...copyWin,
    relatedIssue: secondIssue,
    action: "Explain where to collect the order",
  };
  const result = assembleQuickWins([
    {
      category: "messaging",
      issues: [copyIssue, secondIssue],
      quickWins: [copyWin, duplicate, another, distinct],
    },
  ]);
  assert.equal(result.quickWins.length, 2);
  assert.equal(result.selection.duplicatesExcluded, 2);
});
test("lower effort then finding priority determine the bounded shortlist", () => {
  const issues = Array.from({ length: 8 }, (_, index) => ({
    ...copyIssue,
    title: `Collection context improvement ${index}`,
    priority: index === 7 ? ("High" as const) : ("Low" as const),
  }));
  const quickWins = issues.map((issue, index) => ({
    ...copyWin,
    action: `Clarify collection context ${index}`,
    relatedIssue: issue,
    effort: index === 6 ? ("Medium" as const) : ("Low" as const),
  }));
  const result = assembleQuickWins([
    { category: "messaging", issues, quickWins },
  ]);
  assert.equal(result.quickWins.length, 6);
  assert.equal(result.selection.overflowExcluded, 2);
  assert.equal(result.quickWins[0].relatedIssue.priority, "High");
  assert.ok(result.quickWins.every((win) => win.effort === "Low"));
  assert.equal(
    result.selection.reviewed,
    result.selection.retained + result.selection.overflowExcluded,
  );
});
test("manual status follows task identity when sorting and exports preserve evidence and limitations", () => {
  const wins = assembleQuickWins(groups()).quickWins;
  const done = new Set([quickWinKey(wins[0])]);
  assert.equal(
    orderedQuickWins(wins, "priority")[0].win.action,
    controlWin.action,
  );
  const plan = quickWinsPlan(wins, url, done, "priority");
  for (const value of [
    controlWin.action,
    copyWin.action,
    controlIssue.title,
    "Label: No name detected",
    copySource.quote,
    "Marked done by you (not re-tested)",
    "not a measured duration",
    "not measured uplift",
    "Underlying finding",
  ])
    assert.ok(plan.includes(value), value);
  assert.equal(
    plan.indexOf(controlWin.action) < plan.indexOf(copyWin.action),
    true,
  );
});
test("no supported tasks yields an honest empty shortlist and still exports useful testing limits", () => {
  const result = assembleQuickWins([]);
  assert.equal(result.quickWins.length, 0);
  assert.equal(result.selection.reviewed, 0);
  const text = quickWinsPlan([], url);
  assert.ok(text.includes("No smaller-effort suggestions were supported"));
  assert.ok(text.includes("commercial/search performance were not verified"));
});
test("incomplete benefit ratings and unknown native form association do not become actionable quick wins", () => {
  assert.equal(usableQuickWinBenefit(""), false);
  assert.equal(usableQuickWinBenefit("Medium"), false);
  assert.equal(
    usableQuickWinBenefit(
      "May make the existing email question easier to identify.",
    ),
    true,
  );
  const source = {
    ...controlWin.uxEvidence![0],
    observation: JSON.stringify({
      type: "radio",
      name: "5",
      form: "no associated form in collected HTML",
    }),
  };
  assert.equal(
    unprovenFormAssociationClaim(
      "Radio controls lack an associated form in collected HTML.",
      [source],
    ),
    true,
  );
  assert.equal(
    unprovenFormAssociationClaim(
      "Wrap donation radio buttons in a proper form element.",
      [source],
    ),
    true,
  );
  assert.equal(
    unprovenFormAssociationClaim("The email field has no associated label.", [
      source,
    ]),
    false,
  );
  const parent = {
    ...controlIssue,
    title: "Unassociated donation radio controls",
    detail: "The inputs lack an associated form in collected HTML.",
    uxEvidence: [source],
  };
  const result = assembleQuickWins([
    {
      category: "ux",
      issues: [parent],
      quickWins: [
        {
          ...controlWin,
          action: "Wrap donation radio buttons in a proper form element.",
          relatedIssue: parent,
          uxEvidence: [source],
        },
      ],
    },
  ]);
  assert.equal(result.quickWins.length, 0);
  assert.equal(result.selection.unsupportedExcluded, 1);
});
