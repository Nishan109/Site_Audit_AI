import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authResponse } from "../src/lib/server/auth-response";
import { workspaceAccess } from "../src/lib/server/auth";
import { savedReport, containsSensitiveUrl } from "../src/lib/saved-reports";
import { safeReturnPath } from "../src/lib/auth";
import { auditResponse } from "../src/lib/server/audit-stream";
import { readReviewResponse } from "../src/lib/review-response";
import { REVIEW_STREAM } from "../src/lib/review-progress";
import { dashboardFixture } from "./dashboard-fixtures";

const id = "92893258-eebc-42ae-a893-05120bbb25ce";
const request = (body: object, origin = "http://app.example") =>
  new Request("http://app.example/api/auth/signup", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("authentication rejects a foreign origin before accessing Supabase", async () => {
  const response = await authResponse(
    request(
      { email: "a@example.com", password: "password" },
      "https://attacker.example",
    ),
    "signup",
    async () => {
      throw new Error("Must not be reached");
    },
  );
  assert.equal(response.status, 403);
  assert.equal(safeReturnPath("//attacker.example"), "/workspace");
  assert.equal(
    safeReturnPath("/workspace?next=https://attacker.example"),
    "/workspace",
  );
});

test("signup and recovery create exact callbacks without the audited URL", async () => {
  let payload: unknown;
  const client = {
    auth: {
      signUp: async (value: unknown) => {
        payload = value;
        return { data: { session: null }, error: null };
      },
      resetPasswordForEmail: async (_email: string, value: unknown) => {
        payload = value;
        return { error: null };
      },
    },
  } as unknown as SupabaseClient;
  const response = await authResponse(
    request({ email: "owner@example.com", password: "long-password" }),
    "signup",
    async () => client,
  );
  assert.equal((await response.json()).confirmation, true);
  assert.deepEqual(payload, {
    email: "owner@example.com",
    password: "long-password",
    options: { emailRedirectTo: "http://app.example/auth/confirm" },
  });
  await authResponse(
    request({ email: "owner@example.com" }),
    "forgot",
    async () => client,
  );
  assert.deepEqual(payload, {
    redirectTo: "http://app.example/auth/confirm?flow=recovery",
  });
});

test("password reset validates the user before updating a credential", async () => {
  let called = false;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      updateUser: async () => {
        called = true;
      },
    },
  } as unknown as SupabaseClient;
  const response = await authResponse(
    request({ password: "a-new-password" }),
    "reset",
    async () => client,
  );
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("login errors remain actionable and email throttling is identified", async () => {
  const client = {
    auth: {
      signInWithPassword: async () => ({
        error: { code: "invalid_credentials" },
      }),
    },
  } as unknown as SupabaseClient;
  const response = await authResponse(
    request({ email: "a@example.com", password: "wrong" }),
    "login",
    async () => client,
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /email and password/);
  const rateLimited = {
    auth: { resend: async () => ({ error: { status: 429 } }) },
  } as unknown as SupabaseClient;
  assert.equal(
    (
      await authResponse(
        request({ email: "a@example.com" }),
        "resend",
        async () => rateLimited,
      )
    ).status,
    429,
  );
});

test("signed-out workspace actions fail before provider work", async () => {
  const denied = await workspaceAccess(
    new Request("http://app.example/api/analyze", { method: "POST" }),
  );
  assert.equal(denied?.status, 401);
  assert.equal((await denied!.json()).code, "AUTH_REQUIRED");
});

test("saved snapshots retain zero scores and reject wrong identity, versions and damaged payloads", () => {
  const report = {
    ...dashboardFixture(),
    analysisId: id,
    scores: { Messaging: 0, UX: null, SEO: 0, Conversion: null },
  };
  assert.equal(savedReport(report, 1, id)?.scores.Messaging, 0);
  assert.equal(savedReport(report, 2, id), null);
  assert.equal(savedReport(report, 1, "another-id"), null);
  assert.equal(savedReport({ ...report, messaging: [{}] }, 1, id), null);
  assert.equal(
    containsSensitiveUrl({ sources: ["https://example.com/?api_key=private"] }),
    true,
  );
  assert.equal(
    containsSensitiveUrl({ sources: ["https://example.com/pricing?plan=pro"] }),
    false,
  );
});

test("both response formats complete a bounded save after the analysis deadline without dropping the report", async () => {
  for (const accept of ["application/json", REVIEW_STREAM]) {
    let saves = 0;
    const input = new Request("http://app.example/api/analyze", {
      method: "POST",
      headers: { Accept: accept },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const response = await auditResponse(
      input,
      async () => dashboardFixture(),
      20,
      async (report) => {
        saves++;
        await new Promise((resolve) => setTimeout(resolve, 35));
        return {
          ...report,
          storage: {
            status: "unavailable",
            reason: "Save timed out. Export is available.",
          },
        };
      },
    );
    const report = await readReviewResponse(
      response,
      new AbortController().signal,
      () => {},
    );
    assert.equal(saves, 1);
    assert.equal(report.storage?.status, "unavailable");
    assert.equal(report.summary, dashboardFixture().summary);
  }
});
