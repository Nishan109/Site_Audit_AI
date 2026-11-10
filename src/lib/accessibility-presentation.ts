import type { AccessibilityAudit } from "./types";
import {
  ACCESSIBILITY_MANUAL_CHECKS,
  ACCESSIBILITY_STATUS,
  accessibilityActions,
  type AccessibilityCheck,
} from "./accessibility";
import { validatedAccessibilityAudit } from "./accessibility-refresh";
import { sourceURL } from "./source-url";

export function accessibilityCheckIdentity(check: AccessibilityCheck) {
  return JSON.stringify([sourceURL(check.pageUrl), check.key]);
}

export function accessibilityPlan(
  audit: AccessibilityAudit | undefined,
  url: string,
) {
  const validated = validatedAccessibilityAudit(audit, url);
  const review = validated?.review;
  return [
    "ACCESSIBILITY CHECKS · EVIDENCE AND REVIEW PLAN",
    `Website: ${url}`,
    ...(validated?.checkedAt
      ? [`Accessibility checks refreshed: ${validated.checkedAt}`]
      : []),
    "Collected HTML signals only. No WCAG conformance grade or complete accessibility verdict is assigned.",
    ...(!review
      ? ["Fresh accessibility evidence is not available yet."]
      : [
          review.summary,
          "",
          "COLLECTION SCOPE",
          `${review.scope.collected} of ${review.scope.pages} page(s) with HTML evidence. ${review.scope.checks} scoped check records.`,
          ...review.pages.map(
            (page) =>
              `${page.url} · ${page.fetchedAt} · ${page.collected ? "HTML evidence collected" : "Not collected"}${page.sampled ? " · Evidence sampled" : ""}`,
          ),
          "",
          "PRIORITIZED REVIEW TASKS",
          ...accessibilityActions(review).flatMap((check, index) => [
            `${index + 1}. ${check.title} · ${check.priority} priority`,
            check.detail,
            `Page: ${check.pageUrl}`,
            check.context,
            ...check.steps.map(
              (step, index) =>
                `${index + 1}) ${step.title}: ${step.description}`,
            ),
            `Guidance: ${check.reference}`,
            "",
          ]),
          ...(!accessibilityActions(review).length
            ? [
                "No review tasks were identified by these limited HTML checks. Manual testing is still required.",
              ]
            : []),
          "",
          "OBSERVATIONS AND SOURCE EVIDENCE",
          ...review.pages.flatMap((page) => [
            page.url,
            ...page.checks.flatMap((check) => [
              `${check.title} · ${ACCESSIBILITY_STATUS[check.status]}`,
              check.detail,
              check.context,
              ...check.observations.map((row) => `${row.label}: ${row.value}`),
              `Guidance: ${check.reference}`,
              "",
            ]),
          ]),
        ]),
    "BROWSER AND ASSISTIVE-TECHNOLOGY CHECKLIST · NOT TESTED",
    ...(review?.notTested.length
      ? review.notTested
      : ACCESSIBILITY_MANUAL_CHECKS
    ).flatMap((check) => [check.title, check.instructions, ""]),
    "HTML name candidates are not a complete Accessible Name computation. Empty alt may be intentional. Heading counts and unreferenced duplicate IDs alone do not establish WCAG failures. Entered form-field values are not collected.",
  ].join("\n");
}
