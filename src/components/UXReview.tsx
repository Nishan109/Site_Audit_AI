import { UX_CRITERIA, uxScore, type UXAnalysis } from "@/lib/ux";
import Icon, { type IconName } from "./Icon";
import { UXSourceDetails } from "./UXEvidence";
import styles from "./UXReview.module.css";
export { HTMLObservations } from "./UXEvidence";

export const UX_ICONS: Record<string, IconName> = {
  navigation: "globe",
  structure: "layers",
  controls: "target",
  forms: "file",
};
export default function UXReview({
  analysis,
  issueCount = 0,
}: {
  analysis: UXAnalysis;
  issueCount?: number;
}) {
  const score = uxScore(analysis.criteria);
  const assessed = analysis.criteria.filter((item) => item.score !== null);
  const weight = UX_CRITERIA.reduce(
    (sum, rubric) =>
      sum +
      (assessed.some((item) => item.key === rubric.key) ? rubric.weight : 0),
    0,
  );
  return (
    <>
      <section className={styles.overview} aria-labelledby="ux-review-heading">
        <div className={styles.overviewCopy}>
          <span className={styles.eyebrow}>
            <Icon name="layers" width="13" height="13" />
            EXPERIENCE REVIEW
          </span>
          <h3 id="ux-review-heading">Make every next step feel clearer.</h3>
          <p className={styles.summary}>{analysis.summary}</p>
          <div className={styles.trustLine}>
            <span>
              <i />
              Live page evidence
            </span>
            <span>AI assessment · independently checked</span>
          </div>
          <UXSourceDetails
            sources={analysis.summarySources}
            label="See what informed this review"
          />
        </div>
        <div className={styles.scorePanel}>
          <div
            className={styles.scoreRing}
            role={score === null ? undefined : "meter"}
            aria-label="HTML-based user experience score"
            aria-valuenow={score ?? undefined}
            aria-valuemin={score === null ? undefined : 0}
            aria-valuemax={score === null ? undefined : 100}
            style={{
              background: `conic-gradient(#7860d8 ${(score || 0) * 3.6}deg, #eae6f4 0deg)`,
            }}
          >
            <div>
              {score === null ? (
                <strong className={styles.noScore}>Not assessed</strong>
              ) : (
                <>
                  <strong>{score}</strong>
                  <span>out of 100</span>
                </>
              )}
            </div>
          </div>
          <strong>HTML experience score</strong>
          <p>
            {assessed.length} of {UX_CRITERIA.length} areas assessed
          </p>
          <span className={styles.scopeTag}>
            Qualitative · limited to collected pages
          </span>
        </div>
        <div className={styles.stats}>
          <div>
            <Icon name="file" width="16" height="16" />
            <span>
              <strong>{analysis.scope.pages}</strong>
              {analysis.scope.pages === 1 ? "page reviewed" : "pages reviewed"}
            </span>
          </div>
          <div>
            <Icon name="link" width="16" height="16" />
            <span>
              <strong>{analysis.scope.links}</strong>links collected
            </span>
          </div>
          <div>
            <Icon name="target" width="16" height="16" />
            <span>
              <strong>{issueCount}</strong>
              {issueCount === 1
                ? "supported improvement"
                : "supported improvements"}
            </span>
          </div>
          <div>
            <Icon name="eye" width="16" height="16" />
            <span>
              Browser interactions
              <strong className={styles.statText}>Not tested</strong>
            </span>
          </div>
        </div>
      </section>
      <section
        className={styles.areaSection}
        aria-labelledby="ux-areas-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>THE EXPERIENCE AT A GLANCE</span>
            <h3 id="ux-areas-heading">Where your experience stands</h3>
          </div>
          <span className={styles.subtle}>Based on initial page HTML</span>
        </div>
        <div className={styles.areaGrid}>
          {UX_CRITERIA.map((rubric) => {
            const criterion = analysis.criteria.find(
              (item) => item.key === rubric.key,
            );
            const value = criterion?.score ?? null;
            return (
              <article
                className={`${styles.areaCard} ${value === null ? styles.areaUnassessed : ""}`}
                key={rubric.key}
              >
                <div className={styles.areaTop}>
                  <span className={styles.areaIcon}>
                    <Icon name={UX_ICONS[rubric.key]} width="18" height="18" />
                  </span>
                  {value === null ? (
                    <span className={styles.unassessed}>Not assessed</span>
                  ) : (
                    <span className={styles.areaValue}>
                      {value}
                      <small>/100</small>
                    </span>
                  )}
                </div>
                <h4>{rubric.label}</h4>
                {value !== null && (
                  <div
                    className={styles.areaTrack}
                    role="meter"
                    aria-label={`${rubric.label} assessment`}
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${value}%` }} />
                  </div>
                )}
                <p>
                  {criterion?.reason ||
                    "No assessment was available for this area in the collected evidence."}
                </p>
                <div className={styles.areaBottom}>
                  <span>
                    {value === null
                      ? "Excluded from the score"
                      : `${Math.round((rubric.weight / weight) * 100)}% of assessed score`}
                  </span>
                  <UXSourceDetails
                    sources={criterion?.sources || []}
                    label="View evidence"
                  />
                </div>
              </article>
            );
          })}
        </div>
        <details className={styles.method}>
          <summary>
            How the UX score was assessed
            <Icon name="down" width="13" height="13" />
          </summary>
          <p>
            The score combines navigation ({UX_CRITERIA[0].weight}%),
            information structure ({UX_CRITERIA[1].weight}%), controls (
            {UX_CRITERIA[2].weight}%) and form clarity ({UX_CRITERIA[3].weight}
            %). Unassessed areas are excluded and the remaining weights are
            adjusted. The score reflects AI judgments of the collected HTML;
            visitor outcomes and the complete user experience have not been
            measured.
          </p>
        </details>
      </section>
      {analysis.strengths.length > 0 && (
        <section
          className={styles.strengths}
          aria-labelledby="ux-strengths-heading"
        >
          <div className={styles.strengthHeading}>
            <span>
              <Icon name="check" width="19" height="19" />
            </span>
            <div>
              <h3 id="ux-strengths-heading">Keep what’s already working</h3>
              <p>Useful foundations to preserve as you improve the site.</p>
            </div>
          </div>
          <div className={styles.strengthGrid}>
            {analysis.strengths.map((item, index) => (
              <article key={index}>
                <span className={styles.strengthNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p>{item.text}</p>
                  <UXSourceDetails sources={item.sources} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
