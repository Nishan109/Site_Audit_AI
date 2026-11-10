import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEvidence } from "../src/lib/server/evidence";
import {
  extractSecurityEvidence,
  securityResponse,
} from "../src/lib/server/security-evidence";
import { buildSecurityAudit } from "../src/lib/server/security";
import { securityActions } from "../src/lib/security";
import { securityPlan } from "../src/lib/security-presentation";

const html =
  "<html><head><title>Acorn Bakery</title></head><body><main><h1>Saturday bread collection in Bath</h1><p>Acorn Bakery bakes sourdough and rye loaves for collection from our bakery in Bath on Saturdays.</p></main></body></html>";
const url = "https://bakery.example/";
const makePage = (
  headers: Record<string, string | string[] | undefined> = {},
  markup = html,
  address = url,
) =>
  extractEvidence(
    markup,
    address,
    !!headers["content-security-policy"],
    undefined,
    securityResponse(200, headers),
  );
const check = (
  key: string,
  headers: Record<string, string | string[] | undefined> = {},
  markup = html,
  address = url,
) =>
  buildSecurityAudit([
    makePage(headers, markup, address),
  ]).review!.pages[0].checks.find((item) => item.key === key)!;

test("security responses retain only allowlisted policy headers and cookie attributes", () => {
  const response = securityResponse(200, {
    "Content-Security-Policy": ["default-src 'self'", "frame-ancestors 'none'"],
    "Set-Cookie": [
      "session=SECRET_VALUE; Secure; HttpOnly; SameSite=None",
      "tracking=OTHER_SECRET; SameSite=Lax",
    ],
    Authorization: "Bearer SECRET_TOKEN",
    "X-Api-Key": "private-key",
  });
  assert.deepEqual(response.headers["content-security-policy"], [
    "default-src 'self'",
    "frame-ancestors 'none'",
  ]);
  assert.deepEqual(response.cookies, [
    { secure: true, httpOnly: true, sameSite: "none" },
    { secure: false, httpOnly: false, sameSite: "lax" },
  ]);
  for (const value of [
    "SECRET_VALUE",
    "OTHER_SECRET",
    "session",
    "tracking",
    "SECRET_TOKEN",
    "private-key",
  ])
    assert.equal(JSON.stringify(response).includes(value), false, value);
});

test("uncollected headers are not reported as missing controls and do not create header tasks", () => {
  const page = extractEvidence(html, url, false);
  const audit = buildSecurityAudit([page]);
  assert.equal(audit.cspHeaders, null);
  assert.ok(
    audit
      .review!.pages[0].checks.filter((item) => item.area !== "transport")
      .every((item) => item.status === "not-assessed"),
  );
  assert.equal(securityActions(audit.review!).length, 0);
});

test("HTTP transport is a scoped high-priority observation without inventing TLS or redirect tests", () => {
  const audit = buildSecurityAudit([
    makePage({}, html, "http://bakery.example/"),
  ]);
  assert.equal(audit.httpsEnabled, false);
  assert.equal(audit.overallScore, null);
  assert.equal(securityActions(audit.review!)[0].key, "transport");
  assert.equal(securityActions(audit.review!)[0].priority, "High");
  for (const key of ["assets", "forms", "hsts"])
    assert.equal(
      audit.review!.pages[0].checks.find((item) => item.key === key)!.status,
      "not-assessed",
    );
});

test("HTTP resource observations cover resolved bases, srcset and media without treating navigation links as mixed content", () => {
  const snapshot = extractSecurityEvidence(
    '<head><base href="http://cdn.example/assets/"></head><body><script src="app.js?token=SECRET"></script><img srcset="http://img.example/a.jpg 1x, https://img.example/b.jpg 2x"><video poster="http://media.example/poster.jpg"></video><source src="http://media.example/clip.mp4"><a href="http://elsewhere.example/">Navigate</a><form action="http://forms.example/send?secret=HIDE"><button>Send</button></form></body>',
    url,
  );
  assert.equal(snapshot.httpAssets.length, 4);
  assert.equal(snapshot.httpForms.length, 1);
  assert.equal(snapshot.httpAssets[0].url, "http://cdn.example/assets/app.js");
  assert.equal(JSON.stringify(snapshot).includes("SECRET"), false);
  assert.equal(JSON.stringify(snapshot).includes("HIDE"), false);
  assert.equal(
    snapshot.httpAssets.some((item) => item.element === "a"),
    false,
  );
});

