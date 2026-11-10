import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAccessibilityEvidence } from "../src/lib/server/accessibility-evidence";
import { buildAccessibilityAudit } from "../src/lib/server/accessibility";
import { extractEvidence } from "../src/lib/server/evidence";
import { accessibilityActions } from "../src/lib/accessibility";
import { accessibilityPlan } from "../src/lib/accessibility-presentation";

const wrap = (body: string) =>
  `<html lang="en"><head><title>Acorn Bakery · Saturday collection</title></head><body><main><h1>Saturday sourdough collection</h1>${body}</main></body></html>`;
const snapshot = (body: string) => extractAccessibilityEvidence(wrap(body));
const check = (body: string, key: string) =>
  snapshot(body).checks.find((check) => check.key === key)!;

test("accessibility checks use document language and title declarations without certifying descriptive quality", () => {
  assert.equal(
    check("<p>Bakery information.</p>", "language").status,
    "observed",
  );
  const raw = extractAccessibilityEvidence(
    "<main><h2>Information</h2><p>Content.</p></main>",
  );
  assert.equal(
    raw.checks.find((check) => check.key === "language")!.status,
    "review",
  );
  assert.equal(
    raw.checks.find((check) => check.key === "title")!.status,
    "review",
  );
  assert.match(check("", "title").context, /presence does not establish/);
});

test("empty image alternatives are not defects and equivalent ARIA alternatives are recognized", () => {
  for (const body of [
    '<img alt="" src="ornament.svg">',
    '<img role="presentation" src="ornament.svg">',
    '<img aria-label="A white sourdough loaf" src="bread.jpg">',
    '<span hidden id="caption">Sourdough on the bakery counter</span><img aria-labelledby="caption" src="bread.jpg">',
  ])
    assert.equal(check(body, "images").status, "observed", body);
  assert.equal(check('<img src="bread.jpg">', "images").status, "review");
  assert.equal(
    check(
      '<img role="img" alt="" title="Sourdough loaf" src="bread.jpg">',
      "images",
    ).status,
    "observed",
  );
});

test("image-only links need a name even when their image is intentionally decorative", () => {
  assert.equal(
    check('<a href="/bread"><img alt="" src="bread.jpg"></a>', "links").status,
    "review",
  );
  assert.equal(
    check(
      '<a href="/bread"><img alt="Bread menu" src="bread.jpg"></a>',
      "links",
    ).status,
    "observed",
  );
  assert.equal(
    check(
      '<a href="/bread" aria-label="Browse bread"><img alt="" src="bread.jpg"></a>',
      "links",
    ).status,
    "observed",
  );
});

test("hidden, inert and inline-hidden controls are excluded while hidden label targets remain available", () => {
  const body =
    '<div hidden><button></button></div><div inert><input></div><button aria-hidden="true"></button><input type="hidden" value="SECRET"><button style="display:none"></button><span id="hidden-label" hidden>Search the bakery</span><input aria-labelledby="hidden-label">';
  assert.equal(snapshot(body).counts.controls, 0);
  assert.equal(snapshot(body).counts.fields, 1);
  assert.equal(check(body, "fields").status, "observed");
  assert.ok(
    check(body, "fields").observations.some((row) =>
      row.value.includes("Search the bakery"),
    ),
  );
});

test("native labels, wrapper labels and references name fields; placeholders alone do not provide persistent labels", () => {
  for (const body of [
    '<label for="email">Email</label><input id="email">',
    "<label>Your email<input></label>",
    '<input aria-label="Email">',
    '<span id="one">Your</span><span id="two">email</span><input aria-labelledby="one two">',
    '<input title="Email">',
  ])
    assert.equal(check(body, "fields").status, "observed", body);
  const item = check('<input placeholder="Email">', "fields");
  assert.equal(item.status, "review");
  assert.match(item.observations[0].value, /placeholder only/);
});

test("labels for another element and fieldset legends do not fabricate individual field names", () => {
  assert.equal(
    check(
      '<label for="other">Email<input id="inside"></label><input id="other" aria-label="Other input">',
      "fields",
    ).status,
    "review",
  );
  assert.equal(
    check(
      '<fieldset><legend>Delivery preference</legend><input type="radio" name="delivery"></fieldset>',
      "fields",
    ).status,
    "review",
  );
});

test("native button defaults, image alt and SVG titles contribute name candidates", () => {
  for (const body of [
    '<input type="submit">',
    '<input type="reset">',
    '<input type="image" alt="Search">',
    '<button><img alt="Search" src="icon.svg"></button>',
    "<button><svg><title>Search</title><path></path></svg></button>",
    '<button><svg aria-label="Search"><path></path></svg></button>',
    '<button><span role="img" aria-label="Search"></span></button>',
    '<button aria-label="Close"><svg aria-hidden="true"></svg></button>',
  ])
    assert.equal(check(body, "controls").status, "observed", body);
  assert.equal(
    check('<input type="submit" value="">', "controls").status,
    "review",
  );
  assert.equal(
    check(
      '<button><svg aria-hidden="true"><title>Decoration</title></svg></button>',
      "controls",
    ).status,
    "review",
  );
});

test("custom controls need appropriate names and numeric slider content is not a label", () => {
  assert.equal(
    check('<div role="switch">Email updates</div>', "controls").status,
    "observed",
  );
  assert.equal(
    check('<div role="slider">50</div>', "controls").status,
    "review",
  );
  assert.equal(
    check('<div role="slider" aria-label="Volume">50</div>', "controls").status,
    "observed",
  );
});

