import type { IconName } from "./Icon";
export type ReportSection =
  | "overview"
  | "messaging"
  | "ux"
  | "seo"
  | "conversion"
  | "quickwins"
  | "aeo"
  | "security"
  | "accessibility"
  | "performance"
  | "adgenerator"
  | "battlecards"
  | "comparator";
export const REPORT_NAV: Array<{
  key: ReportSection;
  label: string;
  icon: IconName;
  group: string;
  description: string;
}> = [
  {
    key: "overview",
    label: "Overview",
    icon: "grid",
    group: "Your report",
    description: "The big picture, and the opportunities worth your attention.",
  },
  {
    key: "messaging",
    label: "Messaging & copy",
    icon: "message",
    group: "Your report",
    description: "Make your value clear, specific, and easy to understand.",
  },
  {
    key: "ux",
    label: "User experience",
    icon: "layers",
    group: "Your report",
    description: "Review your content structure, navigation, and user journey.",
  },
  {
    key: "seo",
    label: "Search optimization",
    icon: "search",
    group: "Your report",
    description: "Help search engines understand the content on your pages.",
  },
  {
    key: "conversion",
    label: "Conversion",
    icon: "target",
    group: "Your report",
    description: "Give visitors a clearer path from interest to action.",
  },
  {
    key: "quickwins",
    label: "Quick wins",
    icon: "bolt",
    group: "Your report",
    description:
      "Practical improvements you can prioritize and put into motion.",
  },
  {
    key: "aeo",
    label: "AI visibility",
    icon: "sparkle",
    group: "Deeper insights",
    description:
      "Review cited content, understand the gaps, and plan your next improvements.",
  },
  {
    key: "security",
    label: "Security checks",
    icon: "shield",
    group: "Deeper insights",
    description: "Inspect observed security signals, review the evidence, and plan your next steps.",
  },
  {
    key: "accessibility",
    label: "Accessibility checks",
    icon: "access",
    group: "Deeper insights",
    description: "Review the accessibility signals in collected page HTML and see what to verify in a browser.",
  },
  {
    key: "performance",
    label: "PageSpeed insights",
    icon: "chart",
    group: "Deeper insights",
    description: "Understand real-user metrics, inspect lab results, and prioritize performance improvements.",
  },
  {
    key: "adgenerator",
    label: "Ad creative studio",
    icon: "pen",
    group: "Growth tools",
    description:
      "Turn your website context into considered, editable ad drafts.",
  },
  {
    key: "battlecards",
    label: "Competitor research",
    icon: "users",
    group: "Growth tools",
    description:
      "Explore your positioning, alternatives, and strategic opportunities.",
  },
  {
    key: "comparator",
    label: "Creative comparison",
    icon: "compare",
    group: "Growth tools",
    description: "Compare two creative directions with a visual AI assessment.",
  },
];
