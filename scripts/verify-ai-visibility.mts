import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { collectEvidence } from "../src/lib/server/evidence";
import { reviewAIVisibility } from "../src/lib/server/ai-visibility";

process.loadEnvFile(".env.local");
const urls = process.argv.slice(2);
if (!urls.length) {
  console.error(
    "Supply one or more public URLs for a real-provider AI content-readiness review.",
  );
  process.exitCode = 1;
}
mkdirSync(".next/verification", { recursive: true });
for (const url of urls) {
  const started = Date.now();
  try {
    const signal = AbortSignal.timeout(150_000);
    const evidence = await collectEvidence(url, signal);
    const result = await reviewAIVisibility(evidence.pages, signal);
    const domain = new URL(evidence.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const hash = createHash("sha256")
      .update(evidence.url)
      .digest("hex")
      .slice(0, 8);
    const output = `.next/verification/${domain}-${hash}-ai-visibility.json`;
    writeFileSync(
      output,
      JSON.stringify({ url: evidence.url, ...result }, null, 2),
    );
    console.log(
      JSON.stringify({
        url: evidence.url,
        seconds: Math.round((Date.now() - started) / 1000),
        score: result.analysis.overallScore,
        summary: result.analysis.review?.summary,
        issues: result.analysis.issues.map((issue) => issue.title),
        verification: result.analysis.review?.verification,
        validation: result.analysis.review?.assessmentValidation,
        output,
      }),
    );
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    console.log(
      JSON.stringify({
        url,
        error: failure.code || "FAILED",
        message: failure.message,
      }),
    );
    process.exitCode = 1;
  }
}
