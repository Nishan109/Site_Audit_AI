import Icon from "./Icon";
export default function VerdictCard({
  summary,
  overview,
}: {
  summary: string;
  overview: string;
  url: string;
  analyzedAt: string;
}) {
  return (
    <section className="verdict-card" id="verdict-card">
      <span className="verdict-icon">
        <Icon name="sparkle" width="20" height="20" />
      </span>
      <div>
        <span className="section-kicker">The executive take</span>
        <p className="verdict-summary">{summary}</p>
        <details className="verdict-detail">
          <summary>
            Read the full assessment
            <Icon name="down" width="14" height="14" />
          </summary>
          <p>{overview}</p>
        </details>
      </div>
    </section>
  );
}
