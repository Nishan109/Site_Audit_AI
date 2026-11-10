# SiteAudit AI: User experience analysis and redesign prompt

## Review basis

This brief is based on the current User experience implementation, its evidence and scoring helpers, report navigation, and existing test coverage. Files inspected include UXSection.tsx, UXReview.tsx, UXReview.module.css, UXEvidence.tsx, ux.ts, ux-presentation.ts, review-workspace.ts, dashboard.ts, TabPanel.tsx, and the UX component/model tests.

This is a source-based review. No fresh browser screenshots, live usability study, or new website audit were performed for this brief. Statements about layout describe the current component hierarchy and CSS; proposed improvements are design judgments to verify in the browser during implementation.

The deliverable is a copy-ready implementation prompt. This document does not itself change the application UI.

## What already works

- Findings carry priorities, explanations, source observations, and practical steps where available.
- The UX model distinguishes navigation, information structure, controls, and forms.
- Structured evidence can describe actual HTML declarations, including link destinations, heading levels, control names, and form fields.
- The source presentation already explains that declared destinations were not opened or tested.
- The model allows unassessed criteria and reweights available criteria instead of automatically treating missing assessments as zero.
- Copying and downloading a complete UX plan already exist, including a clipboard-failure alternative.
- Existing tests protect evidence interpretation, unassessed forms, unsupported visual claims, and browser-testing limitations.

## Current friction and proposed response

| Current implementation | Why it deserves attention | Redesign response |
| --- | --- | --- |
| A large introduction and score ring come before the findings. | Users must pass through interpretation and decoration before reaching a useful task. | Use a compact summary and bring the first supported finding into the first working screen. |
| Four substantial criterion cards and strengths appear before the finding list. | Secondary information competes with the next practical action. | Move detailed assessments and strengths below the working area in accessible disclosures. |
| Each finding can expand its own plan and evidence stack. | Reviewing several findings creates a long, repetitive page. | Use a compact finding queue and one active observation/action panel. |
| Structured findings with steps and findings without steps take different rendering paths. | Evidence and actions can be presented inconsistently depending on step availability. | Give every finding the same evidence-first detail structure; missing steps should affect only the steps area. |
| The toolbar filters by area only. | Users cannot directly narrow to high-priority findings or clearly reset several filters. | Add simple priority controls and a secondary area selector with explicit empty states. |
| UX is conditionally mounted when its report tab is active. | Local filters and open details reset after a visit to another section. | Preserve report-scoped UI state during navigation and reset it for a new report. |
| Some labels, descriptions, and controls use very small type. | Dense metadata and evidence are harder to read and scan. | Use readable body/control sizes and reserve smaller text for secondary metadata. |
| UXReview.module.css is shared by many other sections and evidence components. | A broad restyle can unintentionally change unrelated workspaces. | Introduce scoped UX workspace styles and audit any shared change. |
| The UX display and text plan call the raw score helper on saved criteria. | Older, invalid, or uncited criteria can be handled differently from the completed-audit dashboard. | Apply the shared eligibility rules before calculating or exporting the UX assessment. |
| Browser-testing limitations are primarily explained in a large lower module. | A user can encounter an HTML-based score or recommendation before understanding its limits. | Show one short scope label near the summary, then consolidate the full limits below. |

## Recommended direction

Make User experience an **evidence-and-action workspace**: choose a finding, inspect the recorded observation, understand the retained recommendation, review its implementation steps, and identify what still needs a real browser check.

Use the same visual family as the current Messaging workspace while giving UX its own useful content structure. The primary surface should explain observed navigation, structure, controls, and forms. It should not become another copy editor, a decorative score dashboard, or a simulated browser test.

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, interaction designer, UX writer, accessibility specialist, and front-end engineer.

Redesign and implement **only the User experience workspace** in the existing SiteAudit AI Next.js, React, and TypeScript application.

