# SiteAudit AI · Accessibility checks redesign

## Review of the current section

I reviewed the section component, its report navigation, the HTML check builder, the independent refresh endpoint, and the export path. I opened the existing two-page Acorn Bakery fixture in local Chrome at 1440px and 390px. The browser used a controlled report response. No public website was fetched or audited.

| What I found | Design change |
| --- | --- |
| The page opens with a large overview, a separate refresh strip, and nine HTML check cards for the selected page. In the fixture, the review plan heading started about 2,394px down the desktop page and 2,947px down the mobile page. | Use a compact summary and open the prioritized review plan by default. Give the HTML inventory a separate view. |
| The `/about` selection returned to `/` after visiting User experience and coming back at both widths. The section unmounts on navigation and stores the selected page as an array index. | Keep the workspace state for the same audit and identify pages by their source URLs. |
| Clicking Refresh resets the page and filters before the request finishes, even though the hook retains the last valid evidence. | Keep the current view and selection during collection. Reconcile them after a successful update. |
| The page picker displays the path but drops the query, and generated check IDs include the page's position. | Make query variants distinguishable and use the source URL plus check key for cross-links and selection. |
| The summary's total check count includes records for pages whose detailed evidence was unavailable. The printed plan also reads the optional review directly while the interactive view validates it. | Separate collected coverage from scoped check records. Apply the same availability validation to the workspace, dashboard, and exports. |

## Copy-ready implementation prompt

Act as a senior SaaS product designer, accessibility UX specialist, UX writer, and front-end engineer. Redesign the **Accessibility checks** workspace in the existing SiteAudit AI Next.js, React, and TypeScript application. Implement the design in the real `accessibility` report destination under **More checks**. Preserve the rest of the report navigation and the existing audit, refresh, and export flows.

Design the workspace around the sequence **Choose a review task → inspect the evidence → make a change → verify it in a browser**. A user should be able to identify the first practical step without reading the full HTML inventory. A developer should be able to trace every review task to its exact check and source page. A reviewer should see which tests remain manual even when the collected HTML has zero tasks.

### 1. Inspect the existing implementation

- Read the applicable `AGENTS.md` and installed Next.js documentation before changing framework behavior.
- Inspect `AccessibilitySection.tsx`, `AccessibilitySection.module.css`, `useAccessibilityResults.ts`, `TabPanel.tsx`, `navigation.ts`, and `src/app/page.tsx`. Follow the submitted URL and report identity from the parent through refresh and export.
- Read `accessibility.ts`, `accessibility-refresh.ts`, `accessibility-presentation.ts`, and the `AccessibilityAudit` type. Inspect `src/lib/server/accessibility.ts`, `accessibility-evidence.ts`, the refresh service, and `src/app/api/accessibility-checks/route.ts` to understand how checks, counts, evidence rows, and limitations are produced.
- Use the recently redesigned `SecuritySection.tsx`, `SecurityPageSignals.tsx`, and `useSecurityResults.ts` as references for visual density, same-report navigation, and active-only refresh. Keep accessibility terminology and states specific to this workspace.
- Inspect the dashboard's availability check, `PrintReport.tsx`, and the accessibility fixtures, component tests, refresh tests, and verification script. Reuse the existing fixture coverage when testing the redesign.

### 2. Create a compact, useful entry point

Retain the shared report header and report actions. Use **Accessibility checks** as the section heading with one plain-language description, such as “Review the accessibility signals in the collected page HTML and see what to verify in a browser.” Keep the report identity and submitted URL in the existing header hierarchy.

Use a compact summary surface with these items, when available:

- **Pages with HTML evidence** using `review.scope.collected`. Show total pages in scope separately when coverage is partial.
- **Review tasks** from `accessibilityActions(review)`. Count every eligible task once, including tasks on different pages with the same title.
- **Last collected** using the independent refresh's `checkedAt` when available. Show `fetchedAt` alongside each source page. For an original snapshot, use accurately labeled page collection times. Preserve the report creation timestamp in the shared header.
- A small **HTML observations** scope label and a **Manual testing guide** jump link. Show a sampled-evidence note when `review.scope.sampled` applies and repeat it for the relevant page only.

Use **Refresh checks** as the section's collection control. Separate it from **Run again** in the shared report header. Put **Copy review plan** and **Download review plan** together in a secondary action row for an available report. Use full labels where space allows and accessible names everywhere. Keep task selection as the primary working action once evidence is present. Avoid a promotional hero, decorative gauge, accessibility score, passing percentage, compliance badge, or certification language.

Distinguish **Review plan** and **Page checks** using compact labeled controls with clear selection. Put the active working panel immediately after them in DOM order. Place the manual testing guide after the working panel and make it reachable from the summary and task detail. Keep supporting notes in targeted disclosures.

### 3. Make the review plan the default

Use `accessibilityActions(review)` for eligibility and priority order. A task requires both a priority and existing steps. Keep High, Medium, and Low ordering with the recorded order within each priority. Preserve the four real areas and use readable labels such as **Content & alternatives**, **Navigation & names**, **Form labels**, and **Structure & relationships**.

