import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeReturnPath } from "@/lib/auth";

const emailSchema = z.email().max(254);
const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function authResponse(
  request: Request,
  action: string,
  createClient: () => Promise<SupabaseClient>,
) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (request.headers.get("origin") !== origin)
    return reply(
      { error: "Open this form in SiteAudit AI and try again." },
      403,
    );
  if (
    !["signup", "login", "forgot", "resend", "reset", "logout"].includes(action)
  )
    return reply({ error: "Action unavailable." }, 404);
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply({ error: "Check the form and try again." }, 400);
    const client = await createClient();
    if (action === "logout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      return error
        ? reply({ error: "We couldn’t log you out. Please retry." }, 503)
        : reply({ redirect: "/" });
    }
    const email = emailSchema.safeParse(typeof body.email === "string" ? body.email.trim() : undefined);
    if (action !== "reset" && !email.success)
      return reply(
        { error: "Enter a valid email address.", field: "email" },
        400,
      );
    if (
      ["signup", "login", "reset"].includes(action) &&
      (typeof body.password !== "string" ||
        !body.password ||
        body.password.length > 512)
    ) {
      return reply({ error: "Enter your password.", field: "password" }, 400);
    }
    const callback = `${origin}/auth/confirm`;
    let error;
    if (action === "signup") {
      const result = await client.auth.signUp({
        email: email.data!,
        password: body.password,
        options: { emailRedirectTo: callback },
      });
      error = result.error;
      if (!error)
        return reply(
          result.data.session
            ? { redirect: "/workspace" }
            : {
                message:
                  "Check your email to continue. If this address is eligible, a confirmation link will arrive shortly.",
                confirmation: true,
              },
        );
    } else if (action === "login") {
      const result = await client.auth.signInWithPassword({
        email: email.data!,
        password: body.password,
      });
      error = result.error;
      if (!error) return reply({ redirect: safeReturnPath(body.next) });
    } else if (action === "forgot") {
      const result = await client.auth.resetPasswordForEmail(email.data!, {
        redirectTo: `${callback}?flow=recovery`,
      });
      error = result.error;
      if (!error)
        return reply({
          message:
            "If this email can receive a recovery link, you’ll find it in your inbox shortly.",
        });
    } else if (action === "resend") {
      const result = await client.auth.resend({
        type: "signup",
        email: email.data!,
        options: { emailRedirectTo: callback },
      });
      error = result.error;
      if (!error)
        return reply({
          message:
            "If this address needs confirmation, a new link will arrive shortly.",
        });
    } else if (action === "reset") {
      const { data } = await client.auth.getUser();
      if (!data.user)
        return reply(
          {
            error: "Open a fresh recovery link to set your password.",
            expired: true,
          },
          401,
        );
      const result = await client.auth.updateUser({ password: body.password });
      error = result.error;
      if (!error)
        return reply({
          message: "Password updated. You can continue to your workspace.",
          updated: true,
        });
    }
    if (error?.status === 429 || error?.code === "over_email_send_rate_limit")
      return reply({ error: "Please wait a minute before trying again." }, 429);
    if (error?.code === "weak_password")
      return reply({ error: error.message, field: "password" }, 400);
    if (error?.code === "email_not_confirmed")
      return reply(
        {
          error:
            "Confirm your email before signing in. You can request a new link below.",
          confirmation: true,
        },
        400,
      );
    if (action === "login" && error?.code === "invalid_credentials")
      return reply(
        { error: "Check your email and password, then try again." },
        400,
      );
    return reply(
      {
        error:
          "We couldn’t complete this request. Please retry shortly. Email delivery may be unavailable.",
      },
      503,
    );
  } catch {
    return reply(
      {
        error:
          "We couldn’t complete this request. Check your connection and try again.",
      },
      503,
    );
  }
}