Deliver a professional, readable workspace with connected controls, faithful evidence, predictable navigation, and complete export behavior. Use the existing report data and specialist callbacks.

### 1. Define the task and protect the surrounding product

The main journey is:

1. Choose a retained UX finding.
2. Inspect what the collected HTML actually shows.
3. Understand the recorded explanation and recommended improvement.
4. Review existing implementation steps or explicitly request missing steps.
5. Open the source page and plan any remaining browser checks.

Preserve the landing page, completed-audit overview, app shell, global report identity/actions, Messaging, Search optimization, Conversion, Quick wins, AI visibility, Security, Accessibility, PageSpeed, research, and creative tools.

Keep existing collection, verification, cancellation, timeout handling, and protection against late responses. Do not alter audit prompts or verification rules merely to populate a redesigned screen.

Opening this section, selecting a finding, filtering, expanding evidence, copying, or downloading must not start a new AI review. Additional fix steps may be generated only through an explicit existing generation action.

### 2. Inspect the actual application before editing

Read applicable AGENTS.md instructions and relevant installed Next.js documentation before changing framework behavior.

Inspect these files in the current checkout:

- F:/marketing website/siteaudit-ai/src/components/UXSection.tsx.
- F:/marketing website/siteaudit-ai/src/components/UXReview.tsx.
- F:/marketing website/siteaudit-ai/src/components/UXReview.module.css.
- F:/marketing website/siteaudit-ai/src/components/UXEvidence.tsx.
- F:/marketing website/siteaudit-ai/src/lib/ux.ts.
- F:/marketing website/siteaudit-ai/src/lib/ux-presentation.ts.
- F:/marketing website/siteaudit-ai/src/lib/review-workspace.ts.
- F:/marketing website/siteaudit-ai/src/lib/dashboard.ts.
- F:/marketing website/siteaudit-ai/src/lib/types.ts.
- F:/marketing website/siteaudit-ai/src/components/ReviewWorkspace.tsx and its CSS module, including the exported ReviewFixSteps component.
- F:/marketing website/siteaudit-ai/src/components/ReviewEvidence.tsx and IssueCard.tsx.
- F:/marketing website/siteaudit-ai/src/components/MessagingSection.tsx and MessagingSection.module.css for the current specialist visual family.
- F:/marketing website/siteaudit-ai/src/components/TabPanel.tsx, navigation.ts, and src/app/page.tsx.
- F:/marketing website/siteaudit-ai/src/components/ReportHeader.tsx and PrintReport.tsx.
- F:/marketing website/siteaudit-ai/tests/ux-component.test.ts and ux.test.ts.
- Existing report-state, dashboard, shared workspace, export, and browser-verification tests and fixtures that exercise these paths.

Confirm source shapes, score eligibility, stable finding identity, generated-step ownership, and report lifecycle before implementation. Keep scoring and record normalization in library helpers rather than presentation components.

### 3. Replace the introductory stack with a compact working hierarchy

Use this order:

1. Existing report identity and global actions.
2. A compact User experience heading and scope summary.
3. Finding filters and the finding workspace.
4. Category assessments and recorded strengths.
5. Collection coverage, method, and remaining browser checks.

Retain the report domain as the page H1. Use one H2 for User experience and a logical heading hierarchy inside it. Avoid duplicate page introductions between the global specialist header and the workspace.

Suggested section description:

“Inspect observed usability signals and plan your next improvement.”

Use one compact summary surface rather than a promotional hero. Show only useful recorded values:

- HTML-based UX assessment, or “Not assessed”.
- Eligible criteria assessed, out of four.
- Retained finding count and its High-priority subset.
- Collected page coverage when available from the actual report.

Keep “Browser interactions not tested” visible near this summary. Place the existing full-plan copy/download actions in a compact secondary action group.

Do not introduce a large score ring, invented user-success metrics, a generic improvement percentage, decorative charts, or a second set of report-wide actions.

### 4. Use a compact queue and one active finding panel

