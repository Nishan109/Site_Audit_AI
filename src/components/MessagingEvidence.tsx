import type { CopySource } from "@/lib/messaging";
import Icon from "./Icon";
import styles from "./MessagingWorkspace.module.css";

export function CopyEvidence({ sources }: { sources: CopySource[] }) {
  const unique = [
    ...new Map(
      sources.map((source) => [`${source.pageUrl}|${source.quote}`, source]),
    ).values(),
  ];
  return (
    <div className={styles.evidenceList}>
      {unique.map((source) => (
        <article key={`${source.pageUrl}|${source.id}`}>
          <div className={styles.sourceMeta}>
            <span>{source.kind}</span>
            <span>
              {source.region === "main"
                ? "Main content"
                : source.region === "navigation"
                  ? "Navigation"
                  : source.region === "footer"
                    ? "Footer"
                    : "Page content"}
            </span>
          </div>
          <blockquote>“{source.quote}”</blockquote>
          {source.destination && (
            <p>
              Observed destination: <span>{source.destination}</span>
            </p>
          )}
          {source.renderingNote && <p>{source.renderingNote}</p>}
          <a href={source.pageUrl} target="_blank" rel="noopener noreferrer">
            {new URL(source.pageUrl).hostname}
            {new URL(source.pageUrl).pathname}
            <Icon name="external" width="12" height="12" />
          </a>
        </article>
      ))}
    </div>
  );
}
export function CopySourceDetails({
  sources,
  label = "View supporting copy",
}: {
  sources: CopySource[];
  label?: string;
}) {
  if (!sources.length) return null;
  return (
    <details className={styles.sources}>
      <summary>
        <Icon name="link" width="13" height="13" />
        {label}
        <Icon name="down" width="12" height="12" />
      </summary>
      <CopyEvidence sources={sources} />
    </details>
  );
}
