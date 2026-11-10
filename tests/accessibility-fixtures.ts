import { extractEvidence } from "../src/lib/server/evidence";
import { buildAccessibilityAudit } from "../src/lib/server/accessibility";
import { accessibilityRefreshSchema } from "../src/lib/accessibility-refresh";
export const url = "https://bakery.example/";
const page = extractEvidence(
  '<html lang="en"><head><title>Acorn Bakery</title></head><body><main><h1>Saturday collection</h1><h3>Our bread</h3><p>Acorn Bakery bakes sourdough bread for Saturday collection in Bath.</p><img src="bread.jpg"><input id="email" placeholder="Email" value="PRIVATE_VALUE" aria-describedby="missing-help"><button></button><a href="/about">About the bakery</a></main></body></html>',
  url,
  true,
);
page.fetchedAt = "2026-11-07T10:00:00.000Z";
const ready = extractEvidence(
  '<html lang="en"><head><title>About Acorn Bakery</title></head><body><main><h1>Our bakery</h1><p>Our bakery team prepares sourdough and rye loaves for Saturday collection in Bath.</p><label for="email">Email</label><input id="email"><a href="/">Bakery home</a></main></body></html>',
  `${url}about`,
  true,
);
ready.fetchedAt = page.fetchedAt;
export const pages = [page, ready];
export const audit = buildAccessibilityAudit(pages);
export const readyAudit = buildAccessibilityAudit([ready]);
export const payload = (data = audit) =>
  accessibilityRefreshSchema.parse({
    requestedUrl: url,
    url: data.review!.pages[0].url,
    checkedAt: "2026-11-07T12:00:00.000Z",
    audit: {
      ...data,
      requestedUrl: url,
      checkedAt: "2026-11-07T12:00:00.000Z",
    },
  });
