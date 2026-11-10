import { z } from "zod";
import { aiVisibilityIssueSchema, aiVisibilityReviewSchema } from "./ai-visibility-schemas";

export const scoreSchema = z.number().int().min(0).max(100);
export const fixStepSchema = z.object({ title: z.string().min(3), description: z.string().min(8) });
export const issueSchema = z.object({
  priority: z.enum(["High", "Medium", "Low"]), title: z.string().min(5), detail: z.string().min(15),
  pageUrl: z.string(), evidence: z.string().trim().min(2), fixSteps: z.array(fixStepSchema).min(2).max(5),
});
const issues = z.array(issueSchema).max(6);
const copySourceSchema = z.object({ id: z.string(), pageUrl: z.string().url(), quote: z.string().min(2), kind: z.string(), region: z.string(), destination: z.string().optional(), renderingNote: z.string().optional() });
export const messagingIssueSchema = issueSchema.extend({
  copySuggestion: z.object({ original: z.string().min(2), replacement: z.string().min(3), sources: z.array(copySourceSchema).min(1) }).optional(),
  supportingEvidence: z.array(copySourceSchema).max(4).optional(),
  messagingCriterion: z.enum(["clarity", "audience", "specificity", "consistency"]).optional(),
  messagingEvidence: z.array(copySourceSchema).min(1).max(5).optional(),
});
const uxSourceSchema = z.object({ id: z.string(), pageUrl: z.string().url(), kind: z.enum(["page", "navigation", "heading", "link", "button", "form", "field"]), location: z.string(), observation: z.string() });
export const uxIssueSchema = issueSchema.extend({ evidenceType: z.literal("html-observation"), uxEvidence: z.array(uxSourceSchema).min(1).max(5), uxCriterion: z.enum(["navigation", "structure", "controls", "forms"]).optional() });
const seoSourceSchema = z.object({ id: z.string(), pageUrl: z.string().url(), kind: z.enum(["metadata", "canonical", "directives", "headings", "links", "structured", "content"]), label: z.string(), observation: z.string() });
export const seoIssueSchema = issueSchema.extend({ evidenceType: z.literal("seo-observation"), seoEvidence: z.array(seoSourceSchema).min(1).max(5), seoCriterion: z.enum(["metadata", "discovery", "content", "structured"]) });
const conversionSourceSchema = z.object({ id: z.string(), pageUrl: z.string().url(), kind: z.enum(["page", "link", "button", "form", "field", "copy"]), location: z.string(), observation: z.string() });
export const conversionIssueSchema = issueSchema.extend({ evidenceType: z.literal("conversion-observation"), conversionCriterion: z.enum(["actions", "decision", "forms", "expectations"]), conversionEvidence: z.array(conversionSourceSchema).min(1).max(5) });
export const quickWinSchema = z.object({
  action: z.string().min(5), impact: z.string().min(5).describe("A concrete qualitative benefit to validate, not an impact rating or predicted uplift."), effort: z.enum(["Low", "Medium", "High"]),
  pageUrl: z.string(), evidence: z.string().trim().min(2),
});
// An optional incomplete benefit is withheld by the specialist before review;
// it must not discard otherwise valid evidence-backed findings.
export const quickWinDraftSchema = quickWinSchema.extend({ impact: z.string().describe("Describe the specific qualitative benefit in a full sentence. Do not return an impact level such as Low or High.") });
export const verifiedQuickWinSchema = quickWinSchema.extend({
  id: z.string().min(8), category: z.enum(["messaging", "ux", "seo", "conversion"]),
  relatedIssue: z.union([uxIssueSchema, seoIssueSchema, conversionIssueSchema, messagingIssueSchema]),
  evidenceType: z.enum(["html-observation", "seo-observation", "conversion-observation"]).optional(),
  messagingEvidence: z.array(copySourceSchema).min(1).max(5).optional(),
  uxEvidence: z.array(uxSourceSchema).min(1).max(5).optional(),
  seoEvidence: z.array(seoSourceSchema).min(1).max(5).optional(),
  conversionEvidence: z.array(conversionSourceSchema).min(1).max(5).optional(),
});
export const auditSchema = z.object({
  summary: z.string().min(15), overview: z.string().min(30),
  scores: z.object({ Messaging: scoreSchema, UX: scoreSchema.nullable(), SEO: scoreSchema.nullable(), Conversion: scoreSchema.nullable(), AEO: scoreSchema.nullable() }),
  topIssues: z.array(z.union([uxIssueSchema, seoIssueSchema, conversionIssueSchema, issueSchema])).max(6), messaging: z.array(messagingIssueSchema).max(4), ux: z.array(uxIssueSchema).max(4), seo: z.array(seoIssueSchema).max(4), conversion: z.array(conversionIssueSchema).max(4),
  quickWins: z.array(verifiedQuickWinSchema).max(6),
  aeoAnalysis: z.object({ overallScore: scoreSchema.nullable(), structuredDataScore: scoreSchema.nullable(), contentReadabilityScore: scoreSchema.nullable(), entityCoverageScore: scoreSchema.nullable(), faqPresenceScore: scoreSchema.nullable(), schemaMarkupTypes: z.array(z.string()), issues: z.array(z.union([aiVisibilityIssueSchema, issueSchema])).max(4), review: aiVisibilityReviewSchema.optional() }),
  swotAnalysis: z.object({
    strengths: z.array(z.object({ text: z.string() })).max(4), weaknesses: z.array(z.object({ text: z.string() })).max(4),
    opportunities: z.array(z.object({ text: z.string() })).max(4), threats: z.array(z.object({ text: z.string() })).max(4),
  }),
});
export const categorySchema = z.object({ score: scoreSchema, summary: z.string().min(15), issues, quickWins: z.array(quickWinSchema).max(2) });
export const strategySchema = auditSchema.pick({ aeoAnalysis: true, swotAnalysis: true });
export const adsSchema = z.object({
  googleAds: z.array(z.object({ headline: z.string().min(3).max(30), description: z.string().min(5).max(90), score: scoreSchema, tag: z.string(), reason: z.string() })).min(1).max(3),
  facebookAds: z.array(z.object({ primaryText: z.string().min(5), headline: z.string().min(3), description: z.string(), score: scoreSchema, tag: z.string(), reason: z.string() })).min(1).max(2),
});
export const competitorsSchema = z.object({ competitors: z.array(z.object({ name: z.string(), url: z.string().url(), positioning: z.string(), advantage: z.string() })).max(3) });
const creativeCriterionSchema = z.object({
  score: scoreSchema,
  evidence: z.string().trim().min(12).max(500),
});
export const creativeCriteriaSchema = z.object({
  message: creativeCriterionSchema,
  hierarchy: creativeCriterionSchema,
  legibility: creativeCriterionSchema,
  action: creativeCriterionSchema,
});
// The model assesses one image, without an A/B label or a winner field.
export const independentCreativeSchema = z.object({
  criteria: creativeCriteriaSchema,
  strengths: z.array(z.string().trim().min(5).max(400)).min(1).max(4),
  weaknesses: z.array(z.string().trim().min(5).max(400)).max(4),
  improvements: z.array(z.string().trim().min(5).max(400)).min(1).max(3),
});
const creativeSchema = z.object({
  score: scoreSchema,
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()),
  criteria: creativeCriteriaSchema.optional(),
});
export const comparisonSchema = z.object({
  winner: z.enum(["Creative A", "Creative B", "Tie"]),
  rationale: z.string().min(20),
  creativeA: creativeSchema,
  creativeB: creativeSchema,
  recommendations: z.array(z.string()).min(1),
  reviewMethod: z.literal("independent-rubric-v1").optional(),
  identicalInputs: z.boolean().optional(),
});
