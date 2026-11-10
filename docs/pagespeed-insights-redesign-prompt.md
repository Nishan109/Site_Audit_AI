# SiteAudit AI · PageSpeed insights redesign

## Review of the current section

I reviewed the PageSpeed component, device state, Google API request, Lighthouse import, local key dialog, and report exports. I opened the Acorn Bakery fixture in Chrome at 1440px and 390px. I inspected the ready, quota-limited, Google results, and Lighthouse import views using controlled responses. These observations describe the interface with sample data.

| What I found | Design response |
| --- | --- |
| A large introduction precedes the first useful control. On the 390px ready view, **Test mobile** began about 1,237px from the top of the report and the simulated quota message began about 1,380px down. | Put the URL, device, and test action at the top of the section. Place recovery directly beside the test controls. |
| The Google results view stacks field metrics, lab metrics, and finally optimization insights. The insights heading was about 2,091px down at 1440px and 3,967px down at 390px. | Give users a compact results summary and put a real optimization insight within easy reach. Use separate working views for longer diagnostics. |
| The imported report showed three unavailable field metric cards above its available lab data at both widths. | Show a compact **Lab only** scope note and surface the measurements the file actually contains. Keep missing field data accessible without an empty grid. |
| Copy and download live beside the Optimization insights heading, even though they export both device results. | Move export to the results toolbar and label its full scope. |
| Google tests, a browser-local Lighthouse import, and local key setup already work. The controls compete for attention, and quota recovery repeats the Google link. | Keep one primary action for the current state. Use a clear import action during quota recovery and group provider and developer actions separately. |

## Copy-ready implementation prompt

Act as a senior SaaS product designer, web performance specialist, UX writer, and front-end engineer. Redesign **PageSpeed insights** inside the existing SiteAudit AI Next.js, React, and TypeScript application. Implement it in the real `performance` report destination under **More checks**. Use the report’s existing measurements and preserve its Google test, Lighthouse import, and local API key flows.

Design around a practical sequence **Choose a device → obtain measurements → understand the source → investigate one improvement → verify under comparable conditions**. A visitor should immediately see what page and device are in scope, whether a result exists, and how to proceed if Google pauses requests. A developer should be able to inspect the underlying metric, run conditions, and optimization evidence.

### 1. Read the existing contracts

- Read the applicable `AGENTS.md` and the installed Next.js documentation before changing framework behavior.
- Inspect `PageSpeedSection.tsx`, its CSS module, `usePageSpeedResults.ts`, `TabPanel.tsx`, `navigation.ts`, and `src/app/page.tsx`. Trace the reviewed URL, `analysisId || analyzedAt`, and report update callback.
- Inspect `pagespeed.ts`, `pagespeed-measurement.ts`, `pagespeed-presentation.ts`, `lighthouse-import.ts`, the server request helper, and `/api/pagespeed`. Use the normalized `PageSpeedReport` and existing display helpers as the source of truth.
- Inspect `/settings/pagespeed`, `/api/pagespeed/key`, the local key writer, and `scripts/run-with-ca.mjs`. Preserve localhost development gating, same-origin checks, password field, server-only storage, and the cross-tab notification.
- Inspect `dashboard.ts`, `PrintReport.tsx`, `pagespeed-fixtures.ts`, and the PageSpeed model, component, and key tests. Use the redesigned Accessibility and Security workspaces as visual and interaction references.

### 2. Put the measurement controls first

Keep the shared report identity and **All findings** navigation. Replace the promotional hero with a compact **PageSpeed insights** heading and one sentence such as “Measure this page, understand the results, and choose what to investigate first.”

Use a single measurement control surface at the top of the workspace. Show the audited page URL or path, with a safe link to the full address. Preserve the query when it distinguishes one page from another. Show the final tested address separately when the recorded result redirects. Keep the shared report creation time distinct from the PageSpeed test time.