At sufficiently wide available content widths, use:

- A finding queue approximately 260–300px wide.
- A wider active finding panel that receives the remaining space.
- No third assessment column.

Make layout decisions using the space left after the app sidebar and page padding. Around 960px of available workspace width is a starting point to verify, not a fixed viewport assumption.

Prefer coherent page scrolling. Avoid several small, independently scrolling panels or sticky elements that obscure focused controls.

Queue entries should show the actual finding title, priority text, review area, and selected state. Use a brief source-page label only when it helps distinguish similar records. Avoid repeating the full explanation in every queue item.

Selecting a queue item changes the active detail panel without generating content or changing the report. Use ordinary accessible buttons or another justified semantic pattern; do not add tab/listbox ARIA roles unless the corresponding keyboard behavior is implemented.

On narrow screens, provide a labeled native finding selector, an accurate selected position, and the active finding. A compact “Browse findings” disclosure may supplement it. Keep the active finding ahead of a long queue or assessment list.

### 5. Make the active finding explain an observation and an action

The active panel should contain:

1. Actual finding title, priority, review area, and source page.
2. A concise explanation using retained report text.
3. “Observed in the collected page” with faithful evidence.
4. “Recommended next step” using an existing step when available.
5. Remaining implementation steps.
6. Relevant browser-validation scope or a clearly labeled manual follow-up route.

Separate observed facts from AI interpretation and proposed actions. A recommendation is not a measured outcome, and a fix step is not evidence that the page was changed.

Do not rewrite findings into stronger claims or invent explanations when fields are missing. Avoid presenting the same detail paragraph, source observation, or first fix step twice.

An “Open source page” action must link to the recorded page. It must not claim to inspect the rendered page, execute a test, fix the website, or verify the recommendation.

If no steps exist, keep the complete evidence and explanation visible. Show a clear missing-step state with the existing explicit generation action where supported. Do not route the entire finding into a weaker evidence renderer just because its steps are missing.

### 6. Present structured evidence in plain language

Use UXSource, describeUXSource, and the existing observation parsing helpers. Support structured uxEvidence even when issue.evidence is absent.

Render the available source kind, location, source URL, and useful recorded fields as a readable description list. Examples:

- Navigation: recorded name, collected link count, and recorded labels.
- Heading: actual text and heading level.
- Link: recorded label, declared href, and fragment-presence observation where available.
- Button: recorded name, declared type, and disabled declaration.
- Form: recorded name, action, editable-question count, required-question count, and field labels.
- Field: recorded type, available naming information, required declaration, form ownership, help, or group information.

Show only fields actually present. Long URLs, labels, and technical values must wrap without horizontal page scrolling.

Keep raw JSON and lower-level metadata in a keyboard-accessible “Technical details” disclosure. Preserve original values in that disclosure; do not print opaque JSON as the primary explanation.

Support plain saved observations and legacy plain evidence honestly. Label them as recorded observations or saved evidence according to their actual format. Never turn a structured observation into a fabricated quotation from the website.

Keep these distinctions explicit:

- A name inferred from HTML is not a completed accessibility-tree or assistive-technology test.
- A declared link destination is not a destination that was opened and verified.
- A fragment absent from initial HTML is not proof that a JavaScript-powered link is broken.
- Counts of links or fields alone do not establish confusion, friction, abandonment, or poor usability.
- No form in the collected sample does not prove that a form is missing from the website or required for its purpose.
- Initial HTML does not establish actual mobile layout, clipping, spacing, contrast, touch targets, focus visibility, or successful interaction.

Do not add a fake device preview or screenshot. If an HTML outline is useful, derive every displayed heading/navigation item from retained sources and label it as a collected HTML outline, not a rendered page preview.

### 7. Keep prioritization and filtering simple

Preserve High → Medium → Low ordering and stable original order within each priority.

Provide priority filters All, High, Medium, Low, with counts from the full retained UX finding set and aria-pressed selected state.

