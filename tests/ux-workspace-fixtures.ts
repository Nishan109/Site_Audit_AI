import { specialistFixture } from "./review-workspace-fixtures";
import { UX_CRITERIA, type UXSource } from "../src/lib/ux";
import type { Issue } from "../src/lib/types";

/** Isolated illustrative report. Never imported by application code or API routes. */
export function uxWorkspaceFixture() {
  const report = specialistFixture();
  const source = (
    id: string,
    kind: UXSource["kind"],
    location: string,
    data: object,
  ): UXSource => ({
    id,
    kind,
    location,
    pageUrl: report.url,
    observation: JSON.stringify(data),
  });
  const sources = [
    source("ux-link", "link", "Main content · collection link", {
      name: "Explore",
      nameFrom: "element content",
      href: "/collection",
      destination: `${report.url}collection`,
      targetInInitialHTML: false,
    }),
    source("ux-field", "field", "Collection enquiry · email field", {
      id: "email",
      type: "email",
      name: "",
      required: true,
      form: "collection-enquiry",
    }),
    source("ux-heading", "heading", "Main content · heading 2", {
      text: "More",
      level: 2,
    }),
    source("ux-nav", "navigation", "Header · secondary navigation", {
      name: "",
      linkCount: 3,
      labels: ["Bread", "Collection", "Contact"],
    }),
    source("ux-button", "button", "Collection enquiry · submit button", {
      name: "Go",
      type: "submit",
      nameFrom: "element content",
    }),
    source("ux-form", "form", "Collection enquiry", {
      name: "Collection enquiry",
      editableQuestions: 2,
      requiredQuestions: 1,
      fieldLabels: [{ name: "Email" }, { name: "Your question" }],
      action: "current page or script-controlled",
    }),
  ];
  const finding = (
    title: string,
    priority: Issue["priority"],
    uxCriterion: NonNullable<Issue["uxCriterion"]>,
    index: number,
    detail: string,
  ): Issue => ({
    title,
    priority,
    uxCriterion,
    detail,
    pageUrl: report.url,
    evidenceType: "html-observation",
    uxEvidence: [sources[index]],
    fixSteps: [
      {
        title: "Make a focused change",
        description:
          "Update the affected element using its recorded purpose and page context.",
      },
      {
        title: "Check the affected interaction",
        description:
          "Review the page in a browser with a keyboard and at a narrow viewport before closing this finding.",
      },
    ],
  });
  report.ux = [
    {
      ...finding(
        "Make the collection link easier to understand",
        "High",
        "controls",
        0,
        "The collected link is labeled Explore and declares a collection destination. A more specific label can describe that destination.",
      ),
      uxEvidence: [sources[0], sources[5]],
    },
    finding(
      "Give the email field a visible label",
      "High",
      "forms",
      1,
      "The email field has no detected name association in the collected HTML. Its rendered accessibility-tree name was not tested.",
    ),
    finding(
      "Describe the next section in its heading",
      "Medium",
      "structure",
      2,
      "The recorded heading More does not identify the subject of the next section.",
    ),
    finding(
      "Distinguish the secondary navigation group",
      "Medium",
      "navigation",
      3,
      "The secondary navigation has no explicit group name in the collected HTML.",
    ),
    finding(
      "Make the submit action more specific",
      "Low",
      "controls",
      4,
      "The collected submit button says Go. A label tied to the enquiry can describe its purpose.",
    ),
    finding(
      "Review the form in its page context",
      "Low",
      "forms",
      5,
      "The HTML records two editable questions and one required question. These counts alone do not establish friction or successful submission.",
    ),
  ];
  report.uxAnalysis = {
    method: "html-ux-review-v1",
    summary:
      "The collected page records navigation, collection links and an enquiry form. The retained findings focus on labels and structure; rendered layout and live interactions have not been tested.",
    summarySources: [sources[0], sources[5]],
    criteria: UX_CRITERIA.map(({ key }, index) => ({
      key,
      score: [72, 78, 65, 60][index],
      reason:
        "This qualitative assessment uses only the collected HTML observations, not measured user behavior.",
      sources: [sources[index]],
    })),
    strengths: [
      {
        text: "The collection link declares a relevant destination in the recorded HTML.",
        sources: [sources[0]],
      },
    ],
    scope: {
      pages: 1,
      sources: 6,
      navigation: 1,
      headings: 2,
      links: 4,
      buttons: 1,
      forms: 1,
      fields: 2,
      truncated: false,
    },
    verification: { checked: 7, retained: 6, withheld: 1 },
    unassessed: [
      "Rendered mobile layout and visual readability",
      "Keyboard focus and live navigation behavior",
      "Form validation, submission and success/error feedback",
    ],
  };
  return report;
}
