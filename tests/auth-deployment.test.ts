import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authResponse } from "../src/lib/server/auth-response";
import { GET as confirm } from "../src/app/auth/confirm/route";
import { isSameOrigin, requestOrigin } from "../src/lib/server/request-origin";

const deployment = "https://site-audit-ai-lemon.vercel.app";

test("local Next.js URL normalization respects the actual loopback authority and exact port", () => {
  const local = (host: string, origin: string) => new Request("http://localhost:3001/api/auth/login", {
    headers: { host, origin, "x-forwarded-host": "attacker.example" },
  });
  const ip = local("127.0.0.1:3001", "http://127.0.0.1:3001");
  assert.equal(requestOrigin(ip), "http://127.0.0.1:3001");
  assert.equal(isSameOrigin(ip), true);
  assert.equal(isSameOrigin(local("[::1]:3001", "http://[::1]:3001")), true);
  assert.equal(isSameOrigin(local("127.0.0.1:3002", "http://127.0.0.1:3002")), false);
  assert.equal(isSameOrigin(local("attacker.example", "http://attacker.example")), false);
  assert.equal(isSameOrigin(local("127.0.0.1:3001/path", "http://127.0.0.1:3001")), false);
  assert.equal(isSameOrigin(new Request(`${deployment}/api/auth/login`, {
    headers: { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
  })), false);
});

test("same-origin login works on production, previews and local hosts with a stale app URL", async (t) => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
  const client = {
    auth: { signInWithPassword: async () => ({ error: null }) },
  } as unknown as SupabaseClient;
  for (const configured of [
    "http://127.0.0.1:3001",
    "https://old-app.example/",
    "invalid-setting",
  ]) {
    process.env.NEXT_PUBLIC_APP_URL = configured;
    for (const origin of [
      deployment,
      "https://site-audit-ai-preview.example",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ]) {
      const response = await authResponse(
        new Request(`${origin}/api/auth/login`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ email: "owner@example.com", password: "test-password" }),
        }),
        "login",
        async () => client,
      );
      assert.equal(response.status, 200, `${origin} with ${configured}`);
      assert.deepEqual(await response.json(), { redirect: "/workspace" });
    }
  }
});

test("cross-origin, missing and opaque origins are rejected even when config or forwarded headers match", async (t) => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://attacker.example";
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
  let clientCalls = 0;
  for (const origin of [
    undefined,
    "null",
    "https://attacker.example",
    `${deployment}.attacker.example`,
    "http://site-audit-ai-lemon.vercel.app",
    `${deployment}:444`,
    `${deployment}/login`,
  ]) {
    const headers = new Headers({
      "content-type": "application/json",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    });
    if (origin !== undefined) headers.set("origin", origin);
    const response = await authResponse(
      new Request(`${deployment}/api/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "owner@example.com", password: "test-password" }),
      }),
      "login",
      async () => {
        clientCalls++;
        throw new Error("Foreign requests must not reach the auth client");
      },
    );
    assert.equal(response.status, 403, String(origin));
  }
  assert.equal(clientCalls, 0);
});

test("signup, resend and recovery callbacks stay on the originating deployment", async (t) => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3001";
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
  const callbacks: string[] = [];
  const client = {
    auth: {
      signUp: async (value: { options: { emailRedirectTo: string } }) => {
        callbacks.push(value.options.emailRedirectTo);
        return { data: { session: null }, error: null };
      },
      resend: async (value: { options: { emailRedirectTo: string } }) => {
        callbacks.push(value.options.emailRedirectTo);
        return { error: null };
      },
      resetPasswordForEmail: async (_email: string, value: { redirectTo: string }) => {
        callbacks.push(value.redirectTo);
        return { error: null };
      },
    },
  } as unknown as SupabaseClient;
  for (const action of ["signup", "resend", "forgot"]) {
    const response = await authResponse(
      new Request(`${deployment}/api/auth/${action}`, {
        method: "POST",
        headers: { origin: deployment, "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "test-password" }),
      }),
      action,
      async () => client,
    );
    assert.equal(response.status, 200);
  }
  assert.deepEqual(callbacks, [
    `${deployment}/auth/confirm`,
    `${deployment}/auth/confirm`,
    `${deployment}/auth/confirm?flow=recovery`,
  ]);
});

test("invalid confirmation links return to the current deployment without forwarding tokens or foreign destinations", async (t) => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3001";
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
  const response = await confirm(
    new Request(`${deployment}/auth/confirm?type=unknown&token_hash=test-only-invalid&next=https://attacker.example`, {
      headers: { "x-forwarded-host": "attacker.example" },
    }),
  );
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `${deployment}/login?notice=expired`);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
