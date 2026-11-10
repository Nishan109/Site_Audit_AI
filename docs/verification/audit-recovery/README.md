# Incomplete audit response: fix and live verification

## Confirmed failures

The server serving the user's existing localhost:3001 tab recorded a runtime schema failure at `issues[1].copySuggestion.replacement` (`too_small`). An optional proposed copy replacement did not meet the existing minimum length, and its invalid draft ended the entire audit.

A subsequent real browser run exposed another completeness failure: the UX verifier omitted required candidate decisions. This response was valid JSON and matched the static field schema, but it did not verify every supplied candidate.

Neither failure was resolved by inventing, padding, coercing, or substituting report data.

## Implementation

- Structured responses are now parsed and validated inside each bounded Gemini model attempt. Malformed JSON, empty responses, incomplete/out-of-range schema values, and unfinished structured responses can fall back to another configured model.
- Additional verification completeness checks run inside the same retry boundary. Messaging, UX, SEO, Conversion, and AI content readiness each require every supplied candidate ID exactly once. Missing, repeated, and invented decisions remain invalid.
- Verification prompts explicitly list the required decision count and IDs. Existing independent evidence checks, contradiction detection, source requirements, and unsupported-finding handling remain in place.
- Model fallbacks receive the unchanged evidence and schema. Comparative batches are retried together on one model, preventing results from different model attempts being mixed.
- The existing overall generation limit, per-attempt timeout, cancellation, transient-error backoff, authentication/quota handling, and no-template behavior remain. Late responses after cancellation are rejected.
- Provider content blocks stop immediately rather than triggering a fallback around the block. Unspecified prompt-feedback metadata is distinguished from an actual block.
- Final schema-error HTTP responses now include Cache-Control: no-store.

Changed runtime files: src/lib/server/gemini.ts, verification.ts, errors.ts, messaging.ts, ux.ts, seo.ts, conversion.ts, and ai-visibility.ts. Added/updated regression coverage in the Gemini, Messaging, UX, SEO, and AI visibility tests. The repeatable live browser driver is scripts/verify-live-audit-ui.mjs.

## Validation

- `npm test`: **414 passed, 0 failed**.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and static page generation.
- Regression coverage includes the exact short-copy-replacement failure, incomplete verification followed by successful recovery, persistent invalid output failing safely, duplicate/invented candidate IDs, valid zero values, truncated output, batch consistency, content blocking, and cancellation.

## Actual live browser result

The production app was restarted on the user's existing localhost:3001 address. The browser verification submitted the public URL through the actual website form, using the real /api/analyze endpoint and configured Gemini provider. No audit responses were intercepted or replaced with fixtures.

- URL: https://woxora.com/ebooks.
- HTTP status: **200**.
- Total browser verification time: **55 seconds**.
- Report timestamp: **2026-11-08T17:26:14.335Z**.
- Data source: **live**.
- Model recorded by the completed report: **gemini-3.5-flash-lite**.
- Collected pages: **1**.
- Retained findings: Messaging 0, UX 1, SEO 1, Conversion 0.
- Research and report validation: **completed**.
- Uncaught browser page errors: **0**.

Finding counts reflect this particular retained report. Empty categories are allowed; a useful audit does not need to manufacture criticisms for every section.

See [machine-readable live checks](live-checks.json), [successful overview screenshot](live-success-1440.png), and [live UX screenshot](live-ux-1440.png). The screenshots carry a live-audit timestamp marker. The separately retained live-error-1440.png records the earlier UX completeness failure before the final coverage fix.

## Scope and limits

This verifies that the affected URL can complete through the real application flow and that the identified incomplete-response cases recover under regression tests. It does not guarantee every future provider request will succeed: exhausted quotas, unavailable models, persistent invalid output, and deadlines still return honest errors.

The website report remains an assessment of collected content, initial HTML, and available response headers. Successful application verification does not establish that the audited website's rendered layout, interactions, accessibility, security, traffic, or conversion outcomes were tested.

To repeat the live browser check, start the app and explicitly supply the URL:

```powershell
$env:REVIEW_BASE_URL = 'http://127.0.0.1:3001'
node scripts/run-with-ca.mjs scripts/verify-live-audit-ui.mjs https://woxora.com/ebooks
```

This command makes real provider requests. Its browser dependency uses the same isolated optional playwright-core cache as the existing UI verification scripts; no production dependency or fixture endpoint was added.
