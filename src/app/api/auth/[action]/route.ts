import { authResponse } from "@/lib/server/auth-response";
import { createClient } from "@/lib/supabase/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return authResponse(request, (await params).action, createClient);
}