Use a labeled area selector for All areas, Navigation & findability, Information structure, Controls & next steps, and Form clarity. Preserve an accessible “Other / earlier findings” route if records cannot be reliably assigned by uxIssueArea. Do not invent an area for legacy evidence.

Avoid adding search unless the actual finding volume justifies it. If included, label it “Search UX findings in this report” and search only retained titles, explanations, source pages, and area labels.

Show “Showing X of Y findings” with clear active-filter context and a Reset filters action. Full-report counts must not change when filtering.

Define selection behavior:

- Initially select the first retained finding in priority order.
- Preserve the selected finding if it still matches new filters.
- If it no longer matches, select the first matching record and communicate the updated selection appropriately.
- If nothing matches, show a filtered-empty state with Reset filters.
- If the report has no retained findings at all, show a different neutral state with routes to assessments and collection scope.

Do not say the site is issue-free when the finding list is empty.

### 8. Use stable identity and preserve the user's place

Use the shared reviewIssues/reviewIssueKey identity conventions for queue entries, selection, fix-step lookup, and callback updates. Preserve duplicate-occurrence keys where the existing helper supplies them.

Never identify a finding by its filtered position or title alone. Findings with the same title on different pages must remain independent. Exact duplicate records must not accidentally share transient selection/generation state when the existing identity layer distinguishes them.

UX currently unmounts when another report section is selected. Update lifecycle ownership deliberately so these states survive a round trip within the same report:

- Priority and area filters, and local search if added.
- Selected finding.
- Relevant expanded evidence/method disclosures.
- Existing generated fix steps and their correct finding associations.

Use the application's established report key based on analysisId or analyzedAt to reset this UI state for a new report. Do not leak a selection, filter, notice, or pending response into a different audit.

Use the existing retained-mount pattern or lift state to an appropriate report-scoped owner. Keep hidden sections out of keyboard navigation and the accessibility tree. Cancel pending generation on actual report disposal; if a request is deliberately cancelled on section change, present that state honestly on return.

Preserve the state of the other specialist, research, PageSpeed, and creative workspaces while making this change.

### 9. Align scores with the dashboard's source eligibility

Treat the current UX method as an HTML-based qualitative assessment. Do not label its score as observed visitor satisfaction, task success, accessibility compliance, or website performance.

Use shared eligibility rules from reviewedCriteria and dashboardModel before applying uxScore. Pass actual recorded page URLs through the existing data path where necessary so citations can be matched to collected pages.

Preserve the existing criterion weights:

| Criterion | Weight |
| --- | --- |
| Navigation & findability | 30 |
| Information structure | 25 |
| Controls & next steps | 25 |
| Form clarity | 20 |

Reweight eligible available criteria and round the final weighted result once. Keep calculation logic in shared helpers so the summary, criterion list, text plan, and overview agree.

Exclude missing, invalid, out-of-range, duplicate, uncited, unrelated-page, and legacy aggregate scores according to the existing model. Check method/version eligibility. Preserve a genuine eligible zero as 0; missing assessment must say “Not assessed”.

Do not penalize or award a perfect Form clarity score merely because no relevant form was collected. An unavailable criterion remains unassessed.

If a meter is shown, its fill must match the actual value. Do not use assessment scores as completion progress. Show eligible criterion coverage beside the overall assessment and explain the weighted calculation in a concise disclosure.

### 10. Move assessment detail and strengths below the task

Replace four large pre-finding cards with a compact secondary assessment list. Each of the four rows should show:

- Criterion name.
- Eligible score or “Not assessed”.
- Relevant retained finding count.
- Access to the recorded reason and source observations.

Do not imply that zero findings means a perfect category, or that an unassessed category failed.

Present recorded strengths in a modest disclosure or secondary module with their actual sources. Do not fabricate strengths to balance the report visually.

Retain a summary if useful, using the recorded summary and its sources. Keep it short in presentation without silently changing its meaning; make the complete recorded explanation accessible when abbreviated.

