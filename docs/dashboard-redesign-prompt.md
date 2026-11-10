# SiteAudit AI: dashboard analysis and redesign prompt

## Review basis

This brief is based on the current DashboardOverview component and CSS, AppShell and report navigation, the report composition in src/app/page.tsx, dashboardModel/dashboardPlan, AuditEvidence, AgentLog, PrintReport, and the dashboard model/component tests. Existing desktop and mobile preview images were inspected for visual context. Those previews contain test data and an older surrounding shell; the current navigation code is authoritative for the shell. This task prepares a redesign brief and does not implement dashboard changes.

## What works today

- The overview derives category assessments and finding counts from a shared, tested model.
- Findings retain source evidence, priority, category relationships and links to detailed reviews.
- Missing assessments are excluded rather than converted to zero, while a genuine zero remains valid.
- Coverage distinguishes collected pages, source links, research and separately collected checks.
- Copy, text download and print/PDF use the underlying complete report instead of a filtered screen subset.
- Report destinations are already available, with additional checks and creative tools grouped in the current sidebar.

## Main UI findings

| Observation in the current implementation | Design implication | Recommended response |
| --- | --- | --- |
| A large introductory panel and circular assessment occupy the top of the overview. | A returning user spends screen space on an explanation before reaching a concrete finding. | Replace the introduction with a compact snapshot and a prominent first action. |
| Category assessments precede the findings column in DOM order; container breakpoints stack the columns below 850px. | Tablet and mobile users reach all five category rows before reaching the primary task list. | Put the first action and findings before the category breakdown in reading order. |
| The category and finding columns receive equal width. | Short category summaries occupy as much horizontal space as longer, actionable findings. | Give findings approximately two-thirds of the working area and use a compact assessment rail. |
| Evidence context and the first suggested step are inside “Why this is listed”. | The next action is less visible than the finding title. | Surface a short reason and first step, with full evidence available in a deliberate disclosure. |
| Many labels, controls and descriptions are 10–12px. | The interface can be difficult to scan, particularly on a dense report. | Establish 14–16px body and control text with 12–13px reserved for metadata. |
| Copy/download controls, report export, coverage notes and research explanations appear in several places. | Related actions and explanations compete for attention. | Establish one clear export entry point and one canonical coverage/detail area. |
| Broad lavender styling is used for many unrelated surfaces. | Status, navigation, assessment and decoration have limited visual distinction. | Use violet for focus and selection, with semantic status colors and stronger neutral text. |
| The overview omits a short, specific explanation of where to begin. | Users must compare category scores and priority rows themselves. | Highlight the first retained finding with evidence, scope and a practical next step. |

These are design judgments based on the current implementation and previews. They do not establish a measured effect on task completion or conversion.

## Reference principles

