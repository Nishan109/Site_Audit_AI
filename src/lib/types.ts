import type { CopySource, CopySuggestion, MessagingAnalysis, MessagingCriterion } from "./messaging";
import type { UXAnalysis, UXCriterion, UXSource } from "./ux";
import type { SEOAnalysis, SEOCriterion, SEOSource } from "./seo";
import type { ConversionAnalysis, ConversionCriterion, ConversionSource } from "./conversion";
import type { QuickWinArea, QuickWinsSelection } from "./quick-wins";
import type { AIVisibilityCriterion, AIVisibilityReview, AIVisibilitySource } from "./ai-visibility";
import type { SecurityReview } from "./security";
import type { AccessibilityReview } from "./accessibility";

export interface Issue {
  priority: "High" | "Medium" | "Low";
  title: string;
  detail: string;
  fixSteps?: FixStep[];
  pageUrl?: string;
  evidence?: string;
  copySuggestion?: CopySuggestion;
  messagingCriterion?: MessagingCriterion;
  messagingEvidence?: CopySource[];
  supportingEvidence?: CopySource[];
  evidenceType?: "html-observation" | "seo-observation" | "conversion-observation" | "ai-observation";
  aiCriterion?: AIVisibilityCriterion;
  aiEvidence?: AIVisibilitySource[];
  uxEvidence?: UXSource[];
  uxCriterion?: UXCriterion;
  seoCriterion?: SEOCriterion;
  seoEvidence?: SEOSource[];
  conversionCriterion?: ConversionCriterion;
  conversionEvidence?: ConversionSource[];
}

export interface QuickWin {
  action: string;
  impact: string;
  effort: "Low" | "Medium" | "High";
  pageUrl?: string;
  evidence?: string;
  id?: string;
  category?: QuickWinArea;
  relatedIssue?: Issue;
  evidenceType?: Issue["evidenceType"];
  messagingEvidence?: CopySource[];
  uxEvidence?: UXSource[];
  seoEvidence?: SEOSource[];
  conversionEvidence?: ConversionSource[];
}

export interface AgentStep {
  name: string;
  detail: string;
  status?: "completed" | "unavailable";
}

export interface FixStep {
  title: string;
  description: string;
}

export interface AuditScores {
  Messaging: number;
  UX: number | null;
  SEO: number | null;
  Conversion: number | null;
  AEO?: number | null;
  Security?: number;
  Accessibility?: number;
}

export interface AEOAnalysis {
  overallScore: number | null;
  structuredDataScore: number | null;
  contentReadabilityScore: number | null;
  entityCoverageScore: number | null;
  faqPresenceScore: number | null;
  schemaMarkupTypes: string[];
  issues: Issue[];
  review?: AIVisibilityReview;
}

export interface SecurityAudit {
  checkedAt?: string;
  requestedUrl?: string;
  overallScore: number | null;
  httpsEnabled: boolean | null;
  mixedContent: boolean | null;
  cookieConsent: boolean | null;
  cspHeaders: boolean | null;
  issues: Issue[];
  review?: SecurityReview;
}

export interface AccessibilityAudit {
  checkedAt?: string;
  requestedUrl?: string;
  overallScore: number | null;
  headingHierarchy: boolean | null;
  altTextCoverage: boolean | null;
  contrastIssues: number | null;
  ariaLabels: boolean | null;
  issues: Issue[];
  review?: AccessibilityReview;
}

export interface SWOTItem {
  text: string;
}

export interface SWOTAnalysis {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
}

export interface AuditResult {
  storage?: { status: "saved"; reportId: string } | { status: "unavailable"; reason: string };
  research?: { provider: string; modelUsed: string; summary: string; searchedAt: string; sources: string[]; queries: string[] };
  analysisId?: string;
  modelUsed?: string;
  dataSource?: "live";
  warnings?: string[];
  limitations?: string[];
  pagesAnalyzed?: Array<{ url: string; title: string; fetchedAt: string; contentHash: string; collectionNote?: string }>;
  url: string;
  analyzedAt: string;
  summary: string;
  overview: string;
  scores: AuditScores;
  topIssues: Issue[];
  messaging: Issue[];
  messagingAnalysis?: MessagingAnalysis;
  ux: Issue[];
  uxAnalysis?: UXAnalysis;
  seo: Issue[];
  seoAnalysis?: SEOAnalysis;
  conversion: Issue[];
  conversionAnalysis?: ConversionAnalysis;
  quickWins: QuickWin[];
  quickWinsSelection?: QuickWinsSelection;
  searchQueries: string[];
  sources: string[];
  agentSteps: AgentStep[];
  initialReviewTiming?: import("./review-progress").InitialReviewTiming;
  aeoAnalysis?: AEOAnalysis;
  securityAudit?: SecurityAudit;
  accessibilityAudit?: AccessibilityAudit;
  pageSpeedReports?: Partial<Record<import("./pagespeed").PageSpeedDevice, PageSpeedResult>>;
  swotAnalysis?: SWOTAnalysis;
}

export interface GoogleAd {
  headline: string;
  description: string;
}

export interface FacebookAd {
  primaryText: string;
  headline: string;
  description: string;
}

export interface AdAssets {
  googleAds: GoogleAd[];
  facebookAds: FacebookAd[];
}

export interface CompetitorCard {
  name: string;
  url: string;
  positioning: string;
  advantage: string;
}

export interface Battlecards {
  competitors: CompetitorCard[];
}

export interface PageSpeedMetric {
  value: number | null;
  unit: "" | "ms";
  rating: "good" | "needs-improvement" | "poor" | "unavailable";
}

export type PageSpeedResult = import("./pagespeed").PageSpeedReport;

export type AppState = "idle" | "loading" | "results" | "error";
