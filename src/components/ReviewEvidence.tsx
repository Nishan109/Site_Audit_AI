import type { CopySource } from "@/lib/messaging";
import type { SEOSource } from "@/lib/seo";
import type { ConversionSource } from "@/lib/conversion";
import type { UXSource } from "@/lib/ux";
import { sourceURL } from "@/lib/dashboard";
import { seoObservationRows } from "@/lib/seo-presentation";
import { conversionObservationRows } from "@/lib/conversion-presentation";
import { describeUXSource } from "@/lib/ux-presentation";
import Icon from "./Icon";
import styles from "./ReviewWorkspace.module.css";

export interface ReviewEvidenceProps {
  copy?: CopySource[];
  seo?: SEOSource[];
  conversion?: ConversionSource[];
  ux?: UXSource[];
  plain?: string;
  pageUrl?: string;
  observation?: boolean;
  onInspectPage?: (pageUrl: string) => void;
  canInspectPage?: (pageUrl: string) => boolean;
}
export function ReviewSourceLink({
  url,
  label,
}: {
  url?: string;
  label?: string;
}) {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (
      !/^https?:$/.test(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      return null;
  } catch {
    return null;
  }
  return (
    <a
      className={styles.sourceLink}
      href={parsed.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon name="external" width="13" height="13" />
      <span>
        {label || `${parsed.hostname}${parsed.pathname}${parsed.search}`}
      </span>
    </a>
  );
}

export default function ReviewEvidence({
  copy = [],
  seo = [],
  conversion = [],
  ux = [],
  plain,
  pageUrl,
  observation,
  onInspectPage,
  canInspectPage,
}: ReviewEvidenceProps) {
  const structured = [
    ...seo.map((source) => ({
      source,
      label: source.label,
      rows: seoObservationRows(source),
    })),
    ...conversion.map((source) => ({
      source,
      label: source.location,
      rows: conversionObservationRows(source),
    })),
    ...ux.map((source) => ({
      source,
      label: source.location,
      rows: describeUXSource(source),
    })),
  ];
  const uniqueCopy = [
    ...new Map(
      copy.map((source) => [`${source.pageUrl}|${source.quote}`, source]),
    ).values(),
  ];
  const uniqueStructured = [
    ...new Map(
      structured.map((item) => [
        `${item.source.pageUrl}|${item.source.kind}|${item.source.id}`,
        item,
      ]),
    ).values(),
  ];
  return (
    <div className={styles.evidence}>
      {uniqueCopy.map((source) => (
        <article
          className={styles.evidenceItem}
          key={`${source.pageUrl}|${source.id}`}
        >
          <strong>
            {source.kind} ·{" "}
            {source.region === "main" ? "Main content" : source.region}
          </strong>
          <blockquote>“{source.quote}”</blockquote>
          {source.destination && (
            <p>Observed destination: {source.destination}</p>
          )}
          {source.renderingNote && <p>{source.renderingNote}</p>}
          <ReviewSourceLink url={source.pageUrl} />
        </article>
      ))}
      {uniqueStructured.map(({ source, label, rows }) => (
        <article
          className={styles.evidenceItem}
          key={`${source.pageUrl}|${source.kind}|${source.id}`}
        >
          <strong>{label}</strong>
          <dl>
            {rows.map((row, index) => (
              <div key={`${row.label}|${index}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {onInspectPage && sourceURL(source.pageUrl) && (
            <p>{source.pageUrl}</p>
          )}
          <div className={onInspectPage ? styles.evidenceActions : undefined}>
            <ReviewSourceLink
              url={source.pageUrl}
              label={onInspectPage ? "Open audited page" : undefined}
            />
            {!!conversion.length && !sourceURL(source.pageUrl) && (
              <p>Source page unavailable</p>
            )}
            {onInspectPage && canInspectPage?.(source.pageUrl) && (
              <button
                type="button"
                className={styles.button}
                onClick={() => onInspectPage(source.pageUrl)}
              >
                Inspect source page
              </button>
            )}
          </div>
          {!(
            conversion.length &&
            (source.kind === "form" || source.kind === "field")
          ) && (
            <details>
              <summary>Technical details</summary>
              <pre>{source.observation}</pre>
            </details>
          )}
        </article>
      ))}
      {!uniqueCopy.length && !uniqueStructured.length && plain && (
        <div className={styles.evidenceItem}>
          {observation || /^[\s]*[\[{]/.test(plain) ? (
            <>
              <strong>Saved observation</strong>
              <pre>{plain}</pre>
            </>
          ) : (
            <blockquote>“{plain}”</blockquote>
          )}
          <ReviewSourceLink url={pageUrl} />
        </div>
      )}
      {!uniqueCopy.length && !uniqueStructured.length && !plain && (
        <p>
          Source detail was not recorded in this saved report. A new review can
          collect current evidence.
        </p>
      )}
    </div>
  );
}