Place **Mobile** and **Desktop** in a labeled segmented control with a visible selected state. Indicate available results using text such as **Result available** or **Lab result**, with an accessible equivalent if a compact badge is used. Each device opens its own measurements and timestamps. A change of device updates the primary action immediately and leaves the other device’s result available.

Use one prominent **Test mobile** or **Test desktop** action for the ready state. Use **Retest mobile** or **Retest desktop** when a result exists so the action is distinct from the report-wide **Run again**. Place **Import Lighthouse JSON** beside the test action as a secondary entry point. Make it the most useful enabled action while a quota cooldown blocks Google tests. Keep the Google report link available once in the active context. A link generated from the page and device opens PageSpeed Insights for that target. Present it as a separate provider view since the app does not store an immutable external link to the same run.

When either device has a validated result, put **Copy results** and **Download results (.txt)** near the top. Label exports as including all available device results, including when the selected device has yet to be tested. Keep a clear text label for the download so users can find it after a clipboard error.

### 3. Summarize the selected result without overloading it

Use a compact, responsive summary that answers four questions. **What was measured?** Show the device, tested page, and source. **How recent is it?** Show the original run time. **What is the lab score?** Show the stored score or **Unavailable**. **Is real-user data available?** Show the actual field scope and the recorded Core Web Vitals state.

Use visible source labels **Google PageSpeed Insights** and **Imported Lighthouse JSON · Lab only**. Keep the label with the data in the summary, detail views, and exports. Use `fetchTime` for the recorded test time when valid. Identify `analyzedAt` separately as collection time if it adds useful context. An imported result retains its original Lighthouse test time. If a retest is pending or fails, keep the previous timestamp and label the displayed result **Previous result**. Preserve a genuine score of zero. Display an unavailable score as text with no zero-valued gauge. If a meter is used, use the actual value, a 0–100 range, and an accessible name that identifies the device and Lighthouse lab scope.