At wide content widths, show a task list and a single selected detail in adjacent columns. Make the list compact enough to scan. Each row shows the retained title, priority, and source page. Add the area when it helps distinguish similar titles. Select the first eligible task when the workspace opens and visually mark it as the starting point. Use an area filter with counts and a clear reset when needed. For longer lists, show about five tasks initially and provide **Show all tasks**. An automatically selected or linked task must be visible even when it falls beyond that initial limit.

Use a labeled task picker or stacked selection and detail at narrow widths. Keep the selected detail near the picker so users can move between tasks without traversing a long list. The detail should include:

1. **What to review** with the actual task title, priority, area, and `detail`. Describe priority as a review recommendation within the collected scope.
2. **Evidence from the page** with the exact source URL, page timestamp, labeled `observations`, and check `context`. Render values as text. Use a disclosure for lengthy evidence while keeping a meaningful recorded observation visible.
3. **How to address it** with the existing numbered `steps`. Preserve their order and distinguish suggested changes from observed facts.
4. **How to verify** with the relevant manual step from the task or the manual guide, and **Related W3C guidance** from `reference`. Add an **Inspect source check** action to reveal the corresponding Page checks entry.

Handle an available report with zero tasks using copy like “These HTML checks identified no review tasks in the collected sample. Use the manual testing guide to assess keyboard access, screen-reader behavior, and visual states.” Link to Page checks and the manual guide. For a filter with zero matches, keep the report total visible and offer **Reset filters**. Keep unavailable collection distinct from a valid zero.

### 4. Make page checks traceable and accurate

Show a labeled **Page to inspect** selector for multiple pages. Include the path and meaningful query string so distinct pages are recognizable. Show the exact source URL as a safe, accessible link in the page context. Distinguish the requested URL from the collected destination when a redirect is recorded. Show page-specific `fetchedAt`, `collected`, and `sampled` state. When detailed evidence is unavailable, label the placeholder records as **Not assessed** and provide a route to refresh.

Use compact expandable rows or grouped lists for the nine existing check keys. Each row presents its title, status, short explanation, and a clear evidence disclosure with the retained values, scope context, and W3C reference. Offer **View review steps** only for the same eligible records used in the task list. Label the status filter and count results against the current page. Keep the page selector and a scope-specific empty state available while filtering.

Use the actual `ACCESSIBILITY_STATUS` values and explain them once. **Observed** means the collector found the described markup signal. **Review** means a recorded observation merits contextual review. **Not observed** means the relevant signal or element inventory was absent in the collected HTML for that check. **Not assessed** means the necessary detailed evidence was unavailable. Keep status separate from task priority. Use text with color and icons, and reserve reassuring language for what the evidence actually establishes.

Use the existing check definitions and preserve these distinctions:

| Check | How to present the evidence |
| --- | --- |
| `language` and `title` | Show the recorded declaration or title inventory. Language-tag validity, pronunciation, and title quality require separate review. |
| `headings` | Show the recorded outline and structural observations. A first H2 or multiple H1s alone should not become new defects. Discuss any recorded level skips in context. |
| `images` | Keep missing alternatives and intentionally empty alternatives distinct. The image's purpose and the quality of its alternative require human judgment. |
| `fields` | Show detected label candidates and flagged elements. A placeholder alone does not provide a persistent label. Keep field values out of evidence and exports. |
| `controls` and `links` | Describe names detected in the HTML as candidates. Verify computed names, roles, and behavior in the browser. Preserve the difference between an image-only control's name and the image's own alternative. |
| `references` | Identify collected naming and description references with missing or ambiguous targets. A target may appear after scripts run. Do not turn every duplicate ID into a WCAG failure. |
| `regions` | Show main and navigation declaration counts. The rendered landmark tree, landmark names, and bypass mechanisms require verification. |

Preserve the existing collector's bounded evidence and full counts. Tell users when they are seeing a retained sample. Keep the submitted HTML as inert text. Do not add a rendered DOM scan, CSS contrast calculation, an AI request, or new findings as part of this UI redesign.

Use `sourceURL` or the existing equivalent for credential-free HTTP(S) source identity. Preserve query parameters and ignore fragments for identity. Use the canonical page URL plus `AccessibilityCheck.key` to track the same record after reordering, even if generated IDs change. When the user selects **Inspect source check**, switch views, select the exact page, reveal the matching row, clear any filter that hides it, and move focus to it. When the user selects **View review steps**, select and focus that exact task using the same identity. Avoid links to a heading or a similarly named task on the wrong page.

### 5. Present manual testing as a clear follow-up

Use a visible **Manual testing guide** heading with a plain label such as **Requires browser testing**. Make each of the existing `review.notTested` items easy to open and follow. Use `ACCESSIBILITY_MANUAL_CHECKS` for the scope-only state. Preserve these five areas:

