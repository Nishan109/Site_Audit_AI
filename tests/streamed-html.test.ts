import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { createElement, Suspense } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { loadPageHTML } from "../src/lib/server/streamed-html";
import {
  extractEvidence,
  assertReadablePage,
} from "../src/lib/server/evidence";
import { extractMessagingCopy } from "../src/lib/server/messaging-evidence";
import { extractUXEvidence } from "../src/lib/server/ux-evidence";
import { extractSEOEvidence } from "../src/lib/server/seo-evidence";
import { AuditError } from "../src/lib/server/errors";

const url = "https://books.example/library";
const copy =
  "Practical cloud infrastructure guides with hands-on examples, clear chapters and implementation exercises for independent developers.";
const content = `<main><h1>Expert cloud eBooks</h1><p>${copy}</p><a href="/books/cloud">Explore the cloud guide</a><form><label for="email">Your email</label><input id="email" type="email"><button>Request a sample</button></form><p hidden>Hidden invented discount</p><p aria-hidden="true">Hidden private draft</p></main>`;
const streamed = (script = '$RC("B:0","S:0")') =>
  `<!doctype html><html><head><title>Cloud guides</title></head><body><p>Welcome to the library.</p><!--$?--><template id="B:0"></template><p>Loading placeholder</p><!--/$--><p>After the library.</p><div hidden id="S:0">${content}</div><script>${script}</script></body></html>`;

