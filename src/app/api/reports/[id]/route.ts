import { z } from "zod";
import { currentAccount, workspaceAccess } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/server/request-origin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await workspaceAccess(request);
  if (denied) return denied;
  if (!isSameOrigin(request))
    return Response.json(
      { error: "Open this action in your workspace." },
      { status: 403 },
    );
  const { id } = await params;
  const account = await currentAccount();
  if (!account || !z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const client = await createClient();
  const { error } = await client
    .from("audit_reports")
    .delete()
    .eq("id", id)
    .eq("owner_id", account.id);
  return Response.json(
    error ? { error: "Couldn’t delete this report." } : { deleted: true },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