test("an HTTPS protocol-relative resource is not HTTP and upgrade-insecure-requests does not invent a network failure", () => {
  const markup = html.replace(
    "</main>",
    '<img src="//cdn.example/bread.jpg"><script src="http://cdn.example/app.js"></script></main>',
  );
  const item = check(
    "assets",
    { "content-security-policy": "upgrade-insecure-requests" },
    markup,
  );
  assert.equal(item.status, "review");
  assert.equal(item.observations.length, 1);
  assert.match(item.context, /not confirmed network requests/);
  assert.match(item.context, /upgrade or block/);
  assert.equal(check("forms", {}, markup).status, "not-observed");
});

test("data srcset candidates do not turn into HTTP references through their embedded commas", () => {
  const snapshot = extractSecurityEvidence(
    '<head><base href="http://cdn.example/"></head><body><img srcset="data:image/png;base64,AAAA 1x, https://cdn.example/image.png 2x"></body>',
    url,
  );
  assert.equal(snapshot.httpAssets.length, 0);
});

test("cookie flag names retain RFC parsing semantics without disclosing ignored attribute values", () => {
  const response = securityResponse(200, {
    "set-cookie":
      "private=SECRET; Secure=ignored; HttpOnly=ignored; SameSite=None",
  });
  assert.equal(response.cookies[0].secure, true);
  assert.equal(response.cookies[0].httpOnly, true);
  assert.equal(JSON.stringify(response).includes("ignored"), false);
});

test("CSP distinguishes an enforcing response header, a report-only policy and a meta policy", () => {
  assert.equal(
    check("csp", { "content-security-policy": "default-src 'self'" }).status,
    "observed",
  );
  const report = check("csp", {
    "content-security-policy-report-only": "default-src 'none'",
  });
  assert.equal(report.status, "review");
  assert.match(report.detail, /without enforcing/);
  const meta = check(
    "csp",
    {},
    html.replace(
      "</head>",
      '<meta http-equiv="Content-Security-Policy" content="default-src https:"></head>',
    ),
  );
  assert.equal(meta.status, "observed");
  assert.match(meta.detail, /meta declaration/);
  assert.equal(meta.steps.length, 0);
  assert.equal(
    check("csp", { "content-security-policy": "   " }).status,
    "not-observed",
  );
});

test("a valid frame-ancestors response policy does not require a duplicate X-Frame-Options header", () => {
  const item = check("framing", {
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  });
  assert.equal(item.status, "observed");
  assert.equal(item.steps.length, 0);
  assert.match(item.detail, /frame-ancestors/);
});

test("default-src, meta CSP and report-only frame-ancestors do not count as enforcing framing controls", () => {
  for (const headers of [
    { "content-security-policy": "default-src 'none'" },
    { "content-security-policy-report-only": "frame-ancestors 'none'" },
  ])
    assert.equal(check("framing", headers).status, "not-observed");
  assert.equal(
    check(
      "framing",
      {},
      html.replace(
        "</head>",
        '<meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'"></head>',
      ),
    ).status,
    "not-observed",
  );
});

test("CSP precedence, duplicate directive order and obsolete/conflicting XFO values are preserved", () => {
  assert.equal(
    check("framing", {
      "content-security-policy": "frame-ancestors *",
      "x-frame-options": "DENY",
    }).status,
    "review",
  );
  assert.equal(
    check("framing", {
      "content-security-policy": "frame-ancestors *; frame-ancestors 'none'",
    }).status,
    "review",
  );
  assert.equal(
    check("framing", {
      "content-security-policy": [
        "frame-ancestors *",
        "frame-ancestors 'self'",
      ],
    }).status,
    "observed",
  );
  assert.equal(
    check("framing", {
      "x-frame-options": "ALLOW-FROM https://partner.example",
    }).status,
    "review",
  );
  assert.equal(
    check("framing", { "x-frame-options": ["DENY", "SAMEORIGIN"] }).status,
    "review",
  );
  assert.equal(
    check("framing", { "x-frame-options": "sameorigin" }).status,
    "observed",
  );
});

