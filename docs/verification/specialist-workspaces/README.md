# Specialist workspace redesign: delivery and verification

Implemented in the existing Next.js application. Screenshots show the production build with **illustrative fixture data**, not a live review of bakery.example. The test driver intercepts API responses inside its isolated Chromium session; fixtures are never imported by application routes or production components.

## What changed

- One section heading and a compact summary replace repeated marketing introductions and large score rings.
- Findings come before criterion breakdowns, page inspectors, strengths and scope information. Desktop uses a wider findings column and a smaller assessment rail; mobile follows the same reading order.
- Shared finding details expose retained explanations, typed evidence, source pages and explicit implementation steps. Structured observations remain available without a plain evidence string.
- Messaging keeps editable original/suggested wording comparisons, restoration, draft-aware exports, empty edits and unreviewed-edit labels, including when fix steps are unavailable.
- Search optimization retains its per-page metadata inspector and explicitly illustrative listing preview, plus missing/partial/withheld assessment states.
- Conversion retains observed labels, destinations and forms, while separating working hypotheses from measured visitor behavior.
- Quick wins becomes a smaller implementation queue with estimated effort, linked findings, reversible manual status, sorting, filters and complete shortlist exports.
- SEO and Conversion now retain filters, selected inspector pages and disclosures across navigation. Report keys reset section state for a new audit.
- Generated steps use finding identity rather than a title alone. Existing title-keyed inputs remain readable, and downstream section plans and the print report recognize the new identity.
- Shared UX styling is left intact. Existing UX, AI visibility, security, accessibility, PageSpeed and creative-tool tests remain part of the passing suite.

## Representative screenshots

| Workspace | Desktop, 1440px | Mobile, 390px |
| --- | --- | --- |
| Messaging & copy | [Desktop](./messaging-1440.png) | [Mobile](./messaging-390.png) |
| Search optimization | [Desktop](./seo-1440.png) | [Mobile](./seo-390.png) |
| Conversion | [Desktop](./conversion-1440.png) | [Mobile](./conversion-390.png) |
| Quick wins | [Desktop](./quickwins-1440.png) | [Mobile](./quickwins-390.png) |

Additional states:

- [Search inspector, desktop](./seo-inspector-1440.png) and [mobile](./seo-inspector-390.png).
- [Conversion inspector, desktop](./conversion-inspector-1440.png) and [mobile](./conversion-inspector-390.png).
- [Expanded quick-win evidence and steps](./quickwins-details-1440.png).
- [200% equivalent Messaging reflow](./messaging-zoom-200.png).

The directory contains 37 screenshots covering all four sections at 320, 390, 768, 900, 1024, 1280 and 1440 CSS pixels, plus a 720 CSS-pixel viewport at 2x device scale. That last configuration checks reflow equivalent to a 1440px canvas at 200%; it does not operate the browser's zoom toolbar.

## Checks actually performed

- `npm test`: **385 passing tests**. Coverage includes existing model and specialist regressions plus new tests for score eligibility, zero/missing values, duplicate titles, stable identity, missing-step wording edits, explicit generation failure/retry, navigation state, download failure, and cancellation of late generation responses.
- After correcting a test query's TypeScript option, the six landing workflow tests were rerun successfully.
- `npm run lint`: passed without warnings.
- `npm run build`: passed, including TypeScript checking and production page generation.
- `git diff --check`: passed. Existing repository line-ending notices are informational.
- Isolated Chromium verification against the production server: **37 screenshots**, zero browser runtime errors, zero unexpected API requests, and no horizontal page overflow across 32 section/viewport scenarios.
- Visible text in the redesigned workspace containers was checked using computed foreground/background colors. The lowest measured contrast in these fixture states was **4.78:1**. This is a scoped text-contrast check, not certification of the entire application's accessibility.
- Keyboard verification: visible focus, Enter to collapse/reopen finding details, and Space to mark a quick-win task done.
- Navigation verification: edited wording, SEO/Conversion filters and manual task status survive visits to other sections. Component tests additionally verify selected-page/disclosure retention and new-report reset.
- Export verification: a real Chromium text download was captured and its full contents matched the draft-aware section plan, including a finding not opened for editing. Component tests cover filtered-out records, empty drafts, clipboard failure, stale clipboard feedback and download-start failure.

Machine-readable browser results are in [checks.json](./checks.json). The downloaded fixture plan is [bakery.example-messaging-plan.txt](./bakery.example-messaging-plan.txt).

## Verification scope

Browser clipboard writes were controlled by a test stub; the system clipboard and native permission dialogs were not exercised. Browser text downloading was exercised. Existing component tests verify the print action and full recorded-report content; the operating system's print dialog was not operated in this task.

The production browser checks use fixture reports to verify the UI and do not start a live AI audit. Existing live audit collection, specialist verification, provider timeouts and research flows are preserved. Assessment scores and manual completion retain their original qualitative/session-only scope. The global PDF keeps the recorded review; current edited wording and manual task statuses are included in their respective section text exports.

## Reproduce

Run the application locally, then install the optional verification driver into ignored local tooling:

```powershell
npm install --prefix node_modules/.cache/siteaudit-review-qa --no-audit --no-fund --package-lock=false playwright-core
$env:REVIEW_BASE_URL = 'http://127.0.0.1:3001'
node scripts/run-with-ca.mjs --import tsx scripts/verify-review-ui.mjs
```

The driver uses the existing Chrome executable by default. Set `REVIEW_BROWSER` to another compatible Chromium executable if needed. Screenshot capture starts from the top of each section. Development indicators are suppressed in captures; production has no such indicator.
