import type { UXSource } from "@/lib/ux";
import { describeUXSource } from "@/lib/ux-presentation";
import Icon from "./Icon";
import styles from "./UXReview.module.css";

export function HTMLObservations({ sources }: { sources: UXSource[] }) {
  return (
    <div className={styles.observations}>
      {sources.map((source) => (
        <article key={source.id} className={styles.observation}>
          <div className={styles.observationHeading}>
            <span>{source.kind}</span>
            <strong>{source.location}</strong>
          </div>
          <dl>
            {describeUXSource(source).map((row, index) => (
              <div key={`${row.label}-${index}`}>
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
export function UXSourceDetails({
  sources,
  label = "View supporting evidence",
}: {
  sources: UXSource[];
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
      <HTMLObservations sources={sources} />
    </details>
  );
}
