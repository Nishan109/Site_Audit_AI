import { mkdirSync, writeFileSync } from "node:fs";
import { analyzeWebsite } from "../src/lib/server/audit";

process.loadEnvFile(".env.local");
mkdirSync(".next/verification", { recursive: true });
const urls = process.argv.slice(2);
for (const url of urls) {
  const start = Date.now();
  try {
    const report = await analyzeWebsite(url, AbortSignal.timeout(160_000));
    const domain = new URL(report.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    writeFileSync(`.next/verification/${domain}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ url, seconds: Math.round((Date.now()-start)/1000), dataSource:report.dataSource,model:report.modelUsed,pages:report.pagesAnalyzed?.length,scores:report.scores,headlines:report.messaging.map(issue=>issue.title),seo:report.seo.map(issue=>issue.title),research:report.agentSteps.find(step=>step.name==="Research Agent")?.status }));
  } catch(error) {
    const failure=error as {code?:string;message?:string};
    console.log(JSON.stringify({url,error:failure.code||"FAILED",message:failure.message,seconds:Math.round((Date.now()-start)/1000)}));
    process.exitCode=1;
  }
}
