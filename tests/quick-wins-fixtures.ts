import type { AuditResult, Issue, QuickWin } from "../src/lib/types";
import type { QuickWinsSelection } from "../src/lib/quick-wins";
import type { CopySource } from "../src/lib/messaging";
import type { UXSource } from "../src/lib/ux";

export const url = "https://acorn.example/";
export const copySource: CopySource = {
  id: "M1-E1",
  pageUrl: url,
  quote: "Bread for Saturday collection in Bath.",
  kind: "paragraph",
  region: "main",
};
export const controlSource: UXSource = {
  id: "U1-E2",
  pageUrl: url,
  kind: "field",
  location: "main · field 1",
  observation: JSON.stringify({
    name: "",
    nameFrom: "none detected in HTML",
    type: "email",
    id: "email",
    required: true,
    form: "form-1",
  }),
};
export const copyIssue: Issue = {
  title: "Clarify the bread collection message",
  detail:
    "The collected message could state the collection context more explicitly for visitors.",
  priority: "Low",
  pageUrl: url,
  evidence: copySource.quote,
  messagingCriterion: "clarity",
  messagingEvidence: [copySource],
  fixSteps: [
    {
      title: "Review the collected wording",
      description: "Keep the actual Saturday collection details accurate.",
    },
    {
      title: "Check the wording in context",
      description: "Ask an intended visitor what the collection message means.",
    },
  ],
};
export const controlIssue: Issue = {
  title: "Name the email question",
  detail:
    "No associated label was collected for this email field in the initial HTML.",
  priority: "High",
  pageUrl: url,
  evidence: `main · field 1: ${controlSource.observation}`,
  evidenceType: "html-observation",
  uxEvidence: [controlSource],
  uxCriterion: "forms",
  fixSteps: [
    {
      title: "Add an associated Email label",
      description:
        "Connect a label element to the existing email input identifier.",
    },
    {
      title: "Verify the field interaction",
      description: "Check the label and form behavior in the live browser.",
    },
  ],
};
export const copyWin: QuickWin = {
  id: "qw-copy-000000001",
  action: "Make Saturday collection explicit",
  impact:
    "May make the collection context easier to understand; validate with intended readers.",
  effort: "Low",
  pageUrl: url,
  evidence: copySource.quote,
  category: "messaging",
  relatedIssue: copyIssue,
  messagingEvidence: [copySource],
};
export const controlWin: QuickWin = {
  id: "qw-control-00001",
  action: "Add an associated email label",
  impact: "Could make the required email question easier to identify.",
  effort: "Medium",
  pageUrl: url,
  evidence: controlIssue.evidence,
  category: "ux",
  relatedIssue: controlIssue,
  evidenceType: "html-observation",
  uxEvidence: [controlSource],
};
export const selection: QuickWinsSelection = {
  method: "verified-shortlist-v1",
  reviewed: 3,
  retained: 2,
  highEffortExcluded: 1,
  unlinkedExcluded: 0,
  unsupportedExcluded: 0,
  duplicatesExcluded: 0,
  overflowExcluded: 0,
};
export function report(id = "audit-one"): AuditResult {
  return {
    analysisId: id,
    url,
    analyzedAt: "2026-11-07T12:00:00.000Z",
    summary: "A bakery collection website.",
    overview: "A bakery website with copy and form observations.",
    scores: { Messaging: 80, UX: 70, SEO: 80, Conversion: 80 },
    topIssues: [controlIssue],
    messaging: [copyIssue],
    ux: [controlIssue],
    seo: [],
    conversion: [],
    quickWins: [controlWin, copyWin],
    quickWinsSelection: selection,
    searchQueries: [],
    sources: [url],
    agentSteps: [],
  };
}
