# SiteAudit AI: specialist workspace analysis and redesign prompt

## Review basis and scope

This brief follows a code and test review of the current Messaging & copy, Search optimization, Conversion, and Quick wins workspaces. The request lists Messaging & copy twice; it is treated as one destination. User experience remains an existing destination and is outside this redesign, although it needs regression checks because these workspaces import its shared stylesheet.

Reviewed: MessagingSection.tsx, MessagingReview.tsx, MessagingWorkspace.module.css, SEOSection.tsx and its CSS, ConversionSection.tsx and its CSS, QuickWinsSection.tsx and its CSS, UXReview.module.css, IssueCard.tsx, evidence renderers, section model/presentation helpers, dashboard finding identity, TabPanel.tsx, navigation.ts, src/app/page.tsx, ReportHeader.tsx, PrintReport.tsx, and relevant component tests. This is an implementation-based design analysis, not a fresh browser usability study. No application UI changes are made by this brief.

## What is already valuable

- Source-linked findings, qualitative priorities, criterion assessments, retained explanations, and practical fix steps already exist.
- Messaging supports original wording, editable suggestions, restoration, copy, complete exports, and disclosure of unreviewed user edits.
- Search optimization has a per-page inspector, collected titles/descriptions, an explicitly illustrative listing preview, structured observations, and unverified-assessment handling.
- Conversion distinguishes observed actions/forms from actual clicks, submissions, and conversion measurements. Its inferred visitor goal is already labeled a hypothesis.
- Quick wins has finding links, evidence, lower-effort sorting, reversible manual completion, complete exports, and selection transparency. Fresh verified shortlists are limited to six tasks.
- Tests already protect several important behaviors, including zero versus missing scores, filtered-out content in exports, source integrity, draft persistence, and task identity.

## Main findings from the current implementation

| Current implementation | Why change it | Direction |
| --- | --- | --- |
| A global section heading is followed by another large promotional introduction and circular score. | The same section is introduced twice, delaying the work. | One section title, compact assessment strip, direct first action. |
| Messaging renders the overview, criterion cards, and strengths before improvements. SEO and Conversion add page inspectors before the findings too. | Users must pass explanatory content before discovering what to do. | Findings first; assessments in a smaller rail; inspectors and methodology secondary. |
| Shared and section CSS frequently uses 8–12px text, pale lavender text, uppercase labels, and tinted surfaces. | Important metadata and controls receive weak visual emphasis and need readability/contrast verification. | Strong neutral text, larger body/control sizes, restrained violet accents. |
| Different fallback and detailed finding renderers use different layouts. Messaging falls back to IssueCard when steps are missing, changing the available wording interaction. | The same kind of finding can behave differently because a separate field is unavailable. | One finding structure with optional evidence, wording, and step modules. |
| Messaging and Quick wins remain mounted across navigation; SEO and Conversion are conditionally mounted under the active-section key. | SEO/Conversion filters, selected page, and local disclosure state can reset on a round trip. | Report-scoped state that survives navigation and resets for a new report. |
| Some identity comes from original array indexes; generated fix steps are keyed by title. | New filtering, deep links, or selected-detail views can associate UI state with the wrong record if implemented carelessly. | Stable finding identity, tested duplicate-title handling, compatible callback migration if needed. |
| Quick wins links navigate to a category using a section-only callback. | A label suggesting an exact finding may overpromise what navigation does. | Label it as category navigation, or implement matching finding reveal/focus. |
| Plan copy/download actions and long guidance blocks repeat throughout the working area. | Primary work, supporting information, and export actions compete. | A compact section toolbar and consolidated secondary details. |

These are design judgments and code observations, not measured usability outcomes. The redesign should make existing, supported information easier to use without changing the meaning of the audit.

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, information architect, UX writer, accessibility specialist, and front-end engineer.

Redesign and implement four completed-audit workspaces in the existing SiteAudit AI Next.js, React, and TypeScript application:

1. Messaging & copy.
2. Search optimization.
3. Conversion.
4. Quick wins.

Create a polished, readable working product that matches the redesigned landing page and dashboard. Make the interface easier to understand and act on. Finish the implementation and connect every control; do not stop at a mockup or proposal.

### 1. Understand the product and preserve scope

SiteAudit AI reviews collected public page content and available HTML/response observations. Its content scores and priorities are qualitative assessments. They are not traffic, ranking, conversion-rate, or usability measurements.

The user journey is:

Understand the finding → inspect its source → review a practical change → copy, export, or track the next step.

