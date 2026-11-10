# Messaging & copy: focused editor redesign

Implemented in the existing SiteAudit AI application. The screenshots in this folder use **clearly labeled illustrative fixture reports**. Test API responses are intercepted inside an isolated Chromium session; fixture reports and testing routes are not added to the live application.

## Delivered experience

- A compact review strip replaces the multi-card snapshot. It retains the eligible qualitative score, coverage, full finding count, wording-option count and recorded page scope. Missing collection metadata says “Scope not recorded.”
- A 280px finding queue and one wider active editing panel replace the long expanded-card stack on wide screens. Below the available-width breakpoint, a labeled native finding selector replaces the queue.
- Actual current copy and the editable draft appear directly after the finding explanation, before supporting evidence and implementation steps.
- Priority, focus-area and wording-option filters preserve independent edits and display matching counts separately from full report totals. Selection always corresponds to a matching finding. Longer queues reveal additional entries and keep the selected record visible after filtering.
- The editor provides exact source wording, its page link and recorded context, current draft length, editable/unedited status, Copy wording, Restore suggestion and an Edit draft focus action. Longer originals and explanations have working expand controls.
- Copy feedback stays with its operation. Selection/edit changes invalidate pending feedback so success for an older draft is not announced for a different finding.
- Supporting facts, source context and implementation steps remain available in secondary disclosures. No wording option is fabricated when one was not supplied. An available editor remains usable when steps are missing.
- Assessment reasons, weights, supported strengths and scope details remain accessible below the working area.
- Current drafts, selection, filters and relevant disclosure state survive a section-navigation round trip. A new report resets them. Drafts remain session-only and the UI explains how to export them.
- Generated-step identity supports separate exact duplicate records in this workspace and its full-plan export. Shared step rendering gained optional heading/identity inputs; defaults for the other specialist workspaces are preserved.

The other specialist layouts and the app shell were not redesigned. Messaging uses its own CSS module and editor component while retaining the shared evidence, score, export and generation helpers.

## Representative screenshots

| State | Screenshot |
| --- | --- |
| Desktop finding queue and editor | [1440px](./messaging-1440.png) |
| Mobile finding selector and editor | [390px](./messaging-390.png) |
| Narrow mobile | [320px](./messaging-320.png) |
| Tablet | [768px](./messaging-768.png) |
| Supporting facts | [Mobile evidence](./supporting-facts-390.png) |
| User-edited wording | [Edited draft](./edited-draft-1440.png) |
| Finding with no wording option | [No supplied replacement](./no-wording-option-390.png) |
| No filter matches | [Filtered empty](./filtered-empty-1440.png) |
| No supported findings | [Empty review](./empty-390.png) |
| Earlier report without current messaging assessment | [Legacy report](./legacy-390.png) |
| Longer source wording and explanation | [Expanded source text](./long-copy-390.png) |
| Clipboard failure | [Actionable copy feedback](./clipboard-failure-1440.png) |
| Explicit implementation generation failure | [Retry state](./generation-failure-1440.png) |
| Successful retry retaining the edited draft | [Retried generation](./generation-1440.png) |
| Zoom-equivalent reflow | [200% equivalent](./messaging-zoom-200.png) |

There are 18 screenshots: seven normal viewport widths (320, 390, 768, 900, 1024, 1280 and 1440px), one zoom-equivalent scenario, and ten supporting/editing/empty/error states. The zoom-equivalent case uses a 720 CSS-pixel viewport at 2x device scale, matching reflow on a 1440px canvas at 200%; the browser zoom toolbar was not operated.

## Verification

- `npm test`: **393 passed**, including all existing specialist/model regressions and eight new focused editor tests.
- `npm run lint`: passed without warnings.
- `npm run build`: passed, including TypeScript and production page generation.
- `git diff --check`: passed. Existing line-ending notices are informational.
- Production Chromium checks exercise selection, keyboard focus and Enter actions, navigation retention, new-report reset, copy/restore, full draft-aware export, actual browser text downloading, clipboard failure and explicit generation failure/retry.
- Default editor states are checked for page overflow and visible text contrast at all eight viewport/reflow scenarios. Editor DOM order is verified before implementation steps. The lowest measured default-state text contrast is 5.17:1.
- Component tests also cover intentionally empty hidden edits, zero versus unavailable assessments, missing scope, duplicate-title/different-page findings, exact duplicate records, source preservation, long-list focus, cancellation and late clipboard/generation responses.

Browser results are recorded in [checks.json](./checks.json). The real Chromium fixture-plan download is [bakery.example-messaging-plan.txt](./bakery.example-messaging-plan.txt).

## Scope and limits of testing

Browser checks use intercepted fixture reports and do not perform a new live AI audit. Existing collection, specialist verification, research and provider behavior are preserved and covered by the broader regression suite.

Clipboard writes use a controlled test stub, including denial scenarios; the system clipboard and native permission dialogs were not exercised. The Chromium text download was exercised and its contents compared with the complete plan, including edited and filtered-out findings. Native print dialogs were not operated. The existing global PDF remains a recorded-report export; edited drafts are included in the Messaging text plan.

Contrast checks cover visible text in the redesigned workspace for the tested default fixture states. They are not certification of the entire application's accessibility or a replacement for screen-reader/user testing on physical devices.

## Reproduce the browser checks

With the application running:

```powershell
npm install --prefix node_modules/.cache/siteaudit-review-qa --no-audit --no-fund --package-lock=false playwright-core
$env:REVIEW_BASE_URL = 'http://127.0.0.1:3001'
node scripts/run-with-ca.mjs --import tsx scripts/verify-messaging-ui.mjs
```

The optional driver lives in ignored tooling. Existing Chrome is used by default; set `REVIEW_BROWSER` for another compatible Chromium executable. Development indicators are suppressed in captures, while normal application states and limitations remain visible.
