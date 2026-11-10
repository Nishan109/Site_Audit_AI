import { NextResponse } from "next/server";
import {
  localPageSpeedSetup,
  validPageSpeedKey,
  writeLocalPageSpeedKey,
} from "@/lib/server/pagespeed-key";

export const runtime = "nodejs";

function reply(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const host = request.headers.get("host");
  if (!localPageSpeedSetup(host))
    return reply({ error: "Local key setup is unavailable." }, 404);
  if (
    request.headers.get("origin") !== `http://${host}` ||
    request.headers.get("sec-fetch-site") !== "same-origin" ||
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return reply(
      { error: "Open key setup on this local SiteAudit page." },
      403,
    );

  const body: unknown = await request.json().catch(() => null);
  const key =
    body && typeof body === "object" && "key" in body
      ? validPageSpeedKey(body.key)
      : null;
  if (!key)
    return reply(
      { error: "Paste the API key from Google Cloud Credentials." },
      400,
    );

  try {
    await writeLocalPageSpeedKey(key);
    process.env.PAGESPEED_API_KEY = key;
    return reply({ saved: true }, 200);
  } catch {
    return reply(
      {
        error:
          "SiteAudit couldn’t save the key. Set PAGESPEED_API_KEY in .env.local and try again.",
      },
      500,
    );
  }
}
