import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerateContentResponse } from "@google/genai";
import { parseSearchResults, searchWeb } from "../src/lib/server/web-search";
import { researchWebsite } from "../src/lib/server/research";
import { extractEvidence } from "../src/lib/server/evidence";
import { AuditError } from "../src/lib/server/errors";

const rss=`<rss><channel><item><title>Real encyclopedia alternatives</title><link>https://review.example/encyclopedias</link><description><![CDATA[Britannica is an encyclopedia alternative.]]></description></item></channel></rss>`;
const html=`<html><body><div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freview.example%2Fencyclopedias">Real encyclopedia alternatives</a><div class="result__snippet">Compare editorial encyclopedias.</div></div><div class="result"><a class="result__a" href="javascript:alert(1)">Invalid</a></div></body></html>`;

test("direct search parses actual result URLs and snippets, excluding unsafe links",()=>{
  const results=parseSearchResults(html,"DuckDuckGo");
  assert.equal(results.length,1);
  assert.equal(results[0].url,"https://review.example/encyclopedias");
  assert.equal(results[0].snippet,"Compare editorial encyclopedias.");
  assert.equal(parseSearchResults(rss,"Bing RSS")[0].url,results[0].url);
  assert.deepEqual(parseSearchResults("<html>Search challenge</html>","DuckDuckGo"),[]);
});

test("a blocked search endpoint can use a second real search provider",async()=>{
  const requested:string[]=[];
  const result=await searchWeb("encyclopedia alternatives",new AbortController().signal,async input=>{
    const url=String(input);requested.push(url);
    return url.includes("duckduckgo")?new Response("Challenge",{status:202}):new Response(rss,{status:200});
  });
  assert.equal(result.provider,"Bing RSS");
  assert.equal(result.results.length,1);
  assert.equal(requested.length,2);
  assert.ok(requested.every(url=>new URL(url).searchParams.get("q")==="encyclopedia alternatives"));
});

const company=extractEvidence("<html><head><title>Reference</title></head><body><h1>Find knowledge</h1><p>A public encyclopedia.</p></body></html>","https://reference.example/",true);
const comparison=extractEvidence("<html><body><h1>Encyclopedia alternatives</h1><p>Britannica publishes edited reference articles.</p><a href='https://www.britannica.com/'>Britannica</a></body></html>","https://review.example/encyclopedias",true);
function generated(text:string){const response=new GenerateContentResponse();response.candidates=[{content:{role:"model",parts:[{text}]}}];return {response,modelUsed:"test-model"};}

test("exhausted grounding quota falls back to live retrieval and ordinary AI synthesis",async()=>{
  let grounded=0,synthesized=0;
  const result=await researchWebsite(company.url,new AbortController().signal,[company],{
    generate:async(parts,config)=>{
      if(config?.tools){grounded++;throw new AuditError("Grounded-search quota reached",429,"AI_RATE_LIMIT");}
      synthesized++;
      assert.match(parts[0].text||"",/Britannica publishes edited reference articles/);
      return generated("Britannica is an editorial alternative. Source: https://review.example/encyclopedias");
    },
    search:async query=>({provider:"DuckDuckGo",query,results:parseSearchResults(html,"DuckDuckGo")}),
    readPage:async()=>comparison,
  });
  assert.equal(result.provider,"DuckDuckGo");
  assert.equal(grounded,1);assert.equal(synthesized,1);
  assert.deepEqual(result.sources,[comparison.url]);
  assert.ok(result.discoveredUrls.includes("https://www.britannica.com/"));
  assert.equal(result.searchQueries.length,1);
  assert.ok(!result.sourceEvidence.includes("test-model"));
});

test("a response with only URL reading metadata does not pretend that web search ran",async()=>{
  let searched=false;
  const result=await researchWebsite(company.url,new AbortController().signal,[company],{
    generate:async(_parts,config)=>{
      const result=generated(config?.tools?"Company page only":"Actual search summary");
      if(config?.tools) result.response.candidates![0].urlContextMetadata={urlMetadata:[{retrievedUrl:company.url,urlRetrievalStatus:"URL_RETRIEVAL_STATUS_SUCCESS" as never}]};
      return result;
    },
    search:async query=>{searched=true;return {provider:"Bing RSS",query,results:parseSearchResults(rss,"Bing RSS")};},
    readPage:async()=>comparison,
  });
  assert.equal(searched,true);assert.equal(result.provider,"Bing RSS");
});

test("when all search providers fail, research remains unavailable instead of fabricating success",async()=>{
  await assert.rejects(()=>researchWebsite(company.url,new AbortController().signal,[company],{
    generate:async()=>{throw new AuditError("Quota reached",429,"AI_RATE_LIMIT");},
    search:async()=>{throw new AuditError("No usable sources",503,"RESEARCH_UNAVAILABLE");},
    readPage:async()=>comparison,
  }),error=>error instanceof AuditError && error.code==="RESEARCH_UNAVAILABLE");
});
