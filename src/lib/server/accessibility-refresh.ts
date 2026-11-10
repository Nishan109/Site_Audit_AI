import { collectEvidence } from "./evidence";
import { buildAccessibilityAudit } from "./accessibility";
import { normalizeUrl } from "./url";
import { accessibilityRefreshSchema } from "../accessibility-refresh";
import { AuditError } from "./errors";

export async function refreshAccessibilityChecks(
  rawUrl: unknown,
  signal: AbortSignal,
  collect = collectEvidence,
) {
  const requestedUrl = normalizeUrl(rawUrl);
  signal.throwIfAborted();
  // Reuse DNS pinning, public-address validation, redirect and response limits.
  // Accessibility collection requires no model configuration or AI request.
  const evidence = await collect(requestedUrl, signal);
  signal.throwIfAborted();
  const checkedAt = new Date().toISOString();
  const result = accessibilityRefreshSchema.safeParse({
    requestedUrl,
    url: evidence.url,
    checkedAt,
    audit: {
      ...buildAccessibilityAudit(evidence.pages),
      checkedAt,
      requestedUrl,
    },
  });
  if (!result.success)
    throw new AuditError(
      "The collected accessibility evidence was incomplete. Please retry the accessibility checks.",
      502,
      "INVALID_ACCESSIBILITY_RESPONSE",
    );
  return result.data;
}
