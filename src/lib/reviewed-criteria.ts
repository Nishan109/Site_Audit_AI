export interface ReviewCriterion {
  key: string;
  score: number | null;
  reason: string;
  sources: { pageUrl: string }[];
}

/** Same eligibility as the dashboard, with optional recorded-page validation in live reports. */
export function reviewedCriteria<T extends ReviewCriterion>(
  criteria: T[],
  pages?: string[],
  calculate?: (criteria: T[]) => number | null,
) {
  const known = pages
    ? new Set(
        pages.flatMap((value) => {
          try {
            const url = new URL(value);
            url.hash = "";
            return [url.href];
          } catch {
            return [];
          }
        }),
      )
    : undefined;
  const seen = new Set<string>();
  return criteria.filter((item) => {
    const isolated = calculate?.([item]);
    if (
      calculate &&
      (isolated == null ||
        !Number.isFinite(isolated) ||
        isolated < 0 ||
        isolated > 100)
    )
      return false;
    if (
      seen.has(item.key) ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 100 ||
      !item.reason.trim() ||
      !item.sources.length
    )
      return false;
    if (
      !item.sources.every((source) => {
        try {
          const url = new URL(source.pageUrl);
          url.hash = "";
          return (
            /^https?:$/.test(url.protocol) &&
            !url.username &&
            !url.password &&
            (!known || known.has(url.href))
          );
        } catch {
          return false;
        }
      })
    )
      return false;
    seen.add(item.key);
    return true;
  });
}