test("partial ARIA references keep valid name candidates and report unresolved references separately", () => {
  const body =
    '<span id="name">Email</span><input aria-labelledby="missing name">';
  assert.equal(check(body, "fields").status, "observed");
  assert.equal(check(body, "references").status, "review");
  assert.equal(
    check(
      '<button aria-controls="dynamic-panel" aria-label="Open details"></button>',
      "references",
    ).status,
    "not-observed",
  );
});

test("unreferenced duplicate IDs are not automatic WCAG 2.2 parsing failures", () => {
  const unreferenced = check(
    '<div id="same">One</div><div id="same">Two</div>',
    "references",
  );
  assert.equal(unreferenced.status, "observed");
  assert.equal(unreferenced.steps.length, 0);
  const referenced = check(
    '<span id="same">One</span><span id="same">Two</span><input aria-labelledby="same">',
    "references",
  );
  assert.equal(referenced.status, "review");
  assert.match(
    referenced.context,
    /not reported as a WCAG 2.2 parsing failure/,
  );
});

test("a first H2 or multiple H1s alone do not create heading tasks, while skips and invalid ARIA levels need contextual review", () => {
  const simple = extractAccessibilityEvidence(
    '<html lang="en"><title>Bakery</title><body><h2>Collection</h2><h2>Bread menu</h2></body></html>',
  );
  assert.equal(
    simple.checks.find((check) => check.key === "headings")!.status,
    "observed",
  );
  assert.equal(
    check("<h1>Another section</h1>", "headings").status,
    "observed",
  );
  assert.equal(check("<h3>A subsection</h3>", "headings").status, "review");
  assert.equal(
    check('<div role="heading">Missing level</div>', "headings").status,
    "review",
  );
  assert.equal(
    check('<div role="heading" aria-level="2">Valid section</div>', "headings")
      .status,
    "observed",
  );
  assert.equal(
    check('<h2 role="heading">Native section</h2>', "headings").status,
    "observed",
  );
  assert.equal(
    check('<h2 aria-level="3">Overridden section</h2>', "headings").status,
    "review",
  );
  assert.match(
    check("<h3>Section</h3>", "headings").context,
    /not automatic WCAG failures/,
  );
});

test("no elements means not observed rather than a perfect alt or name score", () => {
  const page = extractEvidence(
    wrap("<p>Public bakery information for Saturday collection in Bath.</p>"),
    "https://bakery.example/",
    true,
  );
  const audit = buildAccessibilityAudit([page]);
  assert.equal(audit.altTextCoverage, null);
  assert.equal(audit.ariaLabels, null);
  assert.equal(audit.overallScore, null);
  assert.equal(audit.contrastIssues, null);
});

test("entered field values are never copied into accessibility evidence", () => {
  const raw = snapshot(
    '<label>Password<input type="password" value="PRIVATE_PASSWORD"></label><label>Address<textarea>PRIVATE_ADDRESS</textarea></label><label>Profile<select><option selected>PRIVATE_PROFILE</option></select></label>',
  );
  for (const value of [
    "PRIVATE_PASSWORD",
    "PRIVATE_ADDRESS",
    "PRIVATE_PROFILE",
  ])
    assert.equal(JSON.stringify(raw).includes(value), false, value);
});

test("bounded evidence keeps full issue counts and discloses sampling", () => {
  const raw = snapshot(
    Array.from(
      { length: 70 },
      (_, index) => `<input id="field-${index}">`,
    ).join(""),
  );
  const item = raw.checks.find((check) => check.key === "fields")!;
  assert.equal(raw.counts.fields, 70);
  assert.match(item.detail, /^70 element\(s\) inspected; 70/);
  assert.equal(item.observations.length, 40);
  assert.equal(raw.sampled, true);
});

test("every collected page retains its own evidence; missing snapshots do not imply passing checks", () => {
  const first = extractEvidence(
    wrap('<button aria-label="Menu"></button>'),
    "https://bakery.example/",
    true,
  );
  const second = extractEvidence(
    wrap("<button></button>"),
    "https://bakery.example/about",
    true,
  );
  const audit = buildAccessibilityAudit([first, second]);
  assert.equal(audit.review!.scope.checks, 18);
  assert.equal(
    audit.review!.pages[0].checks.find((check) => check.key === "controls")!
      .status,
    "observed",
  );
  assert.equal(
    audit.review!.pages[1].checks.find((check) => check.key === "controls")!
      .status,
    "review",
  );
  const unknown = buildAccessibilityAudit([
    { ...first, accessibilitySnapshot: undefined },
  ]);
  assert.ok(
    unknown.review!.pages[0].checks.every(
      (check) => check.status === "not-assessed",
    ),
  );
  assert.equal(unknown.altTextCoverage, null);
});

test("a plan without HTML tasks still exports evidence and a complete manual testing checklist", () => {
  const page = extractEvidence(
    wrap("<p>Saturday sourdough collection in Bath.</p>"),
    "https://bakery.example/",
    true,
  );
  const audit = buildAccessibilityAudit([page]);
  assert.equal(accessibilityActions(audit.review!).length, 0);
  const plan = accessibilityPlan(audit, page.url);
  for (const text of [
    "No review tasks were identified",
    "OBSERVATIONS AND SOURCE EVIDENCE",
    "Keyboard access & focus",
    "Screen-reader names",
    "Contrast & visual states",
    "NOT TESTED",
  ])
    assert.ok(plan.includes(text), text);
});