Preserve the current app shell, report identity, dashboard, navigation destinations, live analysis flow, generated fix steps, evidence collection, research retry, and specialist workspaces. User experience, AI visibility, Security, Accessibility, PageSpeed, and creative tools are outside this visual redesign. Verify that shared changes do not regress them.

Do not introduce analytics integrations, account controls, report history, collaboration, publishing, or persistence features that the application does not implement.

Opening a workspace, expanding evidence, changing filters, or exporting must not start another AI audit. Generate additional fix steps only through the existing explicit action.

### 2. Read the actual application before editing

Read applicable AGENTS.md instructions. Before changing Next.js behavior, consult the relevant documentation installed in node_modules/next/dist/docs/.

Inspect:

- src/components/MessagingSection.tsx, MessagingReview.tsx, MessagingWorkspace.module.css.
- src/components/SEOSection.tsx and SEOSection.module.css.
- src/components/ConversionSection.tsx and ConversionSection.module.css.
- src/components/QuickWinsSection.tsx and QuickWinsSection.module.css.
- src/components/UXReview.module.css and all consumers of any shared styles being changed.
- IssueCard.tsx, MessagingEvidence.tsx, SEOEvidence.tsx, ConversionEvidence.tsx, QuickWinEvidence.tsx.
- src/lib/types.ts; messaging.ts, seo.ts, conversion.ts, quick-wins.ts; their presentation helpers.
- src/lib/dashboard.ts, DashboardOverview.tsx, ReportHeader.tsx, TabPanel.tsx, navigation.ts, src/app/page.tsx, PrintReport.tsx.
- Existing section model tests, component tests, and fixtures.

Identify state ownership, export inputs, evidence shapes, score rules, and callback contracts before moving components. Keep unrelated existing work intact.

### 3. Establish one restrained visual system

Use the existing Inter font, icon system, global tokens, and dashboard visual family. Prefer existing tokens over parallel hardcoded palettes.

Starting direction:

- Workspace: neutral off-white, approximately #F7F8FC.
- Working surfaces: white.
- Headings: deep ink, approximately #182236.
- Supporting text: readable slate, approximately #58657A.
- Primary/selected/focus accent: violet, approximately #7052E8.
- Soft selected surface: approximately #F0EBFF.
- Borders: approximately #DDE3ED.
- Priority and availability: semantic color plus explicit text.

Verify actual foreground/background combinations. Do not assume a token or pale tint passes contrast.

Use 24–28px section headings, approximately 16–18px finding titles, 14–16px body text and controls, and 12–13px secondary metadata. Avoid 8–10px operational labels. Use tabular numerals for comparable counts and scores.

Use an 8px spacing rhythm, around 24px between major modules, and 20–24px card padding. Use subtle borders, 10–14px radii, and restrained shadows. Reserve stronger emphasis for selection and the next action. Avoid repeated gradients, oversized rings, decorative number rails, nested cards, and excessive uppercase copy.

Do not fill the page with new charts. Every visual should answer a real question using available data.

### 4. Replace repeated introductions with a useful workspace structure

Retain the global report header and one section H2. Remove duplicate marketing-style section heroes.

Use this reading order for Messaging, Search optimization, and Conversion:

1. Section title, one-sentence purpose, and compact section export actions.
2. Compact assessment, assessed-area coverage, supported-finding count, and collection scope.
3. A clear route to the first retained finding.
4. Findings as the main working area, with a smaller assessment rail on wide screens.
5. Optional page inspector or section-specific supporting tools.
6. Supported strengths, scoring method, and consolidated scope details.

The first useful finding or its open action should appear early. Do not put all criterion cards and lengthy explanations above it.

A small “Recommended starting point” treatment may identify the first retained finding in the existing priority order. Open that actual finding instead of creating another large duplicate card. If there are no supported findings, provide a neutral empty state and a route to existing observations or coverage.

Do not imply that zero findings establishes a problem-free website.

### 5. Make findings consistent and easy to inspect

At generous desktop content widths, allocate approximately two-thirds to findings and one-third to a compact assessment rail. Findings come first in DOM order. Stack at a breakpoint based on the space remaining after the sidebar.

Each collapsed finding should show:

- Actual title.
- Text priority badge.
- Review area and source page where available.
- Brief retained explanation, without a new unsupported claim.
- A named “View details” action.

Expanded details should show, in a consistent order:

- The retained explanation.
- “What we found”: actual source copy or structured observations.
- “Suggested next step”: existing steps, or the explicit existing generation action.
- Source link and relevant collection context.
- Section-specific tools, such as an editable wording suggestion.

