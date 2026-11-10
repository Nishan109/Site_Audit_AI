import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { normalizeUrl, isPublicAddress } from "../src/lib/server/url";
import { extractEvidence, assertEvidence, consistentWithFacts, evidenceCatalog, uniqueFindings } from "../src/lib/server/evidence";
import { generateContent, generateJson, getClient } from "../src/lib/server/gemini";
import { errorResponse, readBody } from "../src/lib/server/errors";
import { parsePageSpeed } from "../src/lib/pagespeed-measurement";
import { parseCreativeImage } from "../src/lib/server/creative";
import { scoreSchema } from "../src/lib/server/schemas";

test("URL normalization preserves distinct public sites and rejects unsafe targets", () => {
  assert.equal(normalizeUrl("stripe.com"), "https://stripe.com/");
  assert.equal(normalizeUrl("https://speedtest.net"), "https://speedtest.net/");
  for (const url of ["not a URL", "file:///etc/passwd", "javascript:alert(1)", "http://localhost:3000", "http://127.1", "http://0x7f000001", "http://10.0.0.1", "http://[::1]", "https://user:password@example.com", "http://169.254.169.254/"]) assert.throws(() => normalizeUrl(url));
  assert.equal(isPublicAddress("192.168.1.2"), false);
  assert.equal(isPublicAddress("::ffff:127.0.0.1"), false);
  assert.equal(isPublicAddress("1.1.1.1"), true);
});

const bakery = extractEvidence(`<html><head><title>Acorn Bakery</title><meta name="description" content="Fresh sourdough baked in Bath"><script type="application/ld+json">{"@graph":[{"@type":"Bakery"}]}</script></head><body><h1>Order fresh sourdough</h1><h3>Our bread</h3><img src="bread.jpg"><form><label for="email">Email</label><input id="email"><button>Order a loaf</button></form></body></html>`, "https://bakery.example/", false);
const software = extractEvidence(`<html><head><title>Orbital Software</title></head><body><h1>Deploy your application</h1><p>Cloud tools for developers</p><img src="cloud.png" alt=""><button aria-label="Start trial"></button></body></html>`, "https://software.example/", true);

test("page evidence comes from actual content and hashes differ between websites", () => {
  assert.match(bakery.content, /Fresh sourdough baked in Bath/);
  assert.match(software.content, /Cloud tools for developers/);
  assert.equal(bakery.facts.missingAlt, 1);
  assert.equal(software.facts.missingAlt, 0);
  assert.equal(bakery.facts.headingsOrdered, false);
  assert.equal(bakery.facts.unnamedControls, 0);
  assert.deepEqual(bakery.schemaTypes, ["Bakery"]);
  assert.notEqual(bakery.contentHash, software.contentHash);
  assert.equal(bakery.contentHash.length, 64);
});

test("invented findings and evidence copied from another website are rejected", () => {
  assert.doesNotThrow(() => assertEvidence([{ pageUrl: bakery.url, evidence: "Order fresh sourdough" }], [bakery]));
  assert.throws(() => assertEvidence([{ pageUrl: software.url, evidence: "Order fresh sourdough" }], [software]));
  assert.throws(() => assertEvidence([{ pageUrl: bakery.url, evidence: "Heavy tracking scripts block rendering" }], [bakery]));
});

test("citations resolve to original content and cannot contradict measured HTML facts", () => {
  const entry=evidenceCatalog([software])[0];
  const finding={pageUrl:software.url,evidence:entry.id};
  assertEvidence([finding],[software]);
  assert.equal(finding.evidence,entry.quote);
  assert.equal(consistentWithFacts({pageUrl:software.url,action:"Add descriptive alt text to images"},[software]),false);
  assert.equal(consistentWithFacts({pageUrl:software.url,title:"Duplicate H1 tags"},[software]),false);
  assert.equal(consistentWithFacts({pageUrl:software.url,title:"Missing CSP header"},[software]),false);
  assert.equal(consistentWithFacts({pageUrl:bakery.url,title:"Images missing alt attributes"},[bakery]),true);
});

test("the summary does not repeat the same issue returned by multiple specialists", () => {
  const first={pageUrl:software.url,evidence:"Canonical: missing",title:"Missing canonical tag"};
  const duplicate={...first,title:"No canonical URL declared"};
  const distinct={pageUrl:software.url,evidence:"Deploy your application",title:"Clarify the deployment benefit"};
  assert.deepEqual(uniqueFindings([first,duplicate,distinct]),[first,distinct]);
});

test("malformed JSON is a controlled client error", async () => {
  await assert.rejects(async () => readBody(new Request("https://app.example/api/analyze", { method: "POST", body: "broken" })), error => {
    assert.equal(errorResponse(error).status, 400); return true;
  });
});

test("PageSpeed never converts TBT or a missing measurement into INP", () => {
  const report = parsePageSpeed({ lighthouseResult: { audits: { "total-blocking-time": { numericValue: 123 } }, categories: { performance: { score: 0.8 } } } });
  assert.equal(report.inp.value, null);
  assert.equal(report.inp.rating, "unavailable");
  assert.equal(report.lcp.value, null);
  assert.equal(report.isSimulated, false);
  assert.equal(report.performanceScore, 80);
  assert.equal(parsePageSpeed({ loadingExperience: { metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 245 } } } }).inp.value, 245);
});

test("creative comparison rejects missing, forged and oversized image data", () => {
  assert.throws(() => parseCreativeImage(null));
  assert.throws(() => parseCreativeImage("data:image/png;base64,SGVsbG8="));
  assert.throws(() => parseCreativeImage("data:image/svg+xml;base64,AAAA"));
  assert.throws(() => parseCreativeImage(`data:image/png;base64,${"A".repeat(7_000_001)}`));
});

const prototype = Object.getPrototypeOf(new GoogleGenAI({ apiKey: "test-only" }).models);
test("provider failures cannot return a synthetic success report", async t => {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  const mocked = t.mock.method(prototype, "generateContentInternal", async () => { throw Object.assign(new Error("quota"), { status: 429 }); });
  try {
    await assert.rejects(() => generateContent([{ text: "test" }]), error => { assert.equal(errorResponse(error).status, 429); return true; });
    assert.equal(mocked.mock.callCount(), 4);
  } finally { if (original === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = original; }
});

test("invalid AI JSON is rejected by the runtime schema", async t => {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  t.mock.method(prototype, "generateContentInternal", async () => ({ text: '{"score":150}', modelVersion: "test-model" }));
  try { await assert.rejects(() => generateJson("test", z.object({ score: scoreSchema })), z.ZodError); }
  finally { if (original === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = original; }
});

test("a temporary upstream model failure tries another model", async t => {
  const original=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY="test-only";
  let attempts=0;
  t.mock.method(prototype,"generateContentInternal",async()=>{
    attempts++;
    if(attempts===1) throw Object.assign(new Error("Temporary upstream error"),{status:500});
    return {text:"Research summary",modelVersion:"available-model"};
  });
  try {
    const result=await generateContent([{text:"Research test"}]);
    assert.equal(attempts,2);assert.equal(result.modelUsed,"available-model");
  } finally { if(original===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=original; }
});

test("missing API configuration produces an explicit failure", () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try { assert.throws(() => getClient(), error => { assert.equal(errorResponse(error).status, 503); return true; }); }
  finally { if (original !== undefined) process.env.GEMINI_API_KEY = original; }
});
