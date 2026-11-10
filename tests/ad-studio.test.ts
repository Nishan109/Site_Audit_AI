import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignInstructions,
  draftEdited,
  draftText,
  exportDrafts,
  imageFileError,
  previewRatio,
  selectCreativeAsset,
  type AdDrafts,
  type CreativeAsset,
  type CreativeRatio,
} from "../src/lib/ad-studio";

const square: CreativeAsset = {
  src: "data:image/png;base64,test-square",
  name: "square.png",
  width: 1080,
  height: 1080,
};
const vertical: CreativeAsset = {
  src: "data:image/png;base64,test-vertical",
  name: "vertical.png",
  width: 1080,
  height: 1920,
};
const google = {
  headline: "Cloud tools for your team",
  description: "Explore the tools and choose a plan for your team.",
  score: 80,
  tag: "Team focus",
  reason: "A qualitative assessment of the original copy.",
};
const meta = {
  headline: "Make your next move",
  description: "Explore the website.",
  primaryText: "Discover the offering and decide if it fits your team.",
  score: 81,
  tag: "Explore",
  reason: "Original wording assessment.",
};

test("story and reel previews always use a vertical frame independently of the feed setting", () => {
  for (const ratio of ["1:1", "16:9", "9:16"] as CreativeRatio[]) {
    assert.equal(previewRatio("feed", ratio), ratio);
    assert.equal(previewRatio("stories", ratio), "9:16");
    assert.equal(previewRatio("reels", ratio), "9:16");
  }
});
test("a matching creative wins over a fallback and keeps its actual dimensions", () => {
  const chosen = selectCreativeAsset(
    { "1:1": square, "9:16": vertical },
    "9:16",
  )!;
  assert.equal(chosen.asset, vertical);
  assert.equal(chosen.reused, false);
  assert.equal(chosen.asset.height, 1920);
  assert.equal(chosen.asset.width, 1080);
});
test("reusing artwork reports the original ratio so a crop can be explained", () => {
  const assets = { "1:1": square };
  const chosen = selectCreativeAsset(assets, "9:16")!;
  assert.equal(chosen.asset, square);
  assert.equal(chosen.sourceRatio, "1:1");
  assert.equal(chosen.reused, true);
  assert.deepEqual(assets, { "1:1": square });
  assert.equal(selectCreativeAsset({}, "1:1"), null);
});
test("the image picker rejects unsupported, empty and oversized files", () => {
  assert.match(imageFileError({ type: "image/svg+xml", size: 100 })!, /PNG/);
  assert.match(imageFileError({ type: "image/png", size: 5_000_001 })!, /5 MB/);
  assert.match(imageFileError({ type: "image/png", size: 0 })!, /empty/);
  for (const type of ["image/png", "image/jpeg", "image/webp"])
    assert.equal(imageFileError({ type, size: 4000 }), null);
});
test("all brief controls reach the copywriter instructions within the API limit", () => {
  const instructions = campaignInstructions({
    audience: "Recruiters",
    goal: "Qualified enquiries",
    tone: "Clear & professional",
    direction: "Use the technical skills already listed on the website.",
  });
  for (const value of [
    "Recruiters",
    "Qualified enquiries",
    "Clear & professional",
    "technical skills",
  ])
    assert.ok(instructions.includes(value));
  assert.ok(
    campaignInstructions({
      audience: "a".repeat(180),
      goal: "Qualified enquiries",
      tone: "Clear & professional",
      direction: "b".repeat(1800),
    }).length < 3000,
  );
  assert.ok(
    !campaignInstructions({
      audience: "  ",
      goal: "Website visits",
      tone: "Clear",
      direction: "",
    }).includes("Intended audience"),
  );
});
test("editing any copy field invalidates the original AI assessment", () => {
  assert.equal(draftEdited({ ...google }, google), false);
  assert.equal(
    draftEdited({ ...google, headline: "A revised headline" }, google),
    true,
  );
  assert.equal(
    draftEdited({ ...google, description: "A revised description" }, google),
    true,
  );
  assert.equal(
    draftEdited({ ...meta, primaryText: "A revised primary text" }, meta),
    true,
  );
});
test("copy and export use the edited text without invented performance or stale AI scores", () => {
  const edited = { ...google, headline: "The edited headline" };
  const drafts: AdDrafts = { googleAds: [edited], facebookAds: [meta] };
  const output = exportDrafts(drafts, "https://example.com/", "Contact us");
  for (const text of [
    edited.headline,
    meta.primaryText,
    "Contact us",
    "https://example.com/",
    "GOOGLE SEARCH",
    "META",
  ])
    assert.ok(output.includes(text));
  for (const text of [
    google.headline,
    google.reason,
    "80/100",
    "CTR",
    "conversion rate",
  ])
    assert.ok(!output.includes(text));
  assert.equal(
    draftText(edited, "https://example.com/"),
    `${edited.headline}\n\n${edited.description}\n\nhttps://example.com/`,
  );
});
