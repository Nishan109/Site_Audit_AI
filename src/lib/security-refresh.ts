import { z } from "zod";
import type { AuditResult } from "./types";
import { hasSecurityReviewSteps } from "./security";
import { sourceURL } from "./source-url";

const url = z
  .string()
  .url()
  .refine((value) => sourceURL(value) !== null);
const steps = z.array(z.object({ title: z.string(), description: z.string() }));
const checkKeys = [
  "transport",
  "assets",
  "forms",
  "csp",
  "hsts",
  "framing",
  "mime",
  "referrer",
  "cookies",
] as const;
const check = z.object({
  id: z.string().min(1),
  key: z.enum(checkKeys),
  area: z.enum(["transport", "headers", "cookies"]),
  pageUrl: url,
  title: z.string().min(3),
  status: z.enum(["observed", "review", "not-observed", "not-assessed"]),
  detail: z.string().min(8),
  context: z.string().min(8),
  observations: z
    .array(z.object({ label: z.string().min(1), value: z.string() }))
    .min(1),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  steps,
  reference: url,
});
const review = z
  .object({
    method: z.literal("observed-security-signals-v1"),
    summary: z.string(),
    pages: z
      .array(
        z.object({
          url,
          title: z.string(),
          fetchedAt: z.string().datetime(),
          headersCollected: z.boolean(),
          sampled: z.boolean(),
          checks: z.array(check).length(checkKeys.length),
        }),
      )
      .min(1),
    scope: z.object({
      pages: z.number().int().positive(),
      headersCollected: z.number().int().nonnegative(),
      checks: z.number().int().positive(),
      actions: z.number().int().nonnegative(),
      sampled: z.boolean(),
    }),
    notTested: z.array(z.string()),
  })
  .refine((value) => {
    const checks = value.pages.flatMap((page) => page.checks);
    return (
      value.scope.pages === value.pages.length &&
      value.scope.checks === checks.length &&
      value.scope.headersCollected ===
        value.pages.filter((page) => page.headersCollected).length &&
      value.scope.actions === checks.filter(hasSecurityReviewSteps).length &&
      new Set(value.pages.map((page) => sourceURL(page.url))).size ===
        value.pages.length &&
      new Set(checks.map((check) => check.id)).size === checks.length &&
      value.pages.every(
        (page) =>
          new Set(page.checks.map((check) => check.key)).size ===
            checkKeys.length &&
          page.checks.every((check) => check.pageUrl === page.url),
      )
    );
  }, "Security results must contain a complete, consistent set of page-specific checks.");
export const securityAuditResultSchema = z.object({
  overallScore: z.null(),
  httpsEnabled: z.boolean().nullable(),
  mixedContent: z.boolean().nullable(),
  cookieConsent: z.null(),
  cspHeaders: z.boolean().nullable(),
  checkedAt: z.string().datetime().optional(),
  requestedUrl: url.optional(),
  issues: z.array(
    z.object({
      priority: z.enum(["High", "Medium", "Low"]),
      title: z.string(),
      detail: z.string(),
      pageUrl: url.optional(),
      evidence: z.string().optional(),
      fixSteps: steps.optional(),
    }),
  ),
  review,
});
export const securityRefreshSchema = z
  .object({
    requestedUrl: url,
    url,
    checkedAt: z.string().datetime(),
    audit: securityAuditResultSchema,
  })
  .refine(
    (value) =>
      value.url === value.audit.review.pages[0]?.url &&
      value.audit.requestedUrl === value.requestedUrl &&
      value.audit.checkedAt === value.checkedAt,
    "Security results do not match their collection metadata.",
  );
export type SecurityRefresh = z.infer<typeof securityRefreshSchema>;
export function validatedSecurityAudit(value: unknown, requestedUrl?: string) {
  const result = securityAuditResultSchema.safeParse(value);
  if (!result.success) return undefined;
  const recorded = result.data.requestedUrl ?? result.data.review.pages[0].url;
  return requestedUrl === undefined ||
    sourceURL(recorded) === sourceURL(requestedUrl)
    ? result.data
    : undefined;
}

export function hasSecurityResults(value: unknown, requestedUrl?: string) {
  return validatedSecurityAudit(value, requestedUrl) !== undefined;
}
/** Update only the report that initiated the refresh; retain all marketing findings. */
export function applySecurityRefresh(
  result: AuditResult | null,
  update: SecurityRefresh,
  reportId: string,
): AuditResult | null {
  if (
    !result ||
    sourceURL(result.url) !== sourceURL(update.requestedUrl) ||
    (result.analysisId || result.analyzedAt) !== reportId
  )
    return result;
  const scope = update.audit.review.scope;
  const step = {
    name: "Security checks",
    status: "completed" as const,
    detail: `${scope.checks} scoped checks across ${scope.pages} page(s); ${scope.headersCollected} response(s) with headers collected. Refreshed ${new Date(update.checkedAt).toLocaleString()} using fresh headers and HTML. Marketing findings retained; no exploit testing performed.`,
  };
  return {
    ...result,
    securityAudit: update.audit,
    sources: [
      ...new Set([
        ...result.sources,
        ...update.audit.review.pages.map((page) => page.url),
      ]),
    ],
    agentSteps: result.agentSteps.some((item) => item.name === step.name)
      ? result.agentSteps.map((item) => (item.name === step.name ? step : item))
      : [...result.agentSteps, step],
  };
}
