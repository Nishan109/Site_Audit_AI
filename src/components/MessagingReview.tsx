import type { CopySuggestion, MessagingAnalysis } from "@/lib/messaging";
import { MESSAGING_CRITERIA, messagingScore } from "@/lib/messaging";
import Icon, { type IconName } from "./Icon";
import { CopySourceDetails } from "./MessagingEvidence";
import shared from "./UXReview.module.css";
import styles from "./MessagingWorkspace.module.css";

export const COPY_ICONS: Record<string, IconName> = {
  clarity: "message",
  audience: "users",
  specificity: "target",
  consistency: "layers",
};
export function SuggestedCopy({ suggestion }: { suggestion: CopySuggestion }) {
  return (
    <section className={styles.suggestedCopy} aria-label="Suggested wording">
      <h4>
        <Icon name="pen" width="15" height="15" />A wording option to consider
      </h4>
      <div className={styles.copyColumns}>
        <div>
          <span className={styles.copyLabel}>Current copy</span>
          <blockquote>{suggestion.original}</blockquote>
        </div>
        <div>
          <span className={styles.copyLabel}>Suggested copy</span>
          <blockquote>{suggestion.replacement}</blockquote>
        </div>
      </div>
      <CopySourceDetails
        sources={suggestion.sources}
        label="Facts used in this suggestion"
      />
      <p className={styles.smallNote}>
        Suggested wording based on collected copy. Review it in context before
        publishing.
      </p>
    </section>
  );
}

export default function MessagingReview({
  analysis,
  issueCount = 0,
  rewriteCount = 0,
}: {
  analysis: MessagingAnalysis;
  issueCount?: number;
  rewriteCount?: number;
}) {
  const score = messagingScore(analysis.criteria);
  return (
    <>
      <section
        className={`${shared.overview} ${styles.overview}`}
        aria-labelledby="messaging-review-heading"
      >
        <div className={shared.overviewCopy}>
          <span className={shared.eyebrow}>
            <Icon name="message" width="13" height="13" />
            MESSAGING & COPY REVIEW
          </span>
          <h3 id="messaging-review-heading">
            A clearer message.
            <br />A stronger first impression.
          </h3>
          <p className={shared.summary}>{analysis.summary}</p>
          <div className={shared.trustLine}>
            <span>
              <i />
              Live page copy
            </span>
            <span>AI assessment · independently checked</span>
          </div>
          <CopySourceDetails
            sources={analysis.summarySources}
            label="Sources for this summary"
          />
        </div>
        <div className={shared.scorePanel}>
          <div
            className={shared.scoreRing}
            role={score === null ? undefined : "meter"}
            aria-label="Messaging and copy assessment"
            aria-valuenow={score ?? undefined}
            aria-valuemin={score === null ? undefined : 0}
            aria-valuemax={score === null ? undefined : 100}
            style={{
              background: `conic-gradient(#7860d8 ${(score || 0) * 3.6}deg, #eae6f4 0deg)`,
            }}
          >
            <div>
              {score === null ? (
                <strong className={shared.noScore}>Not assessed</strong>
              ) : (
                <>
                  <strong>{score}</strong>
                  <span>out of 100</span>
                </>
              )}
            </div>
          </div>
          <strong>Copy clarity score</strong>
          <p>{analysis.criteria.length} areas assessed</p>
          <span className={shared.scopeTag}>
            Qualitative · based on collected wording
          </span>
        </div>
        <div className={shared.stats}>
          <div>
            <Icon name="file" width="16" height="16" />
            <span>
              <strong>{analysis.scope.pages}</strong>
              {analysis.scope.pages === 1 ? "page reviewed" : "pages reviewed"}
            </span>
          </div>
          <div>
            <Icon name="layers" width="16" height="16" />
            <span>
              <strong>{analysis.scope.blocks}</strong>copy blocks reviewed
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
            <Icon name="pen" width="16" height="16" />
            <span>
              <strong>{rewriteCount}</strong>
              {rewriteCount === 1 ? "wording option" : "wording options"}
            </span>
          </div>
        </div>
      </section>
      <section
        className={shared.areaSection}
        aria-labelledby="messaging-areas-heading"
      >
        <div className={shared.sectionHeading}>
          <div>
            <span className={shared.eyebrow}>
              THE WORDS BEHIND THE IMPRESSION
            </span>
            <h3 id="messaging-areas-heading">How your message comes across</h3>
          </div>
          <span className={shared.subtle}>Source-backed assessments</span>
        </div>
        <div className={shared.areaGrid}>
          {MESSAGING_CRITERIA.map((rubric) => {
            const criterion = analysis.criteria.find(
              (item) => item.key === rubric.key,
            );
            return (
              <article className={shared.areaCard} key={rubric.key}>
                <div className={shared.areaTop}>
                  <span className={shared.areaIcon}>
                    <Icon
                      name={COPY_ICONS[rubric.key]}
                      width="18"
                      height="18"
                    />
                  </span>
                  {criterion ? (
                    <span className={shared.areaValue}>
                      {criterion.score}
                      <small>/100</small>
                    </span>
                  ) : (
                    <span className={shared.unassessed}>Not assessed</span>
                  )}
                </div>
                <h4>{rubric.label}</h4>
                {criterion && (
                  <div
                    className={shared.areaTrack}
                    role="meter"
                    aria-label={`${rubric.label} assessment`}
                    aria-valuenow={criterion.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${criterion.score}%` }} />
                  </div>
                )}
                <p>
                  {criterion?.reason ||
                    "No assessment was available in this report."}
                </p>
                <div className={shared.areaBottom}>
                  <span>{rubric.weight}% of the messaging score</span>
                  <CopySourceDetails
                    sources={criterion?.sources || []}
                    label="View source copy"
                  />
                </div>
              </article>
            );
          })}
        </div>
        <details className={shared.method}>
          <summary>
            How the messaging score was assessed
            <Icon name="down" width="13" height="13" />
          </summary>
          <p>
            The score combines purpose and message clarity (35%), audience and
            next-step clarity (25%), specific supportable language (25%), and
            consistency and readability (15%). Scores describe the collected
            wording. They do not measure visitor understanding, traffic, or
            conversion performance. Editing a wording draft does not recalculate
            the audit score.
          </p>
        </details>
      </section>
      {analysis.strengths.length > 0 && (
        <section
          className={shared.strengths}
          aria-labelledby="messaging-strengths-heading"
        >
          <div className={shared.strengthHeading}>
            <span>
              <Icon name="check" width="19" height="19" />
            </span>
            <div>
              <h3 id="messaging-strengths-heading">What’s already working</h3>
              <p>Keep these strengths as you refine your message.</p>
            </div>
          </div>
          <div className={shared.strengthGrid}>
            {analysis.strengths.map((item, index) => (
              <article key={index}>
                <span className={shared.strengthNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p>{item.text}</p>
                  <CopySourceDetails sources={[item.source]} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
