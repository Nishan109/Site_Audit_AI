import { z } from "zod";
import type { AuditResult } from "./types";
import { ACCESSIBILITY_KEYS, accessibilityActions } from "./accessibility";
import { sourceURL } from "./source-url";

const url = z
  .string()
  .url()
  .refine((value) => sourceURL(value) !== null);
const steps = z.array(z.object({ title: z.string(), description: z.string() }));
const checkKeys = ACCESSIBILITY_KEYS;
const check = z.object({
  id: z.string().min(1),
  key: z.enum(checkKeys),
  area: z.enum(["content", "navigation", "forms", "semantics"]),
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
    method: z.literal("html-accessibility-signals-v1"),
    summary: z.string(),
    pages: z
      .array(
        z.object({
          url,
          title: z.string(),
          fetchedAt: z.string().datetime(),
          collected: z.boolean(),
          sampled: z.boolean(),
          checks: z.array(check).length(checkKeys.length),
        }),
      )
      .min(1),
    scope: z.object({
      pages: z.number().int().positive(),
      collected: z.number().int().positive(),
      checks: z.number().int().positive(),
      actions: z.number().int().nonnegative(),
      sampled: z.boolean(),
    }),
    notTested: z.array(
      z.object({ title: z.string(), instructions: z.string() }),
    ),
  })
  .refine((value) => {
    const checks = value.pages.flatMap((page) => page.checks);
    return (
      value.scope.pages === value.pages.length &&
      value.scope.checks === checks.length &&
      value.scope.collected ===
        value.pages.filter((page) => page.collected).length &&
      value.scope.sampled === value.pages.some((page) => page.sampled) &&
      value.scope.actions === accessibilityActions(value).length &&
      new Set(value.pages.map((page) => sourceURL(page.url))).size ===
        value.pages.length &&
      new Set(checks.map((check) => check.id)).size === checks.length &&
      value.pages.every(
        (page) =>
          new Set(page.checks.map((check) => check.key)).size ===
            checkKeys.length &&
          page.checks.every(
            (check) =>
              sourceURL(check.pageUrl) === sourceURL(page.url) &&
              (page.collected ||
                (check.status === "not-assessed" &&
                  !check.steps.length &&
                  !check.priority)),
          ),
      )
    );
  }, "Accessibility results must contain a complete, consistent set of page-specific checks.");
export const accessibilityAuditResultSchema = z.object({
  overallScore: z.null(),
  headingHierarchy: z.boolean().nullable(),
  altTextCoverage: z.boolean().nullable(),
  ariaLabels: z.boolean().nullable(),
  contrastIssues: z.null(),
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
export const accessibilityRefreshSchema = z
  .object({
    requestedUrl: url,
    url,
    checkedAt: z.string().datetime(),
    audit: accessibilityAuditResultSchema,
  })
  .refine(
    (value) =>
      value.url === value.audit.review.pages[0]?.url &&
      value.audit.requestedUrl === value.requestedUrl &&
      value.audit.checkedAt === value.checkedAt,
    "Accessibility results do not match their collection metadata.",
  );
export type AccessibilityRefresh = z.infer<typeof accessibilityRefreshSchema>;
export function validatedAccessibilityAudit(
  value: unknown,
  requestedUrl?: string,
) {
  const result = accessibilityAuditResultSchema.safeParse(value);
  if (!result.success) return undefined;
  const recorded = result.data.requestedUrl ?? result.data.review.pages[0].url;
  return requestedUrl === undefined ||
    sourceURL(recorded) === sourceURL(requestedUrl)
    ? result.data
    : undefined;
}
export function hasAccessibilityResults(value: unknown, requestedUrl?: string) {
  return validatedAccessibilityAudit(value, requestedUrl) !== undefined;
}
/** Update only the report that initiated the refresh; retain all marketing findings. */
export function applyAccessibilityRefresh(
  result: AuditResult | null,
  update: AccessibilityRefresh,
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
    name: "Accessibility checks",
    status: "completed" as const,
    detail: `${scope.checks} scoped checks across ${scope.pages} page(s); ${scope.collected} page(s) with HTML evidence collected. Refreshed ${new Date(update.checkedAt).toLocaleString()} using fresh HTML. Marketing findings retained; browser and assistive-technology testing remain separate.`,
  };
  return {
    ...result,
    accessibilityAudit: update.audit,
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
