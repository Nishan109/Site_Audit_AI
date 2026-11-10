import { collectEvidence } from "./evidence";
import { buildSecurityAudit } from "./security";
import { normalizeUrl } from "./url";
import { securityRefreshSchema } from "../security-refresh";
import { AuditError } from "./errors";

export async function refreshSecurityChecks(
  rawUrl: unknown,
  signal: AbortSignal,
  collect = collectEvidence,
) {
  const requestedUrl = normalizeUrl(rawUrl);
  signal.throwIfAborted();
  // Reuse DNS pinning, public-address validation, redirect and response limits.
  // Security collection requires no model configuration or AI request.
  const evidence = await collect(requestedUrl, signal);
  signal.throwIfAborted();
  const checkedAt = new Date().toISOString();
  const result = securityRefreshSchema.safeParse({
    requestedUrl,
    url: evidence.url,
    checkedAt,
    audit: { ...buildSecurityAudit(evidence.pages), checkedAt, requestedUrl },
  });
  if (!result.success)
    throw new AuditError(
      "The collected security evidence was incomplete. Please retry the security checks.",
      502,
      "INVALID_SECURITY_RESPONSE",
    );
  return result.data;
}
