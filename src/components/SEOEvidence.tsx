import type { SEOSource } from "@/lib/seo";
import { seoObservationRows } from "@/lib/seo-presentation";
import Icon from "./Icon";
import shared from "./UXReview.module.css";
export function SEOObservations({ sources }: { sources: SEOSource[] }) {
  return (
    <div className={shared.observations}>
      {sources.map((source) => (
        <article className={shared.observation} key={source.id}>
          <div className={shared.observationHeading}>
            <span>{source.kind}</span>
            <strong>{source.label}</strong>
          </div>
          <dl>
            {seoObservationRows(source).map((row, index) => (
              <div key={index}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <a href={source.pageUrl} target="_blank" rel="noopener noreferrer">
            {new URL(source.pageUrl).hostname}
            {new URL(source.pageUrl).pathname}
            <Icon name="external" width="12" height="12" />
          </a>
          <details className={shared.rawObservation}>
            <summary>Technical details</summary>
            <pre>{source.observation}</pre>
          </details>
        </article>
      ))}
    </div>
  );
}
export function SEOSources({
  sources,
  label = "View source evidence",
}: {
  sources: SEOSource[];
  label?: string;
}) {
  if (!sources.length) return null;
  return (
    <details className={shared.sourceDetails}>
      <summary>
        <Icon name="link" width="13" height="13" />
        {label}
        <Icon name="down" width="12" height="12" />
      </summary>
      <SEOObservations sources={sources} />
    </details>
  );
}