### 11. Consolidate scope and remaining browser checks

Use one secondary “Coverage and remaining checks” area rather than several repeated limitation cards.

Retain actual pages, observation coverage, sampling/truncation notes, and verification counts where supplied. Label pages, links, and source observations distinctly; source links must not become extra pages read.

Describe verification counts as checks against collected evidence. They are not numbers of browser tests, independently audited outcomes, or confidence percentages.

Show manual follow-up topics such as rendered mobile layout, keyboard/focus behavior, live destinations, form validation, and task completion as **not tested by this report**. Prefer the report's recorded unassessed topics; where a general method explanation is needed, label it as the method's scope rather than inventing report-specific findings.

An empty saved unassessed array must not imply that browser interactions were tested. Keep the method-level HTML-only limitation clear.

Any generic checklist is manual guidance, not collected evidence or a new supported finding. Do not add “passed” states without an actual testing flow and stored results. Keep security, accessibility, and PageSpeed results in their existing distinct workspaces.

### 12. Preserve explicit generation and complete exports

Reuse ReviewFixSteps or an equivalent scoped presentation that preserves its real callbacks, timeout handling, cancellation, failure, retry, and late-response guards.

Do not request steps automatically on selection or expand. Show loading only for the affected finding and prevent repeated concurrent requests. A failed request must retain the finding, evidence, and any already available steps.

Provide clearly named actions:

- Copy UX plan.
- Download UX plan (.txt).
- Optional Copy this finding, only if fully implemented and clearly distinct from the complete plan.

Complete-plan export must use every retained UX finding in stable priority order, irrespective of filters or active selection. Include available source observations, actual source URLs, retained steps including existing generated steps, eligible assessment values, and scope limitations. Preserve legacy plain evidence when structured evidence is unavailable.

Use a shared serializer rather than scraping the visible DOM. If per-finding generation keys change, update all relevant lookup/export consumers so generated steps appear under the correct record.

On clipboard success, announce completion. On denial/unavailability, show a visible actionable message and a working text-download alternative. Clear stale success feedback when a later operation fails.

Handle download exceptions and clean up object URLs safely after the download has been initiated. Do not claim the browser saved a file when the app only initiated its download.

Preserve the global print/PDF report behavior. Do not imply that a local UX-only export replaces the complete report export.

### 13. Apply a restrained, readable SaaS visual system

Match the current SiteAudit AI specialist workspace family:

- Workspace background: #F7F8FC.
- Working surfaces: #FFFFFF.
- Main text: #182236.
- Supporting text: #58657A.
- Violet action/focus: #7052E8.
- Soft selected background: #F0EBFF.
- Borders: #DDE3ED.

These are starting tokens. Verify actual text, control, selected, disabled, and focus combinations for contrast before delivery.

Use the existing Inter font and icon system. Suggested scale:

- Section heading: 24–28px.
- Active finding title: 20–24px.
- Queue titles: 14–16px.
- Body text and controls: 14–16px.
- Supporting metadata: 12–13px.

Use tabular numerals for comparable counts and scores. Keep comfortable line height, an 8px spacing rhythm, 20–24px major card padding, subtle borders, and restrained shadows.

Use violet for selected navigation, primary actions, and focus. Priority and availability need readable text labels, not color alone. Keep evidence visually neutral; a source observation should not automatically look like a warning or a passed test.

Avoid all-uppercase paragraphs, tiny letter-spaced controls, gradient score displays, oversized numbered rails, repeated nested cards, and decorative badges without useful meaning.

### 14. Design responsive reading and accessible interactions

Use this mobile order:

Heading and compact summary → filters/finding selector → active finding and observed evidence → steps → category assessments/strengths → coverage and remaining checks.

At narrow widths:

