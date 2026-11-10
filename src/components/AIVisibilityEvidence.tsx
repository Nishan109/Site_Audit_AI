import type { AIVisibilitySource } from "@/lib/ai-visibility";
import {
  aiSourceKey,
  aiVisibilityRows,
  distinctAISources,
} from "@/lib/ai-visibility-presentation";
import { sourceURL } from "@/lib/dashboard";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import layout from "./UXSection.module.css";
import workbench from "./ConversionSection.module.css";
import styles from "./AIVisibilitySection.module.css";

export function AIVisibilityObservations({
  sources,
  showPage = true,
  onInspectPage,
  inspectablePages = [],
}: {
  sources: AIVisibilitySource[];
  showPage?: boolean;
  onInspectPage?: (page: string) => void;
  inspectablePages?: string[];
}) {
  return (
    <div className={layout.observations}>
      {distinctAISources(sources).map((source) => {
        const page = sourceURL(source.pageUrl);
        return (
          <article className={layout.observation} key={aiSourceKey(source)}>
            <div className={layout.observationHeading}>
              <span>
                {source.id}
                {source.truncated && " · Sampled excerpt"}
              </span>
              <strong>{source.label}</strong>
              {(source.heading || source.region) && (
                <p className={styles.note}>
                  {[source.heading, source.region].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {source.kind === "copy" ? (
              <>
                <blockquote className={styles.quotation}>
                  {source.text}
                </blockquote>
                <p className={styles.note}>
                  Collected website wording. Claims have not been independently
                  verified.
                </p>
              </>
            ) : (
              <dl className={styles.rows}>
                {aiVisibilityRows(source).map(({ label, value }, index) => (
                  <div key={`${label}-${index}`}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {showPage && (
              <div className={styles.evidenceActions}>
                {page ? (
                  <>
                    <p className={styles.note}>{page}</p>
                    <div className={workbench.sourceActions}>
                      <ReviewSourceLink url={page} label="Open audited page" />
                      {onInspectPage && inspectablePages.includes(page) && (
                        <button
                          type="button"
                          className={layout.button}
                          onClick={() => onInspectPage(page)}
                        >
                          Inspect source page
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className={styles.note}>Source page unavailable</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function AIVisibilitySources({
  sources,
  label = "View supporting evidence",
}: {
  sources?: AIVisibilitySource[];
  label?: string;
}) {
  const available = distinctAISources(sources);
  if (!available.length) return null;
  return (
    <details className={styles.sourceDisclosure}>
      <summary>
        <Icon name="link" width="14" height="14" /> {label}
      </summary>
      <AIVisibilityObservations sources={available} />
    </details>
  );
}
