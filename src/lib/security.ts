import type { FixStep } from "./types";

export const SECURITY_STATUS = {
  observed: "Observed",
  review: "Review",
  "not-observed": "Not observed",
  "not-assessed": "Not assessed",
} as const;
export type SecurityStatus = keyof typeof SECURITY_STATUS;
export type SecurityArea = "transport" | "headers" | "cookies";
export interface SecurityCookie {
  secure: boolean;
  httpOnly: boolean;
  sameSite: "strict" | "lax" | "none" | "unspecified" | "unrecognized";
}
export const SECURITY_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
] as const;
export type SecurityHeader = (typeof SECURITY_HEADERS)[number];
export interface SecurityResponse {
  status: number;
  headers: Record<SecurityHeader, string[]>;
  cookies: SecurityCookie[];
}
export interface SecurityReference {
  element: string;
  attribute: string;
  url: string;
}
export interface SecuritySnapshot {
  url: string;
  htmlCollected: boolean;
  headersCollected: boolean;
  response?: SecurityResponse;
  metaCsp: string[];
  httpAssets: SecurityReference[];
  httpForms: SecurityReference[];
  httpAssetCount: number;
  httpFormCount: number;
  sampled: boolean;
}
export interface SecurityCheck {
  id: string;
  key:
    | "transport"
    | "assets"
    | "forms"
    | "csp"
    | "hsts"
    | "framing"
    | "mime"
    | "referrer"
    | "cookies";
  area: SecurityArea;
  pageUrl: string;
  title: string;
  status: SecurityStatus;
  detail: string;
  context: string;
  observations: { label: string; value: string }[];
  priority?: "High" | "Medium" | "Low";
  steps: FixStep[];
  reference: string;
}
export interface SecurityReview {
  method: "observed-security-signals-v1";
  summary: string;
  pages: {
    url: string;
    title: string;
    fetchedAt: string;
    headersCollected: boolean;
    sampled: boolean;
    checks: SecurityCheck[];
  }[];
  scope: {
    pages: number;
    headersCollected: number;
    checks: number;
    actions: number;
    sampled: boolean;
  };
  notTested: string[];
}
export const SECURITY_NOT_TESTED = [
  "Exploitable vulnerabilities, malware and dependency risks",
  "TLS versions, cipher configuration, certificate lifetime and HSTS preload status",
  "Login, authorization, session lifecycle and server-side input handling",
  "Browser-loaded resources, external CSS, JavaScript requests and submitted forms",
  "Cookie consent, legal compliance, cookie values and authenticated responses",
];
export const SECURITY_GUIDANCE = {
  transport:
    "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts",
  assets:
    "https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content",
  forms:
    "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form",
  csp: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy",
  hsts: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security",
  framing:
    "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors",
  mime: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options",
  referrer:
    "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy",
  cookies:
    "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie",
} as const;
export const hasSecurityReviewSteps = (check: SecurityCheck) =>
  !!check.priority && check.steps.length > 0;

export function securityActions(review: SecurityReview) {
  const priorities = { High: 0, Medium: 1, Low: 2 };
  return review.pages
    .flatMap((page) => page.checks)
    .filter(hasSecurityReviewSteps)
    .sort((a, b) => priorities[a.priority!] - priorities[b.priority!]);
}
