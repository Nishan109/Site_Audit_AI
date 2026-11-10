import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const type = url.searchParams.get("type");
  const token = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const client = await createClient();
  let destination = "/login?notice=expired";
  try {
    if (
      token &&
      (type === "email" || type === "signup" || type === "recovery")
    ) {
      const { error } = await client.auth.verifyOtp({
        token_hash: token,
        type,
      });
      if (!error)
        destination = type === "recovery" ? "/reset-password" : "/workspace";
    } else if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        destination =
          url.searchParams.get("flow") === "recovery"
            ? "/reset-password"
            : "/workspace";
    }
  } catch {
    /* Expired and invalid links share one recovery route. */
  }
  const response = NextResponse.redirect(new URL(destination, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