test("completed server-streamed content replaces its fallback at the declared boundary", () => {
  const result = loadPageHTML(streamed());
  assert.equal(result.boundaries, 1);
  assert.equal(result.$("main h1").text(), "Expert cloud eBooks");
  assert.equal(result.$("body").text().includes("Loading placeholder"), false);
  assert.ok(
    result.$("body").text().indexOf("Welcome") <
      result.$("body").text().indexOf("Expert cloud"),
  );
  assert.ok(
    result.$("body").text().indexOf("Expert cloud") <
      result.$("body").text().indexOf("After the library"),
  );
  assert.equal(result.$('[id="S:0"]').length, 0);
});
test("messaging, UX and SEO use the same completed content while genuinely hidden text stays excluded", () => {
  const html = streamed(),
    page = extractEvidence(html, url, true);
  assert.ok(page.messagingCopy!.blocks.some((block) => block.text === copy));
  assert.ok(page.uxSnapshot!.counts.links > 0);
  assert.equal(page.uxSnapshot!.counts.forms, 1);
  assert.ok(
    page.seoSnapshot!.headings.some(
      (heading) => heading.text === "Expert cloud eBooks",
    ),
  );
  assert.ok(extractMessagingCopy(html).blocks.length > 0);
  assert.equal(extractUXEvidence(html, url).counts.forms, 1);
  assert.ok(extractSEOEvidence(html, url).content.includes(copy));
  for (const hidden of [
    "Hidden invented discount",
    "Hidden private draft",
    "Loading placeholder",
  ]) {
    assert.equal(page.content.includes(hidden), false);
    assert.equal(JSON.stringify(page.messagingCopy).includes(hidden), false);
    assert.equal(JSON.stringify(page.uxSnapshot).includes(hidden), false);
  }
  assert.equal(
    page.contentHash,
    createHash("sha256").update(html).digest("hex"),
  );
  assert.match(page.collectionNote!, /completed server-streamed HTML/);
  assert.doesNotThrow(() => assertReadablePage(page));
});
test("literal completion text in comments, strings, functions, conditions or JSON is never treated as a completed stream", () => {
  for (const script of [
    '// $RC("B:0","S:0")',
    'const record = \'$RC("B:0","S:0")\';',
    'function later() { $RC("B:0","S:0") }',
    'if (false) $RC("B:0","S:0")',
    '$RC("B:0", "S:" + 0)',
    "$RC(boundary, segment)",
  ]) {
    const result = loadPageHTML(streamed(script));
    assert.equal(result.boundaries, 0, script);
    assert.equal(
      extractMessagingCopy(streamed(script)).blocks.some(
        (block) => block.text === copy,
      ),
      false,
      script,
    );
  }
  for (const attributes of ['type="application/json"', 'src="/runtime.js"']) {
    const html = streamed().replace("<script>", `<script ${attributes}>`);
    assert.equal(loadPageHTML(html).boundaries, 0);
  }
});
test("incomplete, ambiguous or mismatched stream markers cannot expose hidden content", () => {
  const cases = [
    streamed().replace("<!--/$-->", ""),
    streamed().replace("<!--$?-->", "<!--$-->"),
    streamed().replace('id="S:0"', 'id="S:1"'),
    streamed().replace(
      "</body>",
      '<div hidden id="S:0">Another candidate</div></body>',
    ),
    streamed().replace(
      '<div hidden id="S:0">',
      '<div hidden aria-hidden="true" id="S:0">',
    ),
    streamed()
      .replace("<body>", '<body><script>$RC("B:0","S:0")</script>')
      .replace('<script>$RC("B:0","S:0")</script></body>', "</body>"),
  ];
  for (const html of cases) {
    assert.equal(loadPageHTML(html).boundaries, 0);
    assert.equal(
      extractMessagingCopy(html).blocks.some((block) => block.text === copy),
      false,
    );
  }
});
test("nested and prefixed boundaries keep their actual content order and remove fallback subtrees", () => {
  const html =
    '<body><!--$?--><template id="app-B:0"></template><p>Outer fallback</p><!--$?--><template id="unused"></template><p>Nested fallback</p><!--/$--><!--/$--><div hidden id="app-S:0"><main><h1>Library</h1><!--$?--><template id="app-B:1"></template><p>Inner loading</p><!--/$--></main></div><script>$RC("app-B:0","app-S:0")</script><div hidden id="app-S:1"><p>Available guides</p></div><script>$RC("app-B:1","app-S:1")</script></body>';
  const result = loadPageHTML(html);
  assert.equal(result.boundaries, 2);
  assert.equal(result.$("main").text(), "LibraryAvailable guides");
  assert.equal(result.$("body").text().includes("fallback"), false);
  assert.equal(result.$("body").text().includes("Inner loading"), false);
});
test("partial server segments can complete before their enclosing boundary without executing page scripts", () => {
  const html =
    '<body><!--$?--><template id="B:0"></template><!--/$--><div hidden id="S:0"><main><h1>Library</h1><template id="P:1"></template></main></div><div hidden id="S:1"><p>Actual guide description</p></div><script>$RS("S:1","P:1");$RC("B:0","S:0")</script></body>';
  const result = loadPageHTML(html);
  assert.equal(result.segments, 1);
  assert.equal(result.boundaries, 1);
  assert.equal(result.$("main").text(), "LibraryActual guide description");
});
test("client-only shells or hidden source data fail early instead of becoming invented page copy", () => {
  const html = `<head><title>${copy}</title><meta name="description" content="${copy}"></head><body><div id="root"></div><div hidden><p>${copy}</p></div><script>window.pageData=${JSON.stringify(copy)}</script></body>`;
  const page = extractEvidence(html, url, true);
  assert.equal(page.messagingCopy!.blocks.length, 0);
  assert.throws(
    () => assertReadablePage(page),
    (error: unknown) =>
      error instanceof AuditError && error.code === "INSUFFICIENT_EVIDENCE",
  );
  assert.equal(page.collectionNote, undefined);
});
test("a real React streamed response is readable without running its bootstrap code", async () => {
  let ready = false,
    release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  function Deferred() {
    if (!ready) throw pending;
    return createElement(
      "main",
      null,
      createElement("h1", null, "Real streamed library"),
      createElement("p", null, copy),
    );
  }
  const html = await new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    output.on("error", reject);
    const stream = renderToPipeableStream(
      createElement(
        "html",
        null,
        createElement(
          "body",
          null,
          createElement(
            Suspense,
            { fallback: createElement("p", null, "Real loading placeholder") },
            createElement(Deferred),
          ),
        ),
      ),
      {
        identifierPrefix: "audit-",
        onShellReady() {
          stream.pipe(output);
          setImmediate(() => {
            ready = true;
            release();
          });
        },
        onError: reject,
      },
    );
  });
  assert.match(html, /hidden id="audit-S:/);
  const page = extractEvidence(html, url, true);
  assert.ok(
    page.messagingCopy!.blocks.some(
      (block) => block.text === "Real streamed library",
    ),
  );
  assert.equal(page.content.includes("Real loading placeholder"), false);
  assert.doesNotThrow(() => assertReadablePage(page));
});
