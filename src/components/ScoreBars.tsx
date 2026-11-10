import type { AuditScores } from "@/lib/types";
const labels: Record<keyof AuditScores, string> = {
  Messaging: "Messaging",
  UX: "User experience",
  SEO: "Search optimization",
  Conversion: "Conversion",
  AEO: "AI content readiness",
  Security: "Security",
  Accessibility: "Accessibility",
};
export default function ScoreBars({ scores }: { scores: AuditScores }) {
  return (
    <div className="score-bars">
      {(Object.keys(labels) as Array<keyof AuditScores>).map((key) => {
        const score = scores[key];
        if (score === null)
          return (
            <div className="score-bar-row" key={key}>
              <div>
                <span>{labels[key]}</span>
                <strong>Not assessed</strong>
              </div>
            </div>
          );
        if (typeof score !== "number") return null;
        return (
          <div className="score-bar-row" key={key}>
            <div>
              <span>{labels[key]}</span>
              <strong>{score}</strong>
            </div>
            <div
              className="score-bar-track"
              role="meter"
              aria-label={labels[key]}
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${score}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
