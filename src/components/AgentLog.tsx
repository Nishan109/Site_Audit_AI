import type { AgentStep } from "@/lib/types";
import { sourceURL } from "@/lib/dashboard";
import Icon from "./Icon";
import {
  REVIEW_STAGES,
  reviewDuration,
  type InitialReviewTiming,
} from "@/lib/review-progress";
export default function AgentLog({
  agentSteps,
  searchQueries,
  sources,
  initialReviewTiming,
}: {
  agentSteps: AgentStep[];
  searchQueries: string[];
  sources: string[];
  initialReviewTiming?: InitialReviewTiming;
}) {
  const completed = agentSteps.filter(
    (step) => step.status === "completed",
  ).length;
  const sourceCount = new Set(sources.map(sourceURL).filter(Boolean)).size;
  return (
    <details className="disclosure-card activity-card" id="agent-log">
      <summary>
        <span className="disclosure-icon">
          <Icon name="layers" />
        </span>
        <span className="disclosure-title">
          <strong>Behind the report</strong>
          <span>
            {agentSteps.length
              ? `${completed} of ${agentSteps.length} steps recorded as completed`
              : "No execution records available"}
          </span>
        </span>
        <Icon
          name="down"
          className="disclosure-chevron"
          width="16"
          height="16"
        />
      </summary>
      <div className="disclosure-body">
        {initialReviewTiming && (
          <details className="activity-queries">
            <summary>
              Initial review timing ·{" "}
              {reviewDuration(initialReviewTiming.durationMs)} server time
            </summary>
            <p>Some stages ran together.</p>
            <ul>
              {initialReviewTiming.stages.map((item) => (
                <li key={item.stage}>
                  {REVIEW_STAGES.find(([id]) => id === item.stage)?.[1] ||
                    item.stage}
                  {" · "}
                  {reviewDuration(item.durationMs)}
                  {item.status === "unavailable" && " · Unavailable"}
                </li>
              ))}
            </ul>
          </details>
        )}
        <ol className="activity-list">
          {agentSteps.map((step) => (
            <li key={step.name}>
              <span
                className={`activity-status ${step.status !== "completed" ? "is-unavailable" : ""}`}
              >
                <Icon
                  name={step.status === "completed" ? "check" : "info"}
                  width="13"
                  height="13"
                />
              </span>
              <div>
                <h4>
                  {step.name}
                  <span>
                    {step.status === "completed"
                      ? "Complete"
                      : step.status === "unavailable"
                        ? "Unavailable"
                        : "Status not recorded"}
                  </span>
                </h4>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        {searchQueries.length > 0 && (
          <div className="activity-queries">
            <h4>Search queries</h4>
            {searchQueries.map((query) => (
              <span key={query}>{query}</span>
            ))}
          </div>
        )}
        <p className="card-footnote">
          {sourceCount} unique source links recorded for this report.
        </p>
      </div>
    </details>
  );
}
