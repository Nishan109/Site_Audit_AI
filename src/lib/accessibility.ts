import type { FixStep } from "./types";
export const ACCESSIBILITY_KEYS = [
  "language",
  "title",
  "headings",
  "images",
  "fields",
  "controls",
  "links",
  "references",
  "regions",
] as const;
export const ACCESSIBILITY_STATUS = {
  observed: "Observed",
  review: "Review",
  "not-observed": "Not observed",
  "not-assessed": "Not assessed",
} as const;
export type AccessibilityArea =
  | "content"
  | "navigation"
  | "forms"
  | "semantics";
export interface AccessibilityCheck {
  id: string;
  key: (typeof ACCESSIBILITY_KEYS)[number];
  area: AccessibilityArea;
  pageUrl: string;
  title: string;
  status: keyof typeof ACCESSIBILITY_STATUS;
  detail: string;
  context: string;
  observations: { label: string; value: string }[];
  priority?: "High" | "Medium" | "Low";
  steps: FixStep[];
  reference: string;
}
export interface AccessibilitySnapshot {
  checks: Omit<AccessibilityCheck, "id" | "pageUrl">[];
  sampled: boolean;
  counts: {
    images: number;
    fields: number;
    controls: number;
    links: number;
    headings: number;
  };
}
export interface AccessibilityReview {
  method: "html-accessibility-signals-v1";
  summary: string;
  pages: {
    url: string;
    title: string;
    fetchedAt: string;
    sampled: boolean;
    collected: boolean;
    checks: AccessibilityCheck[];
  }[];
  scope: {
    pages: number;
    collected: number;
    checks: number;
    actions: number;
    sampled: boolean;
  };
  notTested: { title: string; instructions: string }[];
}
export const ACCESSIBILITY_GUIDANCE = {
  language: "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html",
  title: "https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html",
  headings: "https://www.w3.org/WAI/tutorials/page-structure/headings/",
  images: "https://www.w3.org/WAI/tutorials/images/decision-tree/",
  fields: "https://www.w3.org/WAI/tutorials/forms/labels/",
  controls: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  links:
    "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html",
  references:
    "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html",
  regions: "https://www.w3.org/WAI/tutorials/page-structure/regions/",
} as const;
export const ACCESSIBILITY_MANUAL_CHECKS = [
  {
    title: "Keyboard access & focus",
    instructions:
      "Use Tab, Shift+Tab, Enter, Space and Escape through real tasks. Check focus order, visible focus, traps, menus and dialogs.",
  },
  {
    title: "Screen-reader names & announcements",
    instructions:
      "Inspect the browser accessibility tree and test with a screen reader. Check names, roles, state changes, errors and live announcements.",
  },
  {
    title: "Contrast & visual states",
    instructions:
      "Measure rendered text, controls and focus indicators in each relevant state and theme. HTML alone cannot establish contrast ratios.",
  },
  {
    title: "Zoom, reflow & target size",
    instructions:
      "Test zoom, narrow layouts and touch targets with real content. Check clipping, reading order and content that appears on hover or focus.",
  },
  {
    title: "Meaning, alternatives & complete journeys",
    instructions:
      "Review the accuracy of image alternatives, captions, table relationships, form instructions and validation. Complete important tasks with assistive technology.",
  },
];
export function hasAccessibilityReviewSteps(check: AccessibilityCheck) {
  return !!check.priority && check.steps.length > 0;
}
export function accessibilityActions(review: AccessibilityReview) {
  const priority = { High: 0, Medium: 1, Low: 2 };
  return review.pages
    .flatMap((page) => page.checks)
    .filter(hasAccessibilityReviewSteps)
    .sort((a, b) => priority[a.priority!] - priority[b.priority!]);
}