Keep a readable summary of evidence close to the action. Do not require several nested disclosures to connect a finding to its source. Put long raw payloads and technical details in one secondary disclosure.

Render structured evidence even when issue.evidence is absent. Use existing evidence formatters. Never format a JSON observation as a quotation from the website. Never invent an excerpt or fix step to fill space.

Use the same finding frame whether or not steps, suggestions, or structured evidence exist. Missing steps must not remove otherwise available wording editing or source access.

Existing fix-step generation needs visible loading, failure, and retry states. Keep retained data visible during failures; do not show fabricated success.

### 6. Keep filters simple and preserve identity

Provide a compact toolbar with All, High, Medium, and Low priority filters and counts for the three finding workspaces. Use a labeled area selector where useful. Keep Messaging’s “With wording options” capability available without adding another dominant row of tabs.

Do not add local search just to decorate a short list. If implemented for longer lists, label it “Search findings in this report” and filter only existing titles, details, source pages, or areas.

Show the filtered result count separately from full section totals. Provide an obvious reset when filters narrow the list. Distinguish no supported findings from no matching findings. Preserve High → Medium → Low order and stable ordering within equal priorities.

For longer lists, show approximately five findings initially and a working “Show all” or “Show more.” Keep expanded content reachable when filters change.

Use stable report-local finding identity for React keys, expansion, drafts, selected details, and focus. Inspect findingIdentity in src/lib/dashboard.ts and retain compatibility with dashboard associations. Do not use filtered positions as identity. Test same-title findings on different pages and exact duplicate records. If the existing generated-step callback keyed by title needs migration, preserve its consumers and avoid assigning one finding’s generated steps to another.

Preserve filters, selected pages, expansion, drafts, and manual task state across navigation within an audit. Reset them using analysisId or analyzedAt for a new report. Do not merely keep a stale workspace from the previous report mounted. Preserve the documented session-only behavior across reloads unless durable persistence is explicitly implemented.

### 7. Messaging & copy: make revision the primary task

Use concise introductory copy such as “Review unclear wording and refine the next draft.”

Use messagingScore and existing eligible criterion data. Keep these existing assessment areas and weights:

- Purpose & message clarity: 35%.
- Audience & next-step clarity: 25%.
- Specific, supportable language: 25%.
- Consistency & readability: 15%.

Place criterion explanations in compact rail rows or a disclosure, not four large cards before findings. Preserve sources, strengths, sampling notes, and verification limitations.

For a finding with copySuggestion, provide an unmistakable comparison:

- “Current copy”: exact collected original, read-only, with its source.
- “Suggested draft”: existing replacement in an editable, persistently labeled textarea.
- “Copy wording” and “Restore suggestion” where applicable.
- “AI wording option” or “Edited by you” status.

Use side-by-side copy panes only when each remains readable. Stack current wording before the draft on narrow widths. Do not crop text or hide meaningful claims to make the preview look cleaner.

Keep the existing draft limit, empty-edit behavior, and draft-aware full-plan export. An intentionally emptied draft must remain empty rather than silently reverting. Disable copying empty wording. A pending clipboard operation must not announce success for an older draft after editing.

Explain concisely that user edits have not been re-reviewed, drafts do not update the original score, and copying does not publish changes. Keep facts used by the suggestion accessible. If no grounded replacement exists, show the retained finding and steps without inventing one.

### 8. Search optimization: separate observations from assessment

Use concise introductory copy such as “Review collected search signals and prioritize supported fixes.”

Use seoScore and existing validated data. Preserve these areas and weights:

- Titles & descriptions: 30%.
- Canonical & indexing signals: 30%.
- Content & page structure: 25%.
- Structured data: 15%.

Keep assessmentValidation handling: withheld summaries and criterion explanations must stay withheld. Unassessed areas must not contribute as zero. Show a compact partial-review notice while retaining supported findings and factual observations.

Put the page inspector after findings or behind a clearly named secondary control. Preserve its collected-page selector and page-specific evidence.

Make the search listing preview readable and properly contained. Use actual collected URL, title, and description. Keep “Illustrative search preview” visible and explain that this is not a live result or ranking prediction. Show explicit missing-title/description states; do not create fallback marketing copy. Character counts are informational, not pass/fail rules or ranking measurements.

Show readable rows for titles/descriptions, canonical declarations, directives, headings, structured data, response status, and available response headers. Preserve the existing status distinctions: Observed, Review, Not observed, Not assessed. Collection or presence must not be labeled as passing a complete SEO test.

