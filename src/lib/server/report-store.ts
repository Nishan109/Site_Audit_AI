import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Account } from "../auth";
import type { AuditResult } from "../types";
import { containsSensitiveUrl, savedReport } from "../saved-reports";

export async function saveCompletedReport(
  report: AuditResult,
  owner: Account,
  signal: AbortSignal,
): Promise<AuditResult> {
  signal.throwIfAborted();
  const unavailable = (reason: string): AuditResult => ({
    ...report,
    storage: { status: "unavailable", reason },
  });
  if (!report.analysisId || !savedReport(report, 1, report.analysisId))
    return unavailable(
      "This report couldn’t be verified for storage. You can still export it.",
    );
  if (containsSensitiveUrl(report))
    return unavailable(
      "A source address contains sensitive query information. Export this review for your records.",
    );
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    return unavailable(
      "Saving is temporarily unavailable. You can export this review while storage is configured.",
    );
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: deadline, cache: "no-store" }),
    },
  });
  const { storage: _storage, ...snapshot } = report;
  void _storage;
  try {
    const row = {
      id: report.analysisId,
      owner_id: owner.id,
      audited_url: report.url,
      hostname: new URL(report.url).hostname,
      analyzed_at: report.analyzedAt,
      schema_version: 1,
      snapshot,
    };
    const { error } = await client.from("audit_reports").insert(row);
    signal.throwIfAborted();
    if (error?.code === "23505") {
      const existing = await client
        .from("audit_reports")
        .select("id")
        .eq("id", row.id)
        .eq("owner_id", owner.id)
        .eq("audited_url", row.audited_url)
        .maybeSingle();
      if (existing.error || !existing.data)
        return unavailable(
          "We couldn’t confirm this report was saved. You can still export it.",
        );
    } else if (error)
      return unavailable(
        "We couldn’t confirm this report was saved. You can still export it.",
      );
    return { ...report, storage: { status: "saved", reportId: row.id } };
  } catch {
    signal.throwIfAborted();
    return unavailable(
      "We couldn’t confirm this report was saved. You can still export it.",
    );
  }
}
