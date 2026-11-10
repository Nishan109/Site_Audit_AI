import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "../auth";
import { isSameOrigin } from "./request-origin";

const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function reportDeletionResponse(
  request: Request,
  id: string,
  currentAccount: () => Promise<Account | null>,
  createClient: () => Promise<SupabaseClient>,
): Promise<Response> {
  if (!isSameOrigin(request))
    return reply(
      { error: "Refresh your workspace and try deleting this report again.", code: "ORIGIN_MISMATCH" },
      403,
    );
  if (!z.uuid().safeParse(id).success)
    return reply(
      { error: "This report is unavailable. Refresh your audit history.", code: "REPORT_NOT_FOUND" },
      404,
    );
  try {
    const account = await currentAccount();
    if (!account)
      return reply(
        { error: "Please log in again before deleting this report.", code: "AUTH_REQUIRED" },
        401,
      );
    const client = await createClient();
    const { data, error } = await client
      .from("audit_reports")
      .delete()
      .eq("id", id)
      .eq("owner_id", account.id)
      .select("id")
      .maybeSingle();
    if (error)
      return reply(
        { error: "We couldn’t delete this report. Please try again in a moment.", code: "DELETE_UNAVAILABLE" },
        503,
      );
    if (!data || data.id !== id)
      return reply(
        { error: "This report is unavailable in your account. Refresh your audit history.", code: "REPORT_NOT_FOUND" },
        404,
      );
    return reply({ deleted: true });
  } catch {
    return reply(
      { error: "The deletion couldn’t be confirmed. Refresh your history before trying again.", code: "DELETE_UNAVAILABLE" },
      503,
    );
  }
}
