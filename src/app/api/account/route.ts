import { currentAccount } from "@/lib/server/auth";
export async function GET() {
  const account = await currentAccount();
  return Response.json(
    account ? { id: account.id } : { error: "Log in to continue." },
    {
      status: account ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
