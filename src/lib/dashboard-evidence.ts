import type { Issue } from "./types";

/** Read existing source records without inventing a quotation or a new finding. */
export function dashboardEvidence(issue: Issue) {
  const entries = [
    ...(issue.messagingEvidence || []).map((source) => ({
      pageUrl: source.pageUrl,
      text: source.quote,
      label: "Collected copy",
    })),
    ...(issue.uxEvidence || []).map((source) => ({
      pageUrl: source.pageUrl,
      text: source.observation,
      label: "HTML observation",
    })),
    ...(issue.seoEvidence || []).map((source) => ({
      pageUrl: source.pageUrl,
      text: source.observation,
      label: "Search observation",
    })),
    ...(issue.conversionEvidence || []).map((source) => ({
      pageUrl: source.pageUrl,
      text: source.observation,
      label: "Conversion observation",
    })),
    ...(issue.aiEvidence || []).map((source) => ({
      pageUrl: source.pageUrl,
      text: source.text,
      label: "Content observation",
    })),
  ].filter((source) => source.text.trim());
  if (entries.length) return entries;
  return issue.evidence?.trim()
    ? [
        {
          pageUrl: issue.pageUrl,
          text: issue.evidence,
          label: "Collected evidence",
        },
      ]
    : [];
}

export function reportTime(value: string) {
  if (!Number.isFinite(Date.parse(value))) return "Timestamp unavailable";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function openReportCoverage() {
  const detail = document.getElementById(
    "report-evidence",
  ) as HTMLDetailsElement | null;
  if (!detail) return;
  detail.open = true;
  const summary = detail.querySelector("summary");
  summary?.focus({ preventScroll: true });
  detail.scrollIntoView({
    block: "start",
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