- Stack the main panel and supplementary modules.
- Wrap priority buttons or use an equally clear native control.
- Reflow metadata and action groups.
- Let long titles, labels, URLs, and observations wrap.
- Keep controls comfortably operable, preferably around 40–44px tall, and meet applicable WCAG target-size requirements.
- Avoid any horizontal page scrolling at 320px.

Use container queries where they help adapt to the content width after the sidebar. Test intermediate widths, not only standard viewport breakpoints.

Use semantic landmarks, logical headings, persistent labels, visible focus, native disclosures where suitable, and status announcements for copy/download/generation feedback. Use appropriate pressed/expanded states.

Keep keyboard focus predictable when selection changes; do not steal focus into a detail panel on every selection. Provide an accessible route to the active details if needed. When filtered content disappears, ensure focus remains on an available control.

Honor reduced-motion preferences. Avoid unnecessary menus, modals, hover-only controls, and animations. Aim for WCAG 2.2 AA; report what was actually checked rather than asserting complete conformance from an automated scan.

### 15. Keep implementation changes scoped

Create a UX-specific CSS module or narrowly scoped components for the new workspace. Do not globally restyle UXReview.module.css: Messaging legacy content, SEO evidence, Conversion evidence, AI visibility, Security, Accessibility, PageSpeed, and Quick win evidence currently import it.

Reuse existing primitives when their behavior fits. Add opt-in variants rather than silently changing shared evidence, fix-step, or export semantics.

Make only the necessary TabPanel/report-header adjustments for UX state retention and a compact heading. Preserve every ReportSection destination and working callback.

Avoid new dependencies, backend endpoints, data fixtures in production paths, or framework changes unless a concrete requirement justifies them. Keep test fixtures clearly isolated from live reports.

### 16. Verify real behavior and edge states

Preserve the existing UX extraction, verification, model, and component tests. Add focused checks for the behaviors introduced or changed by this redesign:

- Priority order and stable equal-priority ordering.
- Priority/area filtering, counts, reset, and filtered-empty versus report-empty states.
- Selection when filters hide the current finding.
- Same-title findings on different pages and duplicate-occurrence identity.
- Filters, selection, and relevant disclosures retained after section navigation.
- State reset for a different analysisId/analyzedAt.
- Structured evidence visible without plain issue.evidence and without fix steps.
- Honest legacy evidence and missing-analysis states.
- Eligible zero versus missing/invalid/uncited assessments; no-form criteria remain unassessed.
- Summary, criterion rows, dashboard, and text exports use consistent eligibility/calculation.
- Declared destinations and initial HTML observations never become tested-interaction claims.
- No automatic AI requests on open, filter, select, copy, or download.
- Explicit generation loading, failure, retry, cancellation, and stale-response protection.
- Complete exports regardless of filters and selected record.
- Clipboard denial with a working download alternative and honest download-failure feedback.
- Keyboard operation, focus visibility, announcement behavior, and hidden-section accessibility.

Run the appropriate tests, lint, and production build using the repository's scripts. Fix relevant failures caused by the change; distinguish unrelated preexisting problems.

Inspect browser screenshots at 320, 390, 768, 1024, and 1440px, plus intermediate content widths and enlarged text/200% zoom. Check empty, missing, filtered, selected, expanded evidence, loading, generation failure, and clipboard failure states as well as the normal report.

Use isolated clearly labeled fixtures for controlled UI states. Report fixture-based checks separately from any live URL review. A rendered fixture does not validate the audited website's usability.

### 17. Deliver a finished, reviewable result

Complete the implementation and connect all controls within the defined UX scope.

Deliver:

1. A concise explanation of the resulting workflow and hierarchy.
2. The relevant changed files.
3. Representative desktop and mobile screenshots.
4. Tests, lint, build, and browser checks actually performed.
5. Any remaining limitations, with a clear distinction between application UI verification and unperformed testing of the audited website.

Do not substitute a static mockup or a design-only proposal for the implemented workspace. Do not claim an interaction, export, audit, or accessibility check passed unless it was actually verified.
