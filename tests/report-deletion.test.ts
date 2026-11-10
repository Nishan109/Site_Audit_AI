import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportDeletionResponse } from "../src/lib/server/report-deletion";

const id = "92893258-eebc-42ae-a893-05120bbb25ce";
const owner = { id: "fixture-owner", email: "owner@example.com" };
const origin = "https://site-audit-ai-lemon.vercel.app";
function request(from: string | null = origin) {
  return new Request(`${origin}/api/reports/${id}`, {
    method: "DELETE",
    headers: from === null ? {} : { origin: from },
  });
}
function fixture(result: { data: unknown; error: unknown }, fail = false) {
  const calls: unknown[] = [];
  const query = {
    delete() { calls.push("delete"); return query; },
    eq(field: string, value: string) { calls.push([field, value]); return query; },
    select(fields: string) { calls.push(["select", fields]); return query; },
    async maybeSingle() {
      if (fail) throw new Error("Test-only provider failure");
      return result;
    },
  };
  const client = { from(table: string) { calls.push(table); return query; } } as unknown as SupabaseClient;
  return { client, calls };
}

test("deletion confirms the returned row and scopes the query to the verified owner", async () => {
  const { client, calls } = fixture({ data: { id }, error: null });
  const response = await reportDeletionResponse(request(), id, async () => owner, async () => client);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(calls, ["audit_reports", "delete", ["id", id], ["owner_id", owner.id], ["select", "id"]]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("missing or inaccessible rows never return a false deletion confirmation", async () => {
  for (const data of [null, { id: "another-report" }]) {
    const { client } = fixture({ data, error: null });
    const response = await reportDeletionResponse(request(), id, async () => owner, async () => client);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "REPORT_NOT_FOUND");
  }
});

test("foreign and absent origins are rejected before session or database work", async () => {
  for (const from of ["https://attacker.example", null]) {
    const response = await reportDeletionResponse(request(from), id,
      async () => { throw new Error("Session must not be read"); },
      async () => { throw new Error("Database must not be reached"); });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "ORIGIN_MISMATCH");
  }
});

test("signed-out users and malformed report IDs cannot reach the deletion query", async () => {
  const factory = async (): Promise<SupabaseClient> => { throw new Error("Database must not be reached"); };
  const signedOut = await reportDeletionResponse(request(), id, async () => null, factory);
  assert.equal(signedOut.status, 401);
  assert.equal((await signedOut.json()).code, "AUTH_REQUIRED");
  const malformed = await reportDeletionResponse(request(), "invalid-id", async () => owner, factory);
  assert.equal(malformed.status, 404);
});

test("database and transport failures retain an actionable error without exposing database details", async () => {
  for (const fail of [false, true]) {
    const { client } = fixture({ data: null, error: { message: "Test-only database internals" } }, fail);
    const response = await reportDeletionResponse(request(), id, async () => owner, async () => client);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.code, "DELETE_UNAVAILABLE");
    assert.doesNotMatch(data.error, /Test-only/);
  }
});
