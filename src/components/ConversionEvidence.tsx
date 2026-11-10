import type { ConversionSource } from "@/lib/conversion";
import { conversionObservationRows } from "@/lib/conversion-presentation";
import Icon from "./Icon";
import styles from "./UXReview.module.css";

export function ConversionObservations({
  sources,
}: {
  sources: ConversionSource[];
}) {
  return (
    <div className={styles.observations}>
      {sources.map((source) => (
        <article key={source.id} className={styles.observation}>
          <div className={styles.observationHeading}>
            <span>{source.kind}</span>
            <strong>{source.location}</strong>
          </div>
          <dl>
            {conversionObservationRows(source).map((row, index) => (
              <div key={index}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <a href={source.pageUrl} target="_blank" rel="noopener noreferrer">
            Open source page
            <Icon name="external" width="12" height="12" />
          </a>
          <details className={styles.rawObservation}>
            <summary>Technical details</summary>
            <pre>
              {(() => {
                try {
                  return JSON.stringify(
                    JSON.parse(source.observation),
                    null,
                    2,
                  );
                } catch {
                  return source.observation;
                }
              })()}
            </pre>
          </details>
        </article>
      ))}
    </div>
  );
}
export function ConversionSources({
  sources,
  label = "View supporting evidence",
}: {
  sources: ConversionSource[];
  label?: string;
}) {
  if (!sources.length) return null;
  return (
    <details className={styles.sourceDetails}>
      <summary>
        <Icon name="link" width="13" height="13" />
        {label}
        <Icon name="down" width="12" height="12" />
      </summary>
      <ConversionObservations sources={sources} />
    </details>
  );
}
