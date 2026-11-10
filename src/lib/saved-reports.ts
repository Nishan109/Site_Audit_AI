import { z } from "zod";
import { reportSchema } from "./review-response";
import type { AuditResult } from "./types";

const score = z.number().finite().min(0).max(100).nullable();
const issue = z.object({
  title: z.string(),
  detail: z.string(),
  priority: z.enum(["High", "Medium", "Low"]),
});
const savedSchema = reportSchema.extend({
  analysisId: z.uuid(),
  analyzedAt: z.iso.datetime({ offset: true }),
  summary: z.string(),
  overview: z.string(),
  scores: z.object({
    Messaging: score,
    UX: score,
    SEO: score,
    Conversion: score,
    AEO: score.optional(),
  }),
  topIssues: z.array(issue),
  messaging: z.array(issue),
  ux: z.array(issue),
  seo: z.array(issue),
  conversion: z.array(issue),
  quickWins: z.array(
    z.object({
      action: z.string(),
      impact: z.string(),
      effort: z.enum(["Low", "Medium", "High"]),
    }),
  ),
  agentSteps: z.array(z.object({ name: z.string(), detail: z.string() })),
});

export function savedReport(
  value: unknown,
  version: number,
  id: string,
): AuditResult | null {
  if (version !== 1 || !savedSchema.safeParse(value).success) return null;
  const result = value as AuditResult;
  return result.analysisId === id ? result : null;
}

export function containsSensitiveUrl(value: unknown): boolean {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return (
        Boolean(url.username || url.password) ||
        [...url.searchParams.keys()].some((name) =>
          /token|secret|password|api.?key|signature|credential|^code$|^email$|^auth$/i.test(
            name,
          ),
        )
      );
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some(containsSensitiveUrl);
  if (value && typeof value === "object")
    return Object.values(value).some(containsSensitiveUrl);
  return false;
}

export const historyCursorSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export interface ReportSummary {
  id: string;
  audited_url: string;
  hostname: string;
  analyzed_at: string;
}