Differentiate absence in collected HTML from absence across the website. Preserve the existing untested scope for indexing, rankings, robots.txt/sitemaps when not collected, destination behavior, and external validation. Use human-readable key/value observations, with raw technical details secondary.

Label the page selector’s scope clearly: selecting an observation page must not silently imply the findings list is filtered too. If a finding page filter is added, label it separately and keep full totals visible.

### 9. Conversion: show the observed path without inventing a funnel

Use concise introductory copy such as “Make the next action clearer and easier to evaluate.”

Use conversionScore and preserve the existing weights:

- Action clarity: 35%.
- Decision support: 25%.
- Form clarity: 20%.
- Next-step expectations: 20%.

Call the score “Conversion clarity assessment.” Do not imply it is a conversion rate or measured uplift.

Prioritize findings. Make the existing page-specific actions/forms inspector secondary. Display actual collected action names, destinations, control types, form observations, and supporting wording. Preserve the inferred visitor goal as a working hypothesis with sources, or explain that it was not established.

A compact HTML-based action preview may show the actual label and destination. Label it as an observation, not a screenshot or tested interaction. Preserve readable mailto destinations and available additional actions. Do not execute submissions, trigger email composition, or click external routes automatically during inspection.

Keep “Not clicked,” “Not submitted,” or equivalent scope where relevant. Do not label destinations as working without testing. A page with no form is not automatically a failure. An unavailable or inapplicable criterion must not be visually presented as a failed test.

Keep a concise manual validation plan: inspect changed copy in context, test the affected interaction, and measure meaningful outcomes separately. Do not draw a measured funnel, drop-off chart, or conversion forecast from HTML observations.

### 10. Quick wins: make a small implementation queue

Quick wins needs a task interface, not another assessment dashboard. It has no new numeric quality score.

Replace the large introduction with a short line and compact counts for total shortlisted tasks, tasks to do, and tasks manually marked done. Use “Marked done by you” and disclose that completion is not re-tested. Optional progress represents these task counts only.

Retain the existing six-task selection limit for fresh verified reports, Low/Medium effort eligibility, source links, linked findings, deduplication, and exclusion rules. Do not manufacture tasks to fill an empty queue. Preserve distinct handling of older saved suggestions without verified links.

Use a clean ordered task list. Each task shows:

- Actual action title.
- Review area and estimated effort.
- Qualitative priority from the linked finding when available.
- Source page and a short expected-benefit hypothesis.
- Expandable retained implementation steps and evidence.
- Reversible “Mark done”/“Mark as to do” control.
- “Copy task.”

Keep All tasks / To do / Marked done filters, the area filter, and the existing Lower effort first / Finding priority ordering. Present them in one organized toolbar that wraps naturally. Preserve stable ordering and manual state when sorting or filtering.

The starting task must follow the selected real ordering; do not imply that a completed task is the next unfinished task. Avoid a second duplicated recommendation card.

The existing category callback opens a section. Label it “Open Messaging & copy review,” for example. Only use “View linked finding” if you implement matching finding reveal and focus across navigation. Preserve both directions of the round trip and task progress.

Keep “How this shortlist was selected,” real selection counts, and manual validation guidance available in compact disclosures. No completion-time promises, percentage uplift, or automated verification badges.

### 11. Compact assessments and honest counts

Keep scoring logic in shared library helpers, not components. Preserve each section’s weighted calculation, exclusion of unavailable areas, and rounding behavior. Do not replace the section calculations with the dashboard’s equal average across categories.

When aligning section and dashboard values, preserve dashboardModel’s current source eligibility rules. Derive compatible views through a shared adapter if needed; do not introduce a permissive legacy-score fallback to make numbers match.

Display valid zero as 0. Display missing/unverified assessment as “Not assessed.” Any meter must match its actual score and be described as an assessment, not completion. Show assessed-criterion coverage beside the score and explain the method in one disclosure.

Counts refer to full retained section records. Do not derive them from topIssues, filtered rows, sources, or arbitrary limits. High-priority findings are a subset, not an additional total. Distinguish section finding totals from the dashboard’s cross-category distinct count; shared findings can belong to several sections.

Keep page counts, source-link counts, reviewed blocks, sampled controls, and observed forms accurately labeled. Keep security, accessibility, and PageSpeed outside these content assessment calculations.

### 12. Exports and feedback

Provide one compact section export area with clearly labeled copy and text-download actions. Preserve the global full-report print/PDF entry point and its browser print behavior.

Use the existing messagingPlan, seoPlan, conversionPlan, and quickWinsPlan helpers. Export all records in that section regardless of active filters or collapsed rows. Messaging exports include current drafts and their status. Quick wins exports include hidden tasks and actual manual statuses. Preserve source links, evidence, generated/retained steps, and limits supported by each export.

