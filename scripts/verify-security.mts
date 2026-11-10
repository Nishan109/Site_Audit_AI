import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { collectEvidence } from "../src/lib/server/evidence";
import { buildSecurityAudit } from "../src/lib/server/security";

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error(
    "Supply public URLs for a read-only header and HTML security review.",
  );
  process.exitCode = 1;
}
mkdirSync(".next/verification", { recursive: true });
for (const url of urls) {
  try {
    const evidence = await collectEvidence(url, AbortSignal.timeout(60_000));
    const audit = buildSecurityAudit(evidence.pages);
    const hash = createHash("sha256")
      .update(evidence.url)
      .digest("hex")
      .slice(0, 8);
    const output = `.next/verification/${new URL(evidence.url).hostname}-${hash}-security.json`;
    writeFileSync(
      output,
      JSON.stringify({ url: evidence.url, audit }, null, 2),
    );
    console.log(
      JSON.stringify({
        url: evidence.url,
        scope: audit.review?.scope,
        pages: audit.review?.pages.map((page) => ({
          url: page.url,
          checks: page.checks.map((check) => ({
            key: check.key,
            status: check.status,
          })),
        })),
        output,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        url,
        error:
          error instanceof Error
            ? error.message
            : "Security evidence unavailable",
      }),
    );
    process.exitCode = 1;
  }
}
