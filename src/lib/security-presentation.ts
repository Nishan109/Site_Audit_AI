import type { FixStep, SecurityAudit } from "./types";
import {
  SECURITY_GUIDANCE,
  SECURITY_NOT_TESTED,
  SECURITY_STATUS,
  securityActions,
  type SecurityArea,
  type SecurityCheck,
} from "./security";
import { validatedSecurityAudit } from "./security-refresh";
import { sourceURL } from "./source-url";

export const SECURITY_AREAS: Record<SecurityArea, string> = {
  transport: "Connections and destinations",
  headers: "Response policies",
  cookies: "Cookie attributes",
};

export function securityCheckIdentity(check: SecurityCheck) {
  return JSON.stringify([sourceURL(check.pageUrl), check.key]);
}

export function securityStepKey(check: SecurityCheck) {
  return JSON.stringify([
    "security",
    securityCheckIdentity(check),
    check.status,
    check.observations,
  ]);
}

export function securitySteps(
  check: SecurityCheck,
  generated: Record<string, FixStep[]> = {},
) {
  const saved = generated[securityStepKey(check)];
  return saved?.length ? saved : check.steps;
}

export const SECURITY_VERIFICATION: Record<SecurityCheck["key"], string> = {
  transport:
    "In staging, confirm the page and its required resources load over HTTPS. Check the intended redirect separately.",
  assets:
    "Verify the intended HTTPS destination, then inspect the actual browser requests in staging.",
  forms:
    "Verify the declared destination and test the intended submission flow in staging with dummy data.",
  csp: "Check the final response policy in staging and exercise key journeys before enforcing a change.",
  hsts: "Check the header on the intended HTTPS host. Verify affected subdomains before expanding the policy.",
  framing:
    "Test the page in intended and unintended embedding contexts in staging.",
  mime: "Check the actual script and stylesheet response types and exercise the affected page in staging.",
  referrer:
    "Inspect the referrer information sent by the affected browser requests in staging.",
  cookies:
    "Test the intended session or cross-site flow in staging. Record attribute behavior without copying cookie values.",
};

export function securityPlan(
  audit: SecurityAudit | undefined,
  url: string,
  generatedSteps: Record<string, FixStep[]> = {},
) {
  const snapshot = validatedSecurityAudit(audit, url);
  const review = snapshot?.review;
  const actions = review ? securityActions(review) : [];
  return [
    "SECURITY CHECKS · OBSERVATIONS AND REVIEW PLAN",
    `Website: ${url}`,
    ...(snapshot?.checkedAt
      ? [`Security checks refreshed: ${snapshot.checkedAt}`]
      : []),
    "This is a limited header and HTML review. No overall security score, vulnerability verdict or compliance certification is assigned.",
    ...(!review
      ? [
          "Collection scope only. Open Security checks to collect page-specific evidence.",
        ]
      : [
          review.summary,
          "",
          "COLLECTION SCOPE",
          `${review.scope.pages} page(s); ${review.scope.headersCollected} response(s) with security headers collected; ${review.scope.checks} scoped checks.`,
          `Configuration reviews: ${actions.length}.`,
          ...(snapshot?.requestedUrl &&
          snapshot.requestedUrl !== review.pages[0].url
            ? [
                `Requested page: ${snapshot.requestedUrl}`,
                `Final fetched page: ${review.pages[0].url}`,
              ]
            : []),
          ...review.pages.map(
            (page) =>
              `${page.url} · Collected ${page.fetchedAt} · ${page.headersCollected ? "Final-response headers collected" : "Response headers not collected"}${page.sampled ? " · Reference evidence sampled" : ""}`,
          ),
          "",
          "PRIORITIZED CONFIGURATION REVIEWS",
          ...actions.flatMap((check, index) => [
            `${index + 1}. ${check.title} · ${check.priority} priority`,
            check.detail,
            `Page: ${check.pageUrl}`,
            `Recorded status: ${SECURITY_STATUS[check.status]}`,
            check.context,
            ...securitySteps(check, generatedSteps).map(
              (step, index) =>
                `${index + 1}) ${step.title}: ${step.description}`,
            ),
            `Manual verification: ${SECURITY_VERIFICATION[check.key]}`,
            `Guidance: ${SECURITY_GUIDANCE[check.key]}`,
            "",
          ]),
          ...(!actions.length
            ? [
                "No additional configuration review actions were identified by these limited checks. This is not a security clearance.",
              ]
            : []),
          "",
          "OBSERVED SIGNALS AND EVIDENCE",
          ...review.pages.flatMap((page) => [
            `PAGE: ${page.url}`,
            ...page.checks.flatMap((check) => [
              `${check.title} · ${SECURITY_STATUS[check.status]}`,
              check.detail,
              check.context,
              ...check.observations.map((row) => `${row.label}: ${row.value}`),
              "",
            ]),
          ]),
        ]),
    "NOT TESTED",
    ...(review?.notTested || SECURITY_NOT_TESTED).map((item) => `- ${item}`),
    "Cookie names and values are not retained. Resource query strings, credentials and fragments are omitted.",
    "Observed does not mean secure. Missing headers can be intentional, and uncollected evidence is not treated as a missing control.",
  ].join("\n");
}
