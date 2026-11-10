export const QUICK_WIN_AREAS = [
  { key: "messaging", label: "Messaging & copy", icon: "message" },
  { key: "ux", label: "User experience", icon: "layers" },
  { key: "seo", label: "Search optimization", icon: "search" },
  { key: "conversion", label: "Conversion", icon: "target" },
] as const;
export type QuickWinArea = (typeof QUICK_WIN_AREAS)[number]["key"];
export interface QuickWinsSelection {
  method: "verified-shortlist-v1";
  reviewed: number;
  retained: number;
  highEffortExcluded: number;
  unlinkedExcluded: number;
  unsupportedExcluded: number;
  duplicatesExcluded: number;
  overflowExcluded: number;
}
