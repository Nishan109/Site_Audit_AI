import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import ReviewWorkspace from "@/components/AuditWorkspace";
import { requireAccount } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { savedReport } from "@/lib/saved-reports";

export const metadata = {
  title: "Saved review · SiteAudit AI",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const { data, error } = await client
    .from("audit_reports")
    .select("id,schema_version,snapshot")
    .eq("id", id)
    .eq("owner_id", account.id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Your saved report is temporarily unavailable. Please retry.",
    );
  if (!data) notFound();
  const report = savedReport(data.snapshot, data.schema_version, id);
  if (!report)
    return (
      <main className="app-main">
        <h1>This report needs a newer reader</h1>
        <p>
          Its saved format could not be verified. Start a new review or return
          to your history.
        </p>
        <Link href="/workspace">Back to audit history</Link>
      </main>
    );
  return (
    <ReviewWorkspace
      key={account.id + id}
      account={account}
      initialReport={report}
    />
  );
}