Treat the lab score as one controlled Lighthouse run. Keep it out of the marketing assessment and Core Web Vitals verdict. Use the normalized field scope **Page-level**, **Origin-level**, or **Unavailable**. Origin-level values describe the origin’s eligible visits. Explain partial field data in one sentence when LCP, INP, or CLS is missing. Full field assessment requires all three from the same dataset. Use the existing **Good**, **Needs improvement**, **Poor**, and **Unavailable** labels where applicable, with text alongside color. [About PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about), [Web Vitals](https://web.dev/articles/vitals), [Lighthouse scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).

For a fresh device with no result, use one neutral empty state below the controls. Explain what a test will measure and offer the test or file import. Leave scores and metric cards out until a valid result exists. Google may return lab data without usable field data, so make that an ordinary supported state. [PageSpeed API documentation](https://developers.google.com/speed/docs/insights/v5/get-started).

### 4. Make the next investigation easy to find

Immediately after the summary, show a **First to investigate** entry for the first retained `opportunities` item in the existing order. Show its actual title, a short excerpt from its recorded description, and the most useful estimate if supplied. Call this a starting point for investigation. Keep milliseconds, bytes, and CLS values distinct, preserve the exact basis of each estimate, and avoid combining savings. If the first item has no estimate, show its recorded description with a neutral diagnostic label.

Provide an **Inspect insight** action that reveals and focuses the exact row in the **Optimization insights** view. Use opportunity `id` within the selected device and report for stable identity. Keep list order consistent with the retained results. For long lists, offer a **Show all insights** control after the first few records and reveal a linked row even when it falls beyond the initial limit. An empty insights list should say that this run returned no optimization insights and provide a route to the measured metrics.

Each insight detail should include the recorded description, any provided display value, and labeled time, transfer, or metric-specific estimates. Treat provider text as inert text. Separate investigation instructions from provider evidence. For a Google result, provide the existing link to investigate in PageSpeed Insights. For an import, direct users to the original Lighthouse report for affected resources. Do not invent URLs, affected resources, expected score increases, or guaranteed gains. Estimates may overlap. Preserve provider warnings separately from opportunities.

### 5. Separate diagnostics into useful views

Use three compact view controls **Optimization insights**, **Lab measurements**, and **Real-user data**. Show the active view directly below the controls. Default to Optimization insights when the result contains them. Otherwise open Lab measurements when usable lab data exists, or Real-user data for a field-only result. Preserve an explicit user view choice when the device’s result remains available. Use pressed controls with labeled sections or fully implement the keyboard behavior of ARIA tabs. Do not show an unavailable view as a disabled dead end. A compact explanation can still be opened.

- **Lab measurements.** Show LCP, FCP, CLS, TBT, and Speed Index using `LAB_METRICS`, the normalized values, and their current ratings. Display each metric’s plain-language meaning. Keep Lighthouse version, form factor, throttling method, test time, and recorded notes in a **Test conditions** disclosure. Explain that repeated runs can vary. When lab measurements are unavailable but field data was returned, show a brief reason from the available provider notes and keep the field view useful.
- **Real-user data.** Lead with scope and assessment, then show the recorded field LCP, INP, and CLS. Explain the 75th percentile and 28-day collection context when the provider returns eligible data. Put dataset ID, field FCP, and field TTFB behind an explicit disclosure. For partial data, show available values and identify which metrics are missing. If the result has no usable field data or is an imported lab report, show one small empty state with source-specific copy and a route to the lab view. A field-only supporting metric should remain visible even when none of the three Core Web Vitals is available.
- **Units and accuracy.** Preserve the normalized metric ratings and numbers. Keep CLS unitless and time metrics in ms or s as appropriate. Use enough precision near thresholds to avoid showing an apparently identical value with a contradictory rating. Use the existing conversion of scaled CrUX CLS. TBT remains a lab metric. The Lighthouse server-response-time audit does not supply field TTFB. Keep page and origin datasets separate. [About PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about), [Web Vitals](https://web.dev/articles/vitals).

### 6. Design test, quota, and import states as part of the workflow

Keep the real `/api/pagespeed` request and its validation, cancellation, and timeout behavior. Opening the section or changing the device must not run a new test automatically. Use a single live status such as “Testing mobile with Google PageSpeed Insights” while a request is pending. Provide **Cancel test** in the same location and prevent duplicate requests. Preserve previous measurements during pending, cancelled, failed, or timed-out retests. Avoid percentages, simulated stages, or a promised completion time for an upstream test with no progress API.

For `PAGESPEED_QUOTA`, put a compact status and recovery actions directly below the device control. Use the returned cooldown countdown and respect `Retry-After` across both devices. Keep the server’s cooldown authoritative, including its default delay when Google omits the header. Expiry enables a manual retry. Do not promise Google’s quota will be available at expiry. Keep file import enabled during cooldown. Distinguish quota, configuration, timeout, and invalid measurements with actionable copy. If previous measurements exist, keep them visible with their original source and timestamp.

Make the Lighthouse fallback clear in three steps. **Open the reviewed URL in Chrome.** **Run a Lighthouse Navigation test with Performance selected and the matching device.** **Save as JSON and import it.** Place the instructions near the import action as a short disclosure, with the official Chrome guide for detail. Preserve the existing 10 MB limit and browser-local parsing. Validate the exact reviewed page relationship, device, completed run, original timestamp, and usable performance measurements. A rejected file should explain what to correct, let the user choose again, and preserve any previous result. Report when parsing is underway and announce successful import once. Imported files are labeled lab-only, with field values unavailable. [Chrome Lighthouse JSON export guide](https://developer.chrome.com/docs/lighthouse/overview#share-reports-as-json).

Keep **Configure API key** available where the existing local setup page is authorized. Place it under **Developer setup** or a quieter action near quota and configuration help. Preserve the existing password field, localhost-only development access, same-origin write restrictions, server-only `.env.local` storage, and notification to the original audit tab after saving. Open setup without discarding the user’s active audit. Keep the Google Cloud setup link useful for hosted deployments and direct administrators to server configuration when the local dialog is unavailable. Do not expose a key in client state, URLs, result data, exports, logs, or browser storage beyond the transient masked input and its existing submission. Saving a key should enable a manual retry through the existing flow. [Google PageSpeed API setup](https://developers.google.com/speed/docs/insights/v5/get-started).

### 7. Preserve report state, validation, and exports

- Keep one current validated result per device in `pageSpeedReports`. Preserve the existing `onPageSpeedUpdated` guard for the matching audited URL and report identity. A valid Google result or import replaces that device’s current result, leaving the other device’s result available.
- Retain device, active view, selected insight, and expanded evidence when users navigate to another section and return within the same audit. Keep view choices scoped to the device. Reset on a new `analysisId || analyzedAt`. Preserve cancellation on device change and on report replacement. Late responses and stale file reads must not overwrite a different device or report.
- Apply consistent availability validation in the workspace, dashboard, and export. Validate the result schema, report URL, and device key. A valid zero differs from unavailable measurements. Empty, invalid, or mismatched records must not become evidence or a status of results collected.
- Preserve `pageSpeedPlan` for complete copy, text download, and print/PDF. Include both available device results regardless of active view, all retained metrics and units, source, timestamps, field scope, assessment, warnings, optimization insights, and estimate limitations. Keep print wrapping and pagination for long URLs and provider text. Continue to use the shared browser print flow.
- Announce clipboard and download feedback. Keep text download available after clipboard denial. Avoid leaking the local key, raw imported JSON, or unsupported claims into any export. Do not add fabricated results, trend graphs, network timings, or site-wide conclusions.

### 8. Apply the product visual system and verify it

Match SiteAudit’s Inter typography, neutral workspace background, white working surfaces, slate text, and violet actions. Use an 8px spacing rhythm and readable body text. Keep the section dense enough for work while separating the main action from diagnostics. Use tabular numerals for scores and measurements, muted labels for supporting context, and semantic status colors with words. Replace decorative whitespace with useful context. On narrow widths, reflow the controls and summary before they crowd. Keep the device and main action ahead of the result details, allow long URLs and evidence to wrap, and avoid horizontal overflow. Use scoped CSS and adapt to the content width after the report sidebar.

Use a logical heading structure, persistent labels, keyboard-operable controls, visible focus, native disclosures where appropriate, and restrained motion. Check focus when revealing an exact insight, closing the local key dialog, retrying a failed test, or dismissing an import error. Use scoped status announcements and avoid reading the countdown every second. Keep disabled and enabled actions distinct through text and semantics. Target WCAG 2.2 AA for this workspace and verify contrast in actual states. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Run the existing PageSpeed tests and add focused regression coverage for changed interactions. Verify the normal report path, the dashboard’s availability state, and the following scenarios with controlled fixtures:

- Ready mobile and desktop, independent measured results, and a navigation round trip within one audit.
- Google data with page-level, origin-level, partial, and unavailable field coverage. Cover field-only results, lab-only results, and a valid zero score.
- A pending retest, cancellation, timeout, malformed response, stale response, and failed retest that leaves an earlier result visible.
- A quota cooldown across both devices, its expiry, and a successful import while the Google action is blocked. Cover a correct file and wrong page, device, format, and size failures.
- Local key setup, cancel, successful confirmation, return to the existing report, and availability of the action only in the authorized environment. Use isolated test values and never modify real credentials during testing.
- Exact insight navigation, long evidence and URLs, no-insight states, complete copy and download from a different active view, clipboard denial, and print pagination across both device results.

Run tests, lint, and the production build. Inspect the ready, results, imported, and quota states at 320px, 390px, 768px, 1024px, and 1440px, at an intermediate width near the sidebar breakpoint, and at 200% zoom. Deliver the working redesign, representative desktop and mobile screenshots, the checks actually performed, and any remaining verification limits. Label fixture data as illustrative.