- [Linear filters](https://linear.app/docs/filters): narrowing a working list to relevant items. Adapt simple filtering to this single report without importing an advanced workflow builder.
- [Stripe Dashboard basics](https://docs.stripe.com/dashboard/basics): overview information, actionable notifications and navigation into detailed resources. Adapt the summary-to-detail relationship to an audit snapshot.
- [Vercel project overview](https://vercel.com/docs/projects): keep the current entity and its status clear while providing routes into detailed information. SiteAudit AI's report remains a recorded snapshot rather than a continuous monitor.

## Copy-and-paste implementation prompt

Act as a senior SaaS product designer, information architect, UX writer, and front-end engineer. Redesign the completed-audit dashboard and overview for SiteAudit AI. Implement the result in the existing Next.js, React and TypeScript application.

Create a polished, highly readable workspace that helps a business owner understand their report and decide what to improve. Bring the dashboard into the visual family of the new landing page while giving it the density and hierarchy appropriate to a working application.

### 1. Scope and product purpose

The dashboard represents a completed review of a submitted public website URL. It summarizes five qualitative content/HTML assessments: messaging and copy, user experience, search optimization, conversion clarity, and AI content readiness. It connects supported findings to collected evidence and practical suggestions.

Security signals, accessibility observations and PageSpeed measurements have their own scope and collection state. Competitor research is available only when real research was recorded. Creative tools are separate workspaces.

The central flow is: understand this report, choose a finding, inspect its evidence, and open the relevant next step.

Focus implementation on the overview, its report header, relevant shell/navigation styling, evidence disclosures and export access. Keep the recently redesigned public landing page and the specialist workspaces functional. Reuse existing data and callbacks throughout.

### 2. Experience goals

Within the first screen, users should identify:

- Which website and exact submitted page this report concerns.
- When the audit evidence was collected.
- The scope and availability of its assessments.
- How many distinct supported findings exist.
- A useful first finding to inspect.
- How to open the full review or export the report.

Reduce introductory marketing copy. Use clear labels, useful density and predictable interactions. Make the next action more prominent than decorative scoring graphics.

### 3. Proposed page hierarchy

Use this order:

1. Compact report header: website, submitted URL, collection time and report actions.
2. Compact snapshot: assessment, supported findings, high-priority findings and linked quick wins.
3. A prominent “Start here” finding with evidence and its first suggested step.
4. Main working area: findings list with a narrower category-assessment rail.
5. Additional checks with their real availability state.
6. One consolidated evidence, research and execution-detail area.

Use actual data to determine whether a section should appear. An absence of findings or scores needs a useful neutral state. The order must still help users when there are no high-priority findings, no quick wins or no current assessments.

### 4. Visual design system

Use a light, precise visual system consistent with SiteAudit AI:

- Neutral off-white workspace background.
- White working surfaces.
- Deep ink headings and readable slate body text.
- Violet for selected navigation, primary actions and focused elements.
- Restrained borders, shadows and rounded corners.
- Semantic text labels and subtle status colors for priority and availability.

Suggested starting colors: background #F7F8FC, surface #FFFFFF, main text #182236, supporting text #58657A, violet #7052E8, soft violet #F0EBFF and border #DDE3ED. Verify contrast in the actual combinations.

Use the existing Inter font and icon system. Target approximately 28–32px for the domain/report heading, 20–24px for section headings, 16px for finding titles and 14–16px for body text and controls. Reserve 12–13px for timestamps, scope and secondary metadata. Use tabular numerals for comparable scores and counts.

Use an 8px spacing rhythm, approximately 24px between major modules, and 20–24px internal card padding. Keep row spacing comfortable while avoiding large empty panels. Suggested radii are 10–12px for controls and 14–16px for cards.

### 5. App shell and navigation

Retain a clear desktop sidebar approximately 224–240px wide and a compact top bar. Use the audited domain as report context. Show the active destination with an unmistakable selected treatment and aria-current.

Keep core report destinations easy to find: Overview, Messaging & copy, User experience, Search optimization, Conversion and Quick wins. Preserve every existing ReportSection key and route the AI visibility destination to the current aeo section; explain it as content readiness where appropriate.

Keep additional checks and creative/research tools in the existing expandable groups, with the active group open. Preserve the New review action. Use a mobile drawer or the existing section selector coherently so navigation does not overwhelm the content.

All controls must represent real available functions. Keep profile, notification, workspace-switching, billing and report-history controls out of the interface unless they already have working data and behavior.

### 6. Compact report header and exports

Use the website/domain as the H1. Show the submitted URL or path beneath it, especially when the review concerns a specific page. Handle long domains and URLs gracefully. Provide a clearly named external link to the audited page.

Show the actual audit timestamp, with timezone context where practical. Make the recorded nature of the report clear. Avoid labels that imply continuous monitoring.

Use one primary “Export report” entry point and a quieter “Run again” action. Keep “New review” distinct from rerunning the submitted URL.

Organize export choices clearly:

- Print / save as PDF: the existing print-report flow.
- Download overview (.txt): the complete dashboard plan.
- Copy overview: the complete dashboard plan.

A print action opens the browser print dialog; its description should make that behavior clear. If these actions share a menu, implement its keyboard behavior, focus management, Escape handling and trigger semantics.

Keep clipboard failures visible with a text-download alternative. A successful copy must only be announced after the clipboard promise resolves. Do not claim that a browser download has definitely been saved to disk when only the download was initiated.

### 7. Compact report snapshot

Replace the large introductory hero with a restrained summary strip or compact group of metrics:

- Content & clarity: the current combined assessment, or “Not assessed”.
- Supported findings: the distinct model.findings count.
- High priority: the High subset of that same list.
- Linked quick wins: the model's linked smaller-effort suggestions.

Show assessed-category coverage alongside the qualitative assessment, such as “4 of 5 categories assessed” when that is what the model reports. Make the calculation available through a concise disclosure.

If a score meter is used, its visual value must correspond to the actual score. A plain number and clear explanation are sufficient. Missing scores must remain distinguishable from a valid score of zero.

Counts may link to the appropriate filter or section. Label interactive metrics clearly and give them keyboard access. A high-priority count is a subset of supported findings, not an additional issue total.

### 8. “Start here” recommendation

Select the first retained finding using the model's existing priority ordering. If there are no High findings, use the next available priority. Preserve stable ordering for ties; do not introduce a new impact algorithm or call AI again to choose a recommendation.

Show:

- The actual finding title.
- Its priority and relevant review area.
- A short explanation from the existing finding detail.
- A short, faithful evidence excerpt and its source page.
- The first existing fix step, if available.
- An action to expand the evidence or open the category review.

Present this as a recommended starting point within the report's scope. Priority is a qualitative recommendation, not a forecast of business impact.

If no supported finding exists, show a neutral explanation and an action to review coverage or category assessments. Keep the empty state free of a fabricated recommendation or a claim that the website is issue-free.

### 9. Findings as the main working area

Allocate approximately two-thirds of the wide-screen working area to findings and one-third to the category breakdown. Put findings first in DOM order so they also come first when the layout stacks.

Use a readable list of finding rows rather than a collection of equally large cards. Each row should show its real title, priority, area label or labels, and a brief description. Include a direct “View details” action with an accessible name identifying the finding.

Expanded details should contain the retained explanation, faithful evidence, source URL, relevant collection context and available fix steps. Structured source observations must remain understandable when a plain evidence string is absent. Use existing evidence fields rather than writing new claims.

Use a stable finding ID for keys, expansion state and focus. If display ranks are shown, treat them as display order within the current view. Keep identity independent of the row's filtered index.

A separate “Open [area] review” action can navigate to the existing category workspace. If you add navigation to an exact finding, carry its stable identity and actually focus or reveal the matching item. A generic category link must not imply that it opened a specific finding when it did not.

### 10. Filtering, searching and list states

Keep priority filtering simple: All, High, Medium and Low, with counts and a clear active state. Add a compact category selector if useful. A labeled “Search findings in this report” field may filter the existing list by title, detail, source page or category. Keep search local to the current report.

Show active-filter context and a visible clear/reset action. Distinguish an empty filter result from a report with no supported findings. Retain overall report counts when filtering; label visible counts as the filtered subset.

Use a sensible initial list length, approximately five findings, followed by “Show all” or “Load more” when needed. Keep all retained records reachable. Preserve sorting by the existing priority order and use a stable order within each priority.

Changing filters should not unexpectedly jump to the top of the page. If the open finding is removed by a filter, close or reset the selection deliberately. Announce the updated result count without moving keyboard focus away from the user's control.

Preserve filters and the expanded finding when a user visits a category and returns within the same audit. Reset them for a genuinely new report, identified by analysisId or analyzedAt, rather than mixing state between reports.

### 11. Compact assessment rail

Show all five review areas in a concise list. Each row should include its label, current score or “Not assessed”, assessed-criteria count and category finding count. Retain a clear route to the full category review.

Use simple, correctly scaled bars only where they help comparison. A bar represents an assessment out of 100, not completion progress. Show the actual numeric value and avoid decorative pseudo-data.

Keep descriptive copy brief in the overview. Put scoring explanations and criterion evidence in the detailed category workspace or an explicit disclosure. A lower category score may be worth reviewing, but the rail must not introduce an unsupported “largest business impact” label.

### 12. Evidence, coverage and research

Consolidate the existing overview coverage, AuditEvidence and AgentLog presentations into one coherent progressive-disclosure area. Establish one authoritative place for detailed page records and research sources. Keep a compact coverage summary visible near the report header or snapshot.

Present these concepts separately:

- Collected pages: the valid, deduplicated page records actually read.
- Source links: distinct references, not an additional page-read count.
- Web research: real recorded research and its own timestamp.
- Execution records: recorded step statuses, including unavailable or unrecorded status.

Keep source URLs, collection timestamps, notes and technical fingerprints accessible. Put hashes and raw technical detail behind an explicitly labeled disclosure rather than in the main reading path.

When research is unavailable, use a compact notice explaining that collected-page findings remain available while competitor context is unavailable. Provide the existing real Retry web research flow or link to its canonical action. Preserve its loading, error and successful-update behavior.

Avoid repeating the same limitation in several large cards. Keep important limitations visible in context and retain full details and exports. Unknown or missing execution status must not become “completed”.

### 13. Additional checks and creative tools

Show Security signals, Accessibility signals and PageSpeed insights as a compact secondary group with their actual collection state and a clear open action.

For collected results, use “Results collected” with relevant scope and timestamps. For absent results, use “Not collected” or “Open to collect results”. Availability must follow existing model validation; old or mismatched results cannot be presented as current evidence for this URL.

Collection does not mean passing. Security headers do not establish overall protection, HTML observations do not establish WCAG conformance, and PageSpeed measurements have their own device, timestamp and field/lab distinctions.

Keep creative tools in their current workspaces and navigation group. They should remain easy to reach without dominating the dashboard's primary review task.

### 14. Responsive behavior

At wide desktop widths, show a compact header and snapshot followed by the recommended first action and the beginning of the findings area within a typical first screen. Use the remaining space for the assessment rail and subsequent evidence/check sections.

On tablet, adapt to the actual available content width after accounting for the sidebar. Container queries are appropriate where they improve this behavior.

On mobile, use this order: report identity/actions, compact snapshot, Start here, findings and filters, category assessments, additional checks, detailed coverage. Avoid placing five full category cards and a large score panel before the first useful action.

At 320px, preserve readable labels and comfortable controls. Reflow metric blocks into two columns or a clear list, wrap filter controls, and let long source URLs break safely. Replace desktop row layouts with readable stacked content where needed. Avoid requiring horizontal page scrolling.

Keep sticky controls optional and ensure they do not obscure focus, expanded evidence or anchor targets.

### 15. State, feedback and accessibility

Design the normal report, partial assessments, unavailable research, missing collection records, zero findings, zero quick wins, active filters, empty search results, export feedback, and provider-error states intentionally.

Retain cancellation, timeout handling and protection against late responses in the real audit flow. Keep timestamps and data-source labels accurate when a report is refreshed or retried. A rerun must be clearly distinguished from browsing the existing snapshot.

Use semantic landmarks, one H1, logical headings, persistent labels, sufficient contrast and visible focus. Aim for WCAG 2.2 AA. Use approximately 44px interaction targets where practical as this product's touch-target design goal.

Give filters meaningful pressed/selected state, disclosures correct expanded state, and dynamic feedback suitable status announcements. Use native controls when they simplify reliable behavior. For any custom drawer, menu or modal, handle keyboard access, Escape, focus containment where appropriate and return focus.

Use restrained 150–220ms transitions and honor reduced-motion preferences. Keep content available without animations. Treat a screenshot review as layout evidence, not proof of complete accessibility conformance.

### 16. Data and calculation requirements

Use dashboardModel(result) as the shared authority. Preserve these rules:

- Category scores come from current supported criteria using the established per-category calculation.
- The combined score is the equal average of available category scores, rounded once.
- Missing, invalid, uncited and legacy assessments are excluded; a valid zero remains zero.
- Security, accessibility and PageSpeed do not contribute to the content-and-clarity score.
- Full retained category lists determine counts, not result.topIssues or a truncated screen shortlist.
- Cross-category duplicates retain their shared identity, highest priority and all area associations.
- Page and source-link counts remain distinct and deduplicated according to the existing model.
- Quick wins come from the existing linked, supported smaller-effort suggestions.
- Research and check availability require the existing valid records for the current report/URL.

Use existing data for all visible content. Do not add invented analytics, revenue, traffic, conversion rates, confidence percentages, historical trends, ranking changes or previous-report comparisons. The application has no basis for displaying those as measured data in this dashboard.

Keep fixtures clearly isolated for UI testing. Never substitute them into a live report. The dashboard is an audit snapshot, and visiting the overview must not start new AI requests.

### 17. Implementation constraints

Read applicable AGENTS.md instructions and the installed Next.js documentation before modifying framework behavior.

Inspect:

- src/components/DashboardOverview.tsx and DashboardOverview.module.css.
- src/lib/dashboard.ts and src/lib/types.ts.
- src/components/AppShell.tsx and AppShell.module.css.
- src/components/navigation.ts and src/app/page.tsx.
- src/components/AuditEvidence.tsx and AgentLog.tsx.
- src/components/PrintReport.tsx and the existing export helpers.
- tests/dashboard.test.ts, dashboard-component.test.ts and dashboard-fixtures.ts.

Use scoped CSS and reusable components with clear responsibilities. Keep scoring and deduplication logic out of presentational components. If export actions move to the report header, reuse the same model and dashboardPlan rather than creating a second export calculation.

Preserve specialist callbacks, research retries, generated fixes, report updates, PageSpeed device results and creative-tool drafts across appropriate report navigation. Do not remount the entire specialist workspace merely to change the overview layout.

Avoid introducing a new component library or heavy charting dependency for this relatively small dashboard. Use existing icons, native HTML and lightweight CSS/SVG where a real data visualization is useful.

### 18. Verification and completion criteria

Test representative reports with all assessments, partial assessments, no assessments, a genuine zero score, unavailable research, empty execution records, no findings, duplicate findings across categories, and missing additional checks. Include a longer findings list, long URLs and long titles.

Verify:

- Model-derived scores and counts remain unchanged by the visual redesign.
- Priority/category/search filtering returns the correct records and reset works.
- Evidence expansion preserves the selected finding's identity.
- Category and check navigation targets the correct existing workspace.
- Overview filter/selection state survives a round trip within the same audit and resets for a new report.
- Copy and text download retain the complete overview regardless of screen filters.
- Print/PDF agrees with the dashboard model.
- Clipboard failures remain actionable.
- Research retry success and failure retain accurate states and existing findings.
- All-zero, all-missing and partial states remain distinct.
- Keyboard navigation, focus, expanded content and long text work across responsive widths.

Run the appropriate tests, lint and production build. Inspect screenshots at 320, 390, 768, 1024 and 1440px, including intermediate widths and zoomed text. Correct clipping, low readability, repetitive notices and unnecessary vertical space.

Complete the implementation and connect all controls. Deliver a concise explanation of changes, representative desktop/mobile screenshots, checks actually completed and any remaining limitation. Do not claim live provider or accessibility verification based solely on mocked component tests.

Success means a user can identify the website and report scope, understand a useful finding, inspect its evidence and choose the next action with minimal searching. The dashboard should feel coherent, professional and efficient while retaining the application's evidence and scoring safeguards.
