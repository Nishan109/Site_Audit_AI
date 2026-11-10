import { extractEvidence } from "../src/lib/server/evidence";
import { securityResponse } from "../src/lib/server/security-evidence";
import { buildSecurityAudit } from "../src/lib/server/security";

export const url = "https://bakery.example/";
const html =
  '<html><head><title>Acorn Bakery</title></head><body><main><h1>Saturday bread collection</h1><p>Acorn Bakery bakes white sourdough and rye loaves for collection in Bath on Saturdays.</p><img src="http://cdn.example/bread.png?token=PRIVATE_ASSET_TOKEN"></main></body></html>';
const page = extractEvidence(
  html,
  url,
  false,
  undefined,
  securityResponse(200, {
    "content-security-policy-report-only": "default-src 'self'",
    "strict-transport-security": "max-age=0",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "set-cookie":
      "PRIVATE_COOKIE_NAME=PRIVATE_COOKIE_VALUE; HttpOnly; SameSite=None",
  }),
);
page.fetchedAt = "2026-11-07T10:00:00.000Z";
const other = extractEvidence(
  html.replace("Acorn Bakery", "About Acorn Bakery").replace(/<img[^>]+>/, ""),
  `${url}about`,
  false,
);
other.fetchedAt = page.fetchedAt;
export const audit = buildSecurityAudit([page, other]);
export const readyAudit = buildSecurityAudit([
  extractEvidence(
    "<title>Bakery information</title><main><h1>Acorn Bakery</h1><p>Our bakery prepares white sourdough and rye loaves for Saturday collection in Bath.</p></main>",
    url,
    true,
    undefined,
    securityResponse(200, {
      "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
    }),
  ),
]);
