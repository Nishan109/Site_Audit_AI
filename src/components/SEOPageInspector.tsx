import { sourceURL } from "@/lib/dashboard";
import {
  SEO_CRITERIA,
  type SEOCheck,
  type SEOPage,
  type SEOSource,
} from "@/lib/seo";
import { seoPageSignals } from "@/lib/seo-presentation";
import ReviewEvidence, { ReviewSourceLink } from "./ReviewEvidence";
import Icon from "./Icon";
import layout from "./UXSection.module.css";
import styles from "./SEOSection.module.css";

const labels: Record<SEOCheck["status"], string> = {
  observed: "Observed",
  review: "Review",
  "not-observed": "Not observed",
  "not-assessed": "Not assessed",
};

export default function SEOPageInspector({
  page,
  pageKey,
  pages,
  checks,
  evidence,
  findingCount,
  onPageChange,
  onViewFindings,
}: {
  page: SEOPage;
  pageKey: string;
  pages: [string, SEOPage][];
  checks: SEOCheck[];
  evidence: SEOSource[];
  findingCount: number;
  onPageChange: (key: string) => void;
  onViewFindings: () => void;
}) {
  const title = page.titles?.find(
    (value) => typeof value === "string" && value.trim(),
  );
  const description = page.descriptions?.find(
    (value) => typeof value === "string" && value.trim(),
  );
  const pageChecks = checks.filter(
    (check) => sourceURL(check.pageUrl) === pageKey,
  );
  const sources = evidence.filter(
    (source) => sourceURL(source.pageUrl) === pageKey,
  );
  const groups = seoPageSignals(page);
  const headerState =
    page.headersChecked == null
      ? "Header coverage not recorded"
      : page.headersChecked
        ? "Response headers collected"
        : "Response headers unavailable";

  return (
    <>
      <div className={styles.pageBar}>
        <div className={styles.pageIdentity}>
          <div className={styles.pageIcon}>
            <Icon name="globe" width="20" height="20" />
          </div>
          <div>
            <strong>Collected page</strong>
            <p>{page.url}</p>
            <span>
              {headerState}
              {page.truncated ? " · Sampled observations" : ""}
            </span>
          </div>
        </div>
        {pages.length > 1 && (
          <label className={styles.filterLabel}>
            Choose collected page
            <select
              aria-label="SEO page to inspect"
              value={pageKey}
              onChange={(event) => onPageChange(event.target.value)}
            >
              {pages.map(([key, item]) => (
                <option value={key} key={key}>
                  {item.url}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={styles.pageActions}>
        <p role="status">
          {findingCount} retained {findingCount === 1 ? "finding" : "findings"}{" "}
          for this page ·{" "}
          {pageChecks.filter((check) => check.status === "review").length}{" "}
          recorded signals marked Review
        </p>
        <div className={styles.inlineActions}>
          <ReviewSourceLink url={page.url} label="Open audited page" />
          <button
            type="button"
            className={layout.button}
            onClick={onViewFindings}
          >
            View findings for this page{" "}
            <Icon name="arrow" width="14" height="14" />
          </button>
        </div>
      </div>

      <div className={styles.pageGrid}>
        <section
          className={styles.previewPanel}
          aria-label="Illustrative search preview"
        >
          <div className={styles.previewLabel}>
            <Icon name="search" width="17" height="17" />
            <h4>Illustrative search listing</h4>
            <span>Preview only</span>
          </div>
          <div className={styles.searchPreview}>
            <div className={styles.previewSite}>
              <Icon name="globe" width="20" height="20" />
              <div>
                <strong>{new URL(pageKey).hostname}</strong>
                <p>{page.url}</p>
              </div>
            </div>
            {title ? (
              <h5>{title}</h5>
            ) : (
              <p className={styles.missingMetadata}>
                {page.titles
                  ? "No title was collected for the preview."
                  : "Title values were not recorded."}
              </p>
            )}
            <p>
              {description ||
                (page.descriptions
                  ? "No meta description was collected for the preview."
                  : "Description values were not recorded.")}
            </p>
          </div>
          <p className={styles.previewNote}>
            Built from the first non-empty collected title and description.
            Google may choose different wording. All saved values are available
            in Titles & descriptions.
          </p>
          <dl className={styles.counts}>
            <div>
              <dt>Title characters</dt>
              <dd>{title?.length ?? (page.titles ? 0 : "Not recorded")}</dd>
            </div>
            <div>
              <dt>Description characters</dt>
              <dd>
                {description?.length ??
                  (page.descriptions ? 0 : "Not recorded")}
              </dd>
            </div>
          </dl>
          <p className={styles.previewNote}>
            Counts are informational. Search appearance depends on the result
            and available space.
          </p>
        </section>

        <section
          className={styles.signals}
          aria-label="Observed page signals"
          key={pageKey}
        >
          <div className={styles.signalIntro}>
            <h4>Observed page signals</h4>
            <p>
              Check labels describe collected evidence and availability.
              Indexing, rankings and rich-result eligibility remain outside this
              review.
            </p>
          </div>
          {SEO_CRITERIA.map(({ key, label }) => {
            const related = pageChecks.filter((check) => check.key === key);
            return (
              <details
                className={styles.signalGroup}
                key={key}
                open={key === "metadata"}
              >
                <summary>
                  <strong>
                    {key === "discovery" ? "Canonical & directives" : label}
                  </strong>
                  <span>
                    {related.length
                      ? `${related.length} ${related.length === 1 ? "check" : "checks"}`
                      : "Recorded fields"}{" "}
                    <Icon name="down" width="14" height="14" />
                  </span>
                </summary>
                <div className={styles.signalBody}>
                  <dl className={styles.declarations}>
                    {groups[key].map(({ label, value }) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {key === "content" && (
                    <p className={styles.previewNote}>
                      Link destinations are declared in the collected HTML.
                      Opening or testing their behavior is outside this review.
                    </p>
                  )}
                  {key === "structured" && (
                    <p className={styles.previewNote}>
                      JSON parsing checks syntax. Vocabulary validity and
                      rich-result eligibility require separate review.
                    </p>
                  )}
                  {related.map((check) => {
                    const supporting = sources.filter((source) =>
                      check.sourceIds?.includes(source.id),
                    );
                    return (
                      <div className={styles.check} key={check.id}>
                        <div>
                          <strong>{check.label}</strong>
                          <span data-status={check.status}>
                            {labels[check.status] || "Not assessed"}
                          </span>
                        </div>
                        <p>{check.detail}</p>
                        {!!supporting.length && (
                          <details>
                            <summary>Supporting observations</summary>
                            <ReviewEvidence seo={supporting} />
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
          {!pageChecks.length && (
            <p className={styles.previewNote}>
              Individual check results were not recorded for this page.
            </p>
          )}
          <details className={styles.checkLegend}>
            <summary>How to read check labels</summary>
            <p>
              Observed records a signal from the sample. Review highlights a
              signal to examine in context. Not observed records an absence in
              the available sample. Not assessed marks an unavailable
              assessment.
            </p>
          </details>
        </section>
      </div>
    </>
  );
}
