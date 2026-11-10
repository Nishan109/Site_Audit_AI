import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dashboardFixture } from "../tests/dashboard-fixtures";
import { saveCompletedReport } from "../src/lib/server/report-store";

// Run only against the configured SiteAudit development project. All fixtures
// belong to disposable accounts and are removed in finally, including reports.
const origin = process.env.NEXT_PUBLIC_APP_URL!;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
assert.ok(
  secret,
  "Configure the server secret before running account verification.",
);
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(url, secret, options);
const accounts: Array<{ id: string; email: string; password: string }> = [];
const clients: SupabaseClient[] = [];

async function appLogin(account: (typeof accounts)[number]) {
  const response = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, "Application password login failed.");
  assert.equal((await response.json()).redirect, "/workspace");
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(
    cookie.includes("auth-token"),
    "Login did not set session cookies.",
  );
  return cookie;
}

try {
  for (let index = 0; index < 2; index++) {
    const email = `siteaudit-verification-${randomUUID()}@example.com`;
    const password = randomUUID() + "!aA9";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { verification_fixture: true },
    });
    assert.ifError(created.error);
    assert.ok(created.data.user);
    accounts.push({ id: created.data.user.id, email, password });
  }
  const [owner, other] = accounts;
  const report = {
    ...dashboardFixture(),
    analysisId: randomUUID(),
    analyzedAt: new Date().toISOString(),
  };
  const saved = await saveCompletedReport(
    report,
    owner,
    new AbortController().signal,
  );
  assert.equal(
    saved.storage?.status,
    "saved",
    "Canonical report persistence failed.",
  );
  const repeated = await saveCompletedReport(
    report,
    owner,
    new AbortController().signal,
  );
  assert.equal(
    repeated.storage?.status,
    "saved",
    "Saving the same analysis ID must be idempotent.",
  );
  console.log("Server save and duplicate-save verification passed.");

  const cookie = await appLogin(owner);
  const otherCookie = await appLogin(other);
  const workspace = await fetch(origin + "/workspace", {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(45000),
  });
  const workspaceHtml = await workspace.text();
  assert.equal(workspace.status, 200);
  assert.ok(workspaceHtml.includes(report.analysisId));
  for (let visit = 0; visit < 2; visit++) {
    const reopened = await fetch(
      origin + "/workspace/audits/" + report.analysisId,
      { headers: { Cookie: cookie }, signal: AbortSignal.timeout(45000) },
    );
    assert.equal(reopened.status, 200);
    const html = await reopened.text();
    assert.ok(html.includes(report.summary));
    assert.ok(html.includes("Saved audit"));
  }
  const blocked = await fetch(
    origin + "/workspace/audits/" + report.analysisId,
    { headers: { Cookie: otherCookie }, signal: AbortSignal.timeout(45000) },
  );
  const blockedHtml = await blocked.text();
  assert.ok(
    blocked.status === 404 || blockedHtml.includes("Report unavailable"),
  );
  assert.ok(!blockedHtml.includes(report.summary));
  console.log(
    "Application login, history, reload and cross-account report protection passed.",
  );

  for (const account of accounts) {
    const client = createClient(url, key, options);
    clients.push(client);
    assert.ifError(
      (
        await client.auth.signInWithPassword({
          email: account.email,
          password: account.password,
        })
      ).error,
    );
    const rows = await client.from("audit_reports").select("id");
    assert.ifError(rows.error);
    assert.equal(rows.data.length, account.id === owner.id ? 1 : 0);
    const denied = await client
      .from("audit_reports")
      .insert({ id: randomUUID(), owner_id: account.id });
    assert.ok(
      denied.error,
      "Authenticated browser unexpectedly created a report.",
    );
  }
  const rejectedDelete = await fetch(
    origin + "/api/reports/" + report.analysisId,
    {
      method: "DELETE",
      headers: { Cookie: otherCookie, Origin: origin },
      signal: AbortSignal.timeout(15000),
    },
  );
  assert.equal(rejectedDelete.status, 200);
  const retained = await clients[0]
    .from("audit_reports")
    .select("id")
    .eq("id", report.analysisId);
  assert.equal(retained.data?.length, 1);
  const deleted = await fetch(origin + "/api/reports/" + report.analysisId, {
    method: "DELETE",
    headers: { Cookie: cookie, Origin: origin },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(deleted.status, 200);
  assert.equal(
    (await clients[0].from("audit_reports").select("id")).data?.length,
    0,
  );
  const signedOut = await fetch(origin + "/api/auth/logout", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(signedOut.status, 200);
  console.log(
    "Data API RLS, browser-insert rejection, owner deletion and logout passed.",
  );
} finally {
  for (const client of clients) await client.auth.signOut();
  for (const account of accounts) {
    const result = await admin.auth.admin.deleteUser(account.id);
    if (result.error)
      throw new Error(
        "Could not clean up a verification account. Check the development project.",
      );
  }
  console.log("Verification accounts and reports removed.");
}
