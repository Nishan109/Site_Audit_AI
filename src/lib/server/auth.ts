import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import type { Account } from "../auth";

export async function currentAccount(): Promise<Account | null> {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub || !data.claims.email) return null;
  return { id: data.claims.sub, email: String(data.claims.email) };
}

export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}

export async function workspaceAccess(
  request: Request,
): Promise<Response | null> {
  // Reject requests without any session before touching providers or cookie APIs.
  if (!/sb-[^=;]+-auth-token/.test(request.headers.get("cookie") || ""))
    return unauthorized();
  try {
    if (await currentAccount()) return null;
    return unauthorized();
  } catch {
    return Response.json(
      {
        error: "Account verification is temporarily unavailable. Please retry.",
        code: "AUTH_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function unauthorized() {
  return Response.json(
    { error: "Log in to continue your website review.", code: "AUTH_REQUIRED" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