Clipboard failure must produce visible, actionable feedback and a working text-download alternative. Handle download-start failure honestly, clean up object URLs safely, and never announce that a file was saved when only a download was initiated.

Keep section-plan exports distinct from the global report export. Do not imply that the global PDF includes local edited wording or manual task state unless those inputs are actually connected and verified. If extended, keep the recorded audit wording and assessments distinct from user drafts.

Use role=status for nonurgent feedback and alerts for errors. Avoid alerts that disappear before users can act. Do not use toast messages as the only place containing important scope information.

### 13. Accessibility and responsive behavior

Aim for WCAG 2.2 AA and verify actual implementation. Preserve one screen H1 for the report, section H2s, and logical finding/detail headings.

Use real buttons and links, persistent labels, visible focus, appropriate aria-expanded/aria-controls, aria-pressed filters, and aria-current navigation. Avoid clickable card containers containing competing interactive controls. Maintain logical keyboard and reading order.

Prefer inline disclosures for findings. If a drawer or modal is introduced, implement focus entry/restoration, keyboard operation, Escape, correct modal semantics, and focus containment where applicable. Do not add a complex dialog system when a native disclosure meets the need.

Use comfortable touch targets, readable textarea text, and flexible filter rows. Long domains, titles, evidence, code-like values, and URLs must wrap or have an accessible local overflow treatment; they must not widen the page. Never hide evidence just to prevent overflow.

On mobile use: title/actions → compact snapshot → first finding/action → remaining findings → assessment breakdown → inspector/strengths → scope details. For Quick wins: title/counts → task toolbar → tasks → selection details.

Test viewport widths 320, 390, 768, 1024, and 1440px, plus intermediate content widths and 200% zoom. Account for the desktop sidebar. Prefer container queries where appropriate. No horizontal page scrolling or fixed overlays covering the current task. Honor reduced-motion preferences.

### 14. Technical architecture and safety of the refactor

Use scoped CSS modules and a small set of reusable workspace, finding, assessment-row, source-detail, and feedback patterns. Retain specific evidence renderers and section-specific tools. Do not force every section into an inflexible generic component.

Several sections import UXReview.module.css. Extract or introduce shared primitives deliberately instead of globally restyling that module and accidentally changing other specialist workspaces. Audit all consumers of any modified shared rule.

Keep state at a report-scoped level or use an explicit report-keyed retention strategy. Preserve cancellation, timeouts, late-response protection, research updates, additional check results, and creative drafts during appropriate navigation. Do not start background audits to populate placeholders.

Testing fixtures and illustrative previews must remain isolated from live report data. Never replace unavailable results with template findings, scores, claims, or generated screenshots.

### 15. Acceptance criteria and verification

Run the existing relevant model and component tests and add focused behavior coverage for the new interactions. Preserve tests’ substantive guarantees rather than deleting assertions merely because labels or structure changed.

Verify:

- Full, partial, missing, valid-zero, withheld, legacy, empty, and filtered-empty states.
- Scores, coverage, source associations, and full counts before/after the redesign.
- Stable High/Medium/Low ordering and identity across filtering, sorting, expansion, and duplicate titles.
- Structured evidence when no plain string exists.
- Draft editing, restoration, empty drafts, clipboard failure, and stale copy feedback.
- SEO page selection, missing metadata, partial headers, withheld assessments, and explicitly illustrative preview.
- Conversion page selection, real action/form observations, hypothesis labels, absent forms, and untested behavior.
- Quick-win selection eligibility, reversible progress, all-done state, source/parent associations, and exact destination labeling.
- Navigation round trips preserve state; a new analysis resets it; reload behavior matches the user-facing explanation.
- Filtered or collapsed UI never removes records from full section exports.
- Explicit fix-step generation loading/failure/retry; no AI requests caused by opening the workspace or changing filters.
- Keyboard access, focus, selected/expanded states, text contrast, long content, touch targets, zoom, and reduced motion.
- Existing User experience and other shared-style consumers remain usable and unchanged in scope.

Run npm test, npm run lint, and npm run build. Inspect representative desktop and mobile screenshots using fixtures isolated from live reports; keep screenshots clearly illustrative when applicable. Capture expanded source and wording states as well as the initial screen.

Deliver the implemented workspaces, representative screenshots, checks actually performed, and any remaining limitations. Explain what became easier for the user. Do not claim browser checks, accessibility conformance, successful downloads, or live analysis verification unless actually performed.
