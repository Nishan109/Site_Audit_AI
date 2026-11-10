# User experience workspace: implementation and verification

Implemented November 8, 2026. The latest production verification ran against http://127.0.0.1:3002; its timestamp and machine-readable results are in [checks.json](checks.json).

## Result

The UX section now starts with a compact HTML-based assessment and a finding workspace. At wide content widths, a 280px prioritized queue sits beside one active finding. At narrower widths, a native finding selector precedes the active detail panel.

Each finding keeps its recorded explanation, structured observations or saved evidence, source link, and existing implementation steps together. Missing steps expose an explicit generation action without hiding the evidence. Category assessments, strengths, collection coverage, and manual browser follow-up topics sit below the main task in native disclosures.

Priority and area filters, selected finding, and open disclosures survive navigation within the same audit. A new analysisId/analyzedAt resets the workspace. Hidden sections remain unavailable to normal keyboard navigation and accessibility-tree queries.

Scores use the shared source-eligibility rules before applying the existing 30/25/25/20 weighting. Missing/invalid/uncited/legacy assessments are excluded, available weights are rebalanced, and valid zero scores remain zero. The UI, UX text plan, dashboard, and printed UX plan use consistent eligibility.

Complete-plan copy/download includes every retained finding regardless of selection or filters, recorded source observations, existing generated steps, and scope limitations. The printed report uses the same UX serializer, including occurrence-specific generated steps and legacy evidence.

## Main implementation files

- src/components/UXSection.tsx: scoped evidence-and-action workspace and report-local interaction state.
- src/components/UXSection.module.css: responsive workspace styling; unrelated shared UXReview.module.css consumers remain unchanged.
- src/lib/ux-presentation.ts: eligible assessment helper and complete plan serialization.
- src/components/TabPanel.tsx: retained UX mounting, recorded page URLs, and report-key reset.
- src/components/ReviewWorkspace.tsx: optional fix-step heading text, with the existing default preserved.
- src/components/PrintReport.tsx: complete UX plan included in print output.
- src/app/page.tsx: UX uses the existing compact specialist section heading.
- tests/ux-component.test.ts: existing UI assertions adapted to the new workflow.
- tests/ux-workspace.test.ts and ux-workspace-fixtures.ts: interaction/data-integrity coverage and isolated illustrative reports.
- scripts/verify-ux-ui.mjs: repeatable production-browser verification using isolated API interception.

## Checks performed

- `npm test`: **402 passed, 0 failed**. Existing extraction and verification tests remain in place; new tests cover selection/filtering, navigation retention/reset, structured-only evidence without steps, explicit generation/retry, disposed-request protection, valid zero/missing/source eligibility, duplicate occurrence export, legacy evidence, and download failure.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and static page generation. The final CSS adjustment was included in the production rebuild and subsequent browser run.
- Headless Chromium against the production app: **21 screenshots**, no uncaught page errors, and no unexpected API requests.
- Default layouts checked at 320, 390, 768, 900, 1024, 1280, and 1440 CSS pixels.
- Additional 720 CSS pixel / 2x device-pixel-ratio rendering, plus a separate 1024px stress test with workspace text doubled.
- No horizontal page overflow in the checked layouts, long-observation state, or enlarged-text stress state.
- Sampled visible workspace text contrast: minimum **5.32:1** in the automated checks, including expanded assessments/coverage. This is a scoped text check, not a complete accessibility audit.
- Keyboard Tab/Enter queue selection, visible focus, and explicit focus transfer to active details checked.
- Priority/area filters, filtered-empty reset, narrow-screen selector, selection retention, native disclosure retention, and new-report reset checked in Chromium.
- Full-plan copying checked through a controlled clipboard implementation, including explicit denial and an actionable text-download alternative.
- Actual Chromium text downloads checked at each default viewport; downloaded contents matched the complete copied plan even when filters were active.
- Explicit missing-step generation failure/retry checked using isolated provider responses. Evidence stayed visible and generated steps appeared in subsequent complete exports.
- Missing analysis, empty findings, all-unassessed criteria, valid zero scores, long observations, expanded evidence, clipboard failure, and generation failure/success states captured.

## Representative screenshots

All screenshots include an **illustrative test report** marker. These are controlled application UI checks, not live audits of bakery.example or evidence of visitor behavior.

- [Desktop, 1440px](default-1440.png).
- [Mobile, 390px](default-390.png).
- [Narrow mobile, 320px](default-320.png).
- [Expanded source evidence](expanded-evidence-1440.png).
- [Expanded assessment and coverage details](assessments-1440.png).
- [Filtered-empty state](filtered-empty-1440.png).
- [Missing-step generation failure](generation-failure-1440.png).
- [Enlarged workspace text](enlarged-text-1024.png).
- [Long recorded observation](long-observation-390.png).

## Scope and remaining limitations

The verification uses test-only fixtures and intercepted audit/fix-step responses. It does not call a live AI provider or perform a new review of an external website. Existing extraction/verification logic is exercised by the automated test suite; the audited website's layout, keyboard behavior, live destinations, and form submissions are not tested by this HTML-based report.

Clipboard success/denial was controlled rather than tested through an operating-system permission dialog. Actual browser text downloading was verified. The printed UX plan was verified at the component/serialization level; the native print dialog and a manually saved PDF were not exercised in this run.

The 720px/2x rendering and doubled workspace text are explicit responsive/text stress checks. They do not claim a manual browser-toolbar zoom test or full WCAG conformance. A screen-reader audit and assistive-technology user testing remain separate work.

No test fixtures or fixture routes were added to production application code. No live audit starts when this workspace opens, filters change, findings are selected, or plans are exported.

## Reproduce browser verification

Start the built application on a free local port, then set REVIEW_BASE_URL for that port and run:

```powershell
$env:REVIEW_BASE_URL = 'http://127.0.0.1:3002'
node scripts/run-with-ca.mjs --import tsx scripts/verify-ux-ui.mjs
```

The driver uses the existing cached playwright-core test dependency. Its header documents the optional isolated installation location. It does not add a production dependency.
