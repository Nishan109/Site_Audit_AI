import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { refreshAccessibilityChecks } from "../src/lib/server/accessibility-refresh";

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error(
    "Supply public URLs for a read-only HTML accessibility review.",
  );
  process.exitCode = 1;
}
mkdirSync(".next/verification", { recursive: true });
for (const url of urls) {
  try {
    const result = await refreshAccessibilityChecks(
      url,
      AbortSignal.timeout(60_000),
    );
    const hash = createHash("sha256")
      .update(result.url)
      .digest("hex")
      .slice(0, 8);
    const output = `.next/verification/${new URL(result.url).hostname}-${hash}-accessibility.json`;
    writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(
      JSON.stringify({
        url: result.url,
        scope: result.audit.review.scope,
        pages: result.audit.review.pages.map((page) => ({
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
            : "Accessibility evidence unavailable",
      }),
    );
    process.exitCode = 1;
  }
}
