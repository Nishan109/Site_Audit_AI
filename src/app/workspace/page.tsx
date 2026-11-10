import ReviewWorkspace from "@/components/AuditWorkspace";
import AuditHistory from "@/components/AuditHistory";
import { requireAccount } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { historyCursorSchema, type ReportSummary } from "@/lib/saved-reports";

export const metadata = {
  title: "Your workspace · SiteAudit AI",
  robots: { index: false, follow: false },
};

export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const account = await requireAccount();
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const client = await createClient();
  let request = client
    .from("audit_reports")
    .select("id,audited_url,hostname,analyzed_at", { count: "exact" })
    .eq("owner_id", account.id)
    .order("analyzed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(21);
  if (query)
    request = request.ilike(
      "audited_url",
      `%${query.replace(/[\\%_]/g, "\\$&")}%`,
    );
  try {
    const cursor = historyCursorSchema.safeParse(
      JSON.parse(Buffer.from(params.cursor || "", "base64url").toString()),
    );
    if (cursor.success)
      request = request.or(
        `analyzed_at.lt.${cursor.data.at},and(analyzed_at.eq.${cursor.data.at},id.lt.${cursor.data.id})`,
      );
  } catch {
    /* Invalid cursors begin at the first page. */
  }
  const { data, error, count } = await request;
  const rows = (data || []) as ReportSummary[];
  const last = rows[19];
  const nextCursor =
    rows.length > 20
      ? Buffer.from(
          JSON.stringify({ at: last.analyzed_at, id: last.id }),
        ).toString("base64url")
      : undefined;
  return (
    <ReviewWorkspace
      key={account.id}
      account={account}
      history={
        <AuditHistory
          key={`${query}:${params.cursor || ""}`}
          reports={rows.slice(0, 20)}
          count={error ? null : count}
          query={query}
          nextCursor={nextCursor}
          olderPage={Boolean(params.cursor)}
          failed={Boolean(error)}
        />
      }
    />
  );
}