test("HSTS max-age=0, malformed/duplicate values and unknown preload state are not labeled enabled", () => {
  const enabled = check("hsts", {
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  });
  assert.equal(enabled.status, "observed");
  assert.match(enabled.context, /does not establish preload enrollment/);
  for (const value of [
    "max-age=0",
    "max-age=-1",
    "max-age=hello",
    "max-age=10; max-age=20",
    "max-age=10, max-age=20",
  ])
    assert.equal(
      check("hsts", { "strict-transport-security": value }).status,
      "review",
      value,
    );
  const absent = check("hsts");
  assert.match(absent.detail, /existing HSTS or preload state is unknown/);
  assert.equal(absent.priority, "Low");
});

test("nosniff must be a recognized value and a missing Referrer-Policy is not an automatic defect", () => {
  assert.equal(
    check("mime", { "x-content-type-options": "nosniff" }).status,
    "observed",
  );
  assert.equal(
    check("mime", { "x-content-type-options": "off" }).status,
    "review",
  );
  assert.equal(check("referrer").steps.length, 0);
  assert.match(
    check("referrer").context,
    /default to strict-origin-when-cross-origin/,
  );
  assert.equal(
    check("referrer", {
      "referrer-policy": "origin, strict-origin-when-cross-origin",
    }).status,
    "observed",
  );
  assert.equal(
    check("referrer", { "referrer-policy": "unsafe-url" }).status,
    "review",
  );
});

test("cookie attributes do not invent a consent failure or require HttpOnly for every cookie", () => {
  const item = check("cookies", {
    "set-cookie": [
      "theme=light; Secure; SameSite=Lax",
      "session=private; HttpOnly; Secure; SameSite=Strict",
    ],
  });
  assert.equal(item.status, "observed");
  assert.equal(item.steps.length, 0);
  assert.match(item.context, /missing HttpOnly is not automatically a defect/);
  assert.equal(buildSecurityAudit([makePage()]).cookieConsent, null);
  assert.equal(check("cookies").status, "not-observed");
  assert.match(
    check("cookies").detail,
    /does not establish a cookie-free site/,
  );
});

test("SameSite=None without Secure produces a precise configuration review without disclosing values", () => {
  const item = check("cookies", {
    "set-cookie": "session=SECRET; SameSite=None; HttpOnly",
  });
  assert.equal(item.status, "review");
  assert.equal(item.priority, "Medium");
  assert.deepEqual(
    item.observations.find(
      (row) => row.label === "SameSite=None without Secure",
    ),
    { label: "SameSite=None without Secure", value: "1" },
  );
  assert.equal(JSON.stringify(item).includes("SECRET"), false);
});

test("security scope retains each page's own response evidence rather than reusing the root page", () => {
  const pages = [
    makePage({ "x-frame-options": "DENY" }),
    makePage(
      { "x-frame-options": "ALLOW-FROM https://partner.example" },
      html.replace("Acorn Bakery", "About the bakery"),
      `${url}about`,
    ),
  ];
  const audit = buildSecurityAudit(pages);
  assert.equal(
    audit.review!.pages[0].checks.find((item) => item.key === "framing")!
      .status,
    "observed",
  );
  assert.equal(
    audit.review!.pages[1].checks.find((item) => item.key === "framing")!
      .status,
    "review",
  );
  assert.equal(audit.review!.scope.checks, 18);
  assert.equal(audit.review!.scope.headersCollected, 2);
  const ids = audit.review!.pages.flatMap((page) =>
    page.checks.map((item) => item.id),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("resource sampling is disclosed and a fully observed policy set never creates an invented security grade", () => {
  const large = html.replace(
    "</main>",
    `${Array.from({ length: 95 }, (_, index) => `<img src="http://cdn.example/${index}.png">`).join("")}</main>`,
  );
  const audit = buildSecurityAudit([makePage({}, large)]);
  assert.equal(audit.review!.scope.sampled, true);
  assert.equal(
    audit.review!.pages[0].checks.find((item) => item.key === "assets")!
      .observations.length,
    80,
  );
  assert.match(
    audit.review!.pages[0].checks.find((item) => item.key === "assets")!.detail,
    /^95 explicit/,
  );
  const ready = buildSecurityAudit([
    makePage({
      "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
      "strict-transport-security": "max-age=1000",
      "x-content-type-options": "nosniff",
    }),
  ]);
  assert.equal(ready.overallScore, null);
  assert.equal(securityActions(ready.review!).length, 0);
  const plan = securityPlan(ready, url);
  assert.match(plan, /No additional configuration review actions/);
  assert.match(plan, /not a security clearance/);
  assert.match(plan, /NOT TESTED/);
});
