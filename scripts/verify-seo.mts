import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { collectEvidence } from "../src/lib/server/evidence";
import { reviewSEO } from "../src/lib/server/seo";
process.loadEnvFile(".env.local");
if (!process.argv.slice(2).length) { console.error("Supply one or more public URLs for a real-provider on-page SEO review."); process.exitCode = 1; }
mkdirSync(".next/verification", { recursive: true });
for (const url of process.argv.slice(2)) {
  const started = Date.now();
  try {
    const signal = AbortSignal.timeout(150_000), evidence = await collectEvidence(url, signal);
    const result = await reviewSEO(evidence.pages, signal);
    const domain = new URL(evidence.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    const hash = createHash("sha256").update(evidence.url).digest("hex").slice(0, 8);
    const output = `.next/verification/${domain}-${hash}-seo.json`;
    writeFileSync(output, JSON.stringify({ url: evidence.url, ...result }, null, 2));
    console.log(JSON.stringify({ url: evidence.url, seconds: Math.round((Date.now() - started) / 1000), score: result.data.score, issues: result.data.issues.map((item) => item.title), criteria: result.analysis.criteria.map((item) => ({ key: item.key, score: item.score })), scope: result.analysis.scope, verification: result.analysis.verification, model: result.modelUsed, output }));
  } catch (error) { const failure = error as { code?: string; message?: string }; console.log(JSON.stringify({ url, error: failure.code || "FAILED", message: failure.message, seconds: Math.round((Date.now() - started) / 1000) })); process.exitCode = 1; }
}
