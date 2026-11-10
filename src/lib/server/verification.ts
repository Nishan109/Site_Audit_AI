import { AuditError } from "./errors";

/** Completeness only: never infer or fill an omitted evidence decision. */
export function requireCandidateCoverage(
  candidates: readonly { id: string }[],
  checks: readonly { id: string }[],
  area: string,
) {
  const expected = new Set(candidates.map((candidate) => candidate.id));
  if (
    checks.length !== expected.size ||
    new Set(checks.map((check) => check.id)).size !== expected.size ||
    checks.some((check) => !expected.has(check.id))
  )
    throw new AuditError(
      `The ${area} verification was incomplete. Please retry.`,
      502,
      "INVALID_AI_RESPONSE",
    );
}
