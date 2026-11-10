import {
  ACCESSIBILITY_KEYS,
  ACCESSIBILITY_GUIDANCE,
  ACCESSIBILITY_MANUAL_CHECKS,
  accessibilityActions,
  type AccessibilityReview,
} from "../accessibility";
import type { AccessibilityAudit } from "../types";
import type { PageEvidence } from "./evidence";
export function buildAccessibilityAudit(
  pages: PageEvidence[],
): AccessibilityAudit {
  const entries: AccessibilityReview["pages"] = pages.map((page, index) => ({
    url: page.url,
    title: page.title,
    fetchedAt: page.fetchedAt,
    collected: !!page.accessibilitySnapshot,
    sampled: !!page.accessibilitySnapshot?.sampled,
    checks:
      page.accessibilitySnapshot?.checks.map((check) => ({
        ...check,
        id: `accessibility-${index + 1}-${check.key}`,
        pageUrl: page.url,
      })) ||
      ACCESSIBILITY_KEYS.map((key) => ({
        id: `accessibility-${index + 1}-${key}`,
        key,
        pageUrl: page.url,
        area: "semantics",
        title: `Accessibility ${key} observations`,
        status: "not-assessed",
        detail: "Detailed HTML evidence was not collected for this check.",
        context:
          "Refresh accessibility checks to collect page-specific evidence. Missing evidence does not establish a missing accessibility feature.",
        observations: [{ label: "Collection scope", value: "Not collected" }],
        steps: [],
        reference: ACCESSIBILITY_GUIDANCE[key],
      })),
  }));
  const review: AccessibilityReview = {
    method: "html-accessibility-signals-v1",
    summary:
      "A page-specific review of accessibility signals in the collected HTML, with source evidence and practical review steps. Browser and assistive-technology testing are needed to complete the assessment.",
    pages: entries,
    scope: {
      pages: entries.length,
      collected: entries.filter((page) => page.collected).length,
      checks: entries.reduce((total, page) => total + page.checks.length, 0),
      actions: 0,
      sampled: entries.some((page) => page.sampled),
    },
    notTested: [...ACCESSIBILITY_MANUAL_CHECKS],
  };
  const actions = accessibilityActions(review);
  review.scope.actions = actions.length;
  const root = entries[0];
  const naming =
    root?.checks.filter((item) =>
      ["fields", "controls", "links"].includes(item.key),
    ) || [];
  const flag = (key: string) => {
    const check = root?.checks.find((item) => item.key === key);
    return check?.status === "observed"
      ? true
      : check?.status === "review"
        ? false
        : null;
  };
  return {
    overallScore: null,
    headingHierarchy: flag("headings"),
    altTextCoverage: flag("images"),
    ariaLabels: !root?.collected
      ? null
      : naming.some((item) => item.status === "review")
        ? false
        : naming.some((item) => item.status === "observed")
          ? true
          : null,
    contrastIssues: null,
    review,
    issues: actions.map((check) => ({
      priority: check.priority!,
      title: check.title,
      detail: check.detail,
      pageUrl: check.pageUrl,
      evidence: check.observations
        .map((row) => `${row.label}: ${row.value}`)
        .join("\n"),
      fixSteps: check.steps,
    })),
  };
}
