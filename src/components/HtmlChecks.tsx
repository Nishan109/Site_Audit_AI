import { issueSteps, reviewIssueKey } from "@/lib/review-workspace";
import type { SecurityAudit, AccessibilityAudit, FixStep } from "@/lib/types";
import IssueCard from "./IssueCard";
import Icon from "./Icon";
interface Props {
  security?: SecurityAudit;
  accessibility?: AccessibilityAudit;
  url: string;
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (title: string, steps: FixStep[]) => void;
}
export default function HtmlChecks({
  security,
  accessibility,
  url,
  generatedFixSteps,
  onFixStepsLoaded,
}: Props) {
  const checks: Array<{
    label: string;
    value: boolean | null;
    yes: string;
    no: string;
  }> = security
    ? [
        {
          label: "HTTPS connection",
          value: security.httpsEnabled,
          yes: "Page fetched over HTTPS",
          no: "Page fetched over HTTP",
        },
        {
          label: "HTTP asset references",
          value: security.mixedContent === null ? null : !security.mixedContent,
          yes: "None found in the collected HTML",
          no: "HTTP references need a browser review",
        },
        {
          label: "Content Security Policy",
          value: security.cspHeaders,
          yes: "Present on the fetched response",
          no: "Not present on the fetched response",
        },
        {
          label: "Cookie consent behavior",
          value: security.cookieConsent,
          yes: "Detected",
          no: "Not detected",
        },
      ]
    : accessibility
      ? [
          {
            label: "Heading hierarchy",
            value: accessibility.headingHierarchy,
            yes: "No skipped levels in the initial HTML",
            no: "Skipped levels found in the initial HTML",
          },
          {
            label: "Image alt attributes",
            value: accessibility.altTextCoverage,
            yes: "Present; descriptive quality needs review",
            no: "Some image alt attributes are missing",
          },
          {
            label: "Detectable control labels",
            value: accessibility.ariaLabels,
            yes: "Names detected in the initial HTML",
            no: "Some controls need a label review",
          },
          { label: "Rendered color contrast", value: null, yes: "", no: "" },
        ]
      : [];
  const issues = security?.issues || accessibility?.issues || [];
  return (
    <section className="html-checks">
      <div className="info-note">
        <Icon name="info" />
        <p>
          These checks cover response headers and initial HTML. They do not
          establish overall security or WCAG compliance. Unmeasured items are
          clearly marked.
        </p>
      </div>
      <div className="checks-grid">
        {checks.map((check) => (
          <article className="check-card" key={check.label}>
            <span
              className={`check-icon ${check.value === null ? "is-neutral" : check.value ? "is-good" : "is-review"}`}
            >
              <Icon
                name={
                  check.value === null
                    ? "info"
                    : check.value
                      ? "check"
                      : "search"
                }
                width="18"
                height="18"
              />
            </span>
            <div>
              <h3>{check.label}</h3>
              <p>
                {check.value === null
                  ? "Not assessed"
                  : check.value
                    ? check.yes
                    : check.no}
              </p>
            </div>
            <span
              className={`check-label ${check.value === null ? "" : check.value ? "label-good" : "label-review"}`}
            >
              {check.value === null
                ? "Not measured"
                : check.value
                  ? "Checked"
                  : "Review"}
            </span>
          </article>
        ))}
      </div>
      {issues.map((issue, index) => (
        <IssueCard
          key={issue.title}
          issue={issue}
          url={url}
          index={index}
          fixSteps={issueSteps(issue, generatedFixSteps)}
          onFixStepsLoaded={(steps) => onFixStepsLoaded(reviewIssueKey(issue), steps)}
        />
      ))}
      {!issues.length && checks.length > 0 && (
        <div className="checks-clear">
          <Icon name="check" width="17" height="17" />
          No issues detected by these limited HTML checks.
        </div>
      )}
    </section>
  );
}