- **Keyboard access and focus.** Complete a real task with the keyboard. Check order, visible focus, traps, and menu and dialog behavior.
- **Screen-reader names and announcements.** Inspect the browser accessibility tree and test names, roles, state changes, and form errors with assistive technology.
- **Contrast and visual states.** Measure rendered text, controls, and focus indicators in the relevant states and themes.
- **Zoom, reflow, and target size.** Try narrow layouts, zoom, touch, and content that appears on hover or focus.
- **Meaning, alternatives, and complete journeys.** Review alternative text, captions, relationships, instructions, validation, and important end-to-end tasks.

Describe these as instructions for the person reviewing the site. Keep checklist items out of the automated result totals. Avoid a completion indicator that implies a manual test ran. Explain the boundary between static markup collection and a conformance evaluation using concise copy. Target WCAG 2.2 AA for the SiteAudit AI interface itself and verify its interactions independently of the inspected website. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI evaluation tools overview](https://www.w3.org/WAI/test-evaluate/tools/).

### 6. Preserve collection, navigation, and export behavior

- Keep the real `POST /api/accessibility-checks` flow, response validation, timeout and cancellation, URL validation, no-cache behavior, and report-scoped `onAccessibilityUpdated` callback. A refresh collects fresh page HTML independently of the full audit. It needs no Gemini credentials.
- Validate the snapshot using the existing accessibility result schema and requested URL relationship. Reuse a shared validated result across the section, dashboard, and print plan. Legacy booleans, old scores, partial payloads, and mismatched URLs must not appear as collected evidence.
- With valid evidence, make opening the section read-only. For a missing snapshot, preserve automatic collection on first active visit. A hidden section must make no request. Provide loading and actionable retry states. Allow a first collection cancelled by navigation to resume on re-entry. After a failure, keep the error available with an explicit retry instead of repeatedly fetching on navigation.
- While refreshing, retain the last valid timestamp, tasks, filters, selection, and exports. Show a concise status explaining that previous evidence remains available. Prevent duplicate requests. If the request fails, show the real safe error and retain the previous result. On success, replace the snapshot atomically and retain the selected page and task where their identities remain. If a selection disappears, choose a visible eligible fallback and explain the change when it affects the user.
- Preserve view, page, task, filters, and open evidence during a round trip to another report section. Key this state by `analysisId || analyzedAt`. Use the existing report-scoped mounting pattern or equivalent state placement. Abort pending collection when leaving or changing the report, and reject late responses before committing them to a different audit. Keep changes to evidence, execution log, and source links consistent with `applyAccessibilityRefresh`.
- Retain `accessibilityPlan` as the full export path. Include the actual source pages and timestamps, coverage and sampling, all tasks and their steps, recorded observations and statuses, relevant guidance, and the complete manual testing checklist. Copy, text download, and print must be independent of selected tabs and filters. Preserve zero tasks and scope-only print output for unavailable results. Avoid claiming availability in print if the shared validator rejects the snapshot.
- Announce copy and download feedback once. If clipboard access fails, tell the user and leave the download immediately accessible. Make long URLs and evidence wrap across print pages. Preserve the shared PDF flow through the browser print dialog.

### 7. Apply the visual system and verify interactions

Match the established SiteAudit AI workspace with Inter, white cards on the neutral background, readable ink and slate, violet actions and focus, and restrained borders. Use comfortable body copy, clearly distinguished metadata, and roughly 8px spacing increments. Let the selected task and its evidence drive visual emphasis. Keep counts tabular. Use scoped styles and size layouts to the actual content width after the sidebar. Stack the task list and detail before either becomes cramped. Allow filters to wrap and ensure a long URL, DOM locator, or evidence value cannot push the page wider than the viewport.

Use semantic headings and persistent labels, predictable keyboard order, and visible focus. Use native controls and disclosures where practical. Apply correct pressed or selected state and accessible names to view controls and filters. Keep the manual guide and selected evidence operable by keyboard. Announce collection and export status with a scoped live region. Focus cross-linked records after the destination is visible. Honor reduced motion and check contrast in selected, hover, focus, muted, and status states.

Verify through the actual report entry point with isolated fixtures. Cover valid multi-page evidence, missing details on one page, sampled evidence, a valid zero-task report, invalid or legacy snapshots, and long source URLs with distinct queries. Verify the task order, status and area filters, filter reset, exact cross-links after reordering, same-report state retention, and new-report reset. Check that a hidden or ready workspace makes no collection request. Exercise refresh success, timeout, cancellation, stale response, retry, malformed response, and failed refresh with last-known evidence retained. Check complete copy, download, and print after filtering, including clipboard denial and no private form values.

Inspect desktop and mobile at 320, 390, 768, 1024, and 1440px, at a width near the sidebar breakpoint, and with 200% zoom or equivalent text enlargement. Check keyboard navigation, focus after cross-links, reading order, contrast, wrapping, and print pagination. Run the applicable accessibility component, model, refresh, and report tests, lint, and production build. Deliver the implemented workspace, representative screenshots of both views, the checks actually run, and any remaining verification limits. Label fixture results as fixtures.
