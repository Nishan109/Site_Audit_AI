import { currentAccount } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { reportDeletionResponse } from "@/lib/server/report-deletion";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return reportDeletionResponse(request, id, currentAccount, createClient);
}
