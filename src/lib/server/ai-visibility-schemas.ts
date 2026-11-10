import { z } from "zod";

export const aiVisibilityCriterionSchema = z.enum([
  "answers",
  "identity",
  "support",
  "structure",
]);
export const aiVisibilitySourceSchema = z.object({
  id: z.string(),
  pageUrl: z.string().url(),
  kind: z.enum(["copy", "metadata", "headings", "structured"]),
  label: z.string(),
  text: z.string(),
  region: z.string().optional(),
  heading: z.string().optional(),
  truncated: z.boolean().optional(),
});
const steps = z
  .array(z.object({ title: z.string().min(3), description: z.string().min(8) }))
  .min(2)
  .max(3);
const ids = z.array(z.string().min(4)).min(1).max(5);
export const aiVisibilityIssueSchema = z.object({
  title: z.string().min(5),
  detail: z.string().min(15),
  priority: z.enum(["High", "Medium", "Low"]),
  fixSteps: steps,
  pageUrl: z.string().url(),
  evidence: z.string().min(2),
  evidenceType: z.literal("ai-observation"),
  aiCriterion: aiVisibilityCriterionSchema,
  aiEvidence: z.array(aiVisibilitySourceSchema).min(1).max(5),
});
export const aiVisibilityDraftSchema = z.object({
  strengths: z
    .array(z.object({ text: z.string().min(15), evidenceIds: ids }))
    .max(3),
  issues: z
    .array(
      z.object({
        title: z.string().min(5),
        detail: z.string().min(15),
        priority: z.enum(["High", "Medium", "Low"]),
        criterion: aiVisibilityCriterionSchema,
        evidenceIds: ids,
        fixSteps: steps,
      }),
    )
    .max(4),
});
const criterion = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  reason: z.string().min(20),
  evidenceIds: z.array(z.string()).max(5),
});
export const aiVisibilityVerificationSchema = z.object({
  summary: z.object({ text: z.string().min(30), evidenceIds: ids }),
  criteria: z.object({
    answers: criterion,
    identity: criterion,
    support: criterion,
    structure: criterion,
  }),
  checks: z
    .array(
      z.object({
        id: z.string(),
        decision: z.enum(["supported", "unsupported", "uncertain"]),
      }),
    )
    .max(7),
});
export const aiVisibilityReviewSchema = z.object({
  method: z.literal("cited-content-readiness-v1"),
  summary: z.string(),
  summarySources: z.array(aiVisibilitySourceSchema),
  criteria: z.array(
    criterion
      .omit({ evidenceIds: true })
      .extend({
        key: aiVisibilityCriterionSchema,
        sources: z.array(aiVisibilitySourceSchema),
      }),
  ),
  strengths: z.array(
    z.object({ text: z.string(), sources: z.array(aiVisibilitySourceSchema) }),
  ),
  evidence: z.array(aiVisibilitySourceSchema),
  pages: z.array(
    z.object({
      url: z.string().url(),
      title: z.string(),
      excerptIds: z.array(z.string()),
      headings: z.array(z.object({ level: z.number(), text: z.string() })),
      markup: z.object({
        collected: z.boolean(),
        jsonLdBlocks: z.number(),
        invalidJsonLd: z.number(),
        jsonLdTypes: z.array(z.string()),
        microdataTypes: z.array(z.string()),
        rdfaTypes: z.array(z.string()),
      }),
      sampled: z.boolean(),
    }),
  ),
  verification: z.object({
    checked: z.number(),
    retained: z.number(),
    withheld: z.number(),
  }),
  assessmentValidation: z.object({
    summaryWithheld: z.boolean(),
    withheldCriteria: z.array(aiVisibilityCriterionSchema),
  }),
  scope: z.object({
    pages: z.number(),
    sources: z.number(),
    sampled: z.boolean(),
  }),
  unassessed: z.array(z.string()),
});
