# SiteAudit AI Conversion redesign

## Current section review

This review draws on the Conversion components, evidence collector, scoring and export helpers, and existing tests. The saved desktop and mobile screenshots show an illustrative test report. They provide a baseline for the layout and reading order. [Desktop report](./verification/specialist-workspaces/conversion-1440.png) · [Mobile page inspector](./verification/specialist-workspaces/conversion-inspector-390.png)

The current workspace already provides evidence-backed findings, a weighted clarity assessment, a page inspector for recorded actions and forms, and an exportable implementation plan. The biggest opportunity is to make those parts easier to use together.

| Current behavior | Effect on the user | Redesign direction |
| --- | --- | --- |
| The page inspector sits below the findings and assessments. | On mobile, the user scrolls through several sections before reaching the actions and forms behind a finding. | Place **Findings** and **Actions & forms** directly below a compact snapshot. |
| Findings expand within a vertical list while assessment cards occupy a desktop rail. | A long finding pushes other findings down and leaves less room for evidence and steps. | Use a compact finding list and one detail panel. Move criterion explanations below the main task. |
| A finding links to the external website and the inspector has its own page picker. | Users must find the same page again. URLs that differ only by query can have the same displayed label. | Add **Inspect source page** and keep the exact recorded page and query visible. |
| The inspector derives pages from the evidence array and displays the report-wide visitor goal inside the selected page view. | A collected page can be absent from the picker, and the goal can read as a conclusion about the selected page. | Use recorded page coverage and present the goal once as a report-wide hypothesis. |
| Selected actions and observed forms can refer to the same form. The validation plan is a separate disclosure at the end. | The overlap can look like two different actions, and users must work out how to verify a specific recommendation. | Link overlapping observations and put **How to validate** beside the relevant fix. |
| Text and print render some raw criteria, and the text plan deduplicates observations by ID alone. | Saved reports with duplicate criteria or reused IDs can produce inconsistent scores and supporting evidence across exports. | Build export rows from eligible records and use page identity together with the observation ID. |

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, information architect, accessibility specialist, UX writer, and front-end engineer. Implement a professional redesign of the **Conversion** section in the existing SiteAudit AI Next.js, React, and TypeScript application.

Design for the person who needs to answer three questions in order. What should I improve? What did the audit observe? How can I check the change before publishing?

### 1. Inspect the implementation and define the scope

Read applicable `AGENTS.md` files and the relevant installed Next.js documentation before changing framework behavior. Inspect the existing Conversion components and CSS, along with the files that supply their data.

- `src/components/ConversionSection.tsx` and `src/components/ConversionPageInspector.tsx`.
- `src/lib/conversion.ts`, `src/lib/conversion-presentation.ts`, `src/lib/dashboard.ts`, and the review helpers used by Conversion.
- `src/lib/server/conversion-evidence.ts`, the Conversion agent and verifier, and the existing evidence model.
- `src/components/TabPanel.tsx`, `src/components/PrintReport.tsx`, and the shared review and export components. Use the redesigned Search optimization and User experience workspaces as references for navigation and layout.
- `tests/conversion.test.ts`, `tests/conversion-component.test.ts`, the existing dashboard and print tests, and the saved screenshots above.

Implement inside the completed-report workspace. Use the supplied `analysis`, `issues`, `url`, `collectedPages`, generated steps, and callbacks. The section should work on previously saved reports as well as fresh audits. Keep evidence validation, research retries, cancellation, and specialist features wired through their existing entry points. Opening the workspace, changing views, selecting pages, filtering, and exporting use data already in the report.

### 2. Establish the page hierarchy

Keep the audited domain as the report H1 and **Conversion** as the section heading. Use a concrete introduction such as “Review how clearly your pages explain what to do next.” The audit covers whatever relevant visitor actions appear in the collected pages, including reading, exploring a portfolio, requesting support, or buying.

Order the section this way.

1. Compact heading, scope, and Conversion plan export.
2. Snapshot with the clarity assessment, assessed criteria, supported findings, and collected page coverage.
3. **Findings** and **Actions & forms** controls, followed by the active workspace.
4. Criterion assessments, recorded strengths, and the report-wide visitor-goal hypothesis with their evidence.
5. Collection details and review limitations.

Display “Clicks, submissions, and outcomes were not measured” near the assessment. Put the first useful action before explanatory modules. Keep the snapshot compact on mobile. Use the existing report-level export action for the complete report and name the specialist actions **Copy Conversion plan** and **Download Conversion plan**.

### 3. Create a focused findings workspace

Use a compact finding list on the left and one detail panel on the right when the available report width supports both. Each list item shows the title, text priority label, recorded focus area when available, and a short source-page label when useful. Keep longer explanations and sources in the selected detail. On narrow layouts, put a labeled finding selector or compact list above the same detail panel.

- Use the existing priority ordering and preserve the recorded order within a priority. Start with the first retained finding. Keep the selected identity independent of its position in any filtered list.
- Show **All**, **High**, **Medium**, and **Low** with meaningful counts and accessible selected states. Use the report's supported finding total as a separate figure. Add a compact focus-area or page filter when there are useful choices. Keep records with unknown areas discoverable under **All**.
- Base selection, keys, generated-step lookup, and cross-links on the existing stable finding identities and report key. Use the existing occurrence and legacy handling for older reports. Distinguish two findings with the same title. When filters hide the selected item, show a valid match or the applicable empty state.
- Show filtered counts and an obvious **Clear filters** action. Distinguish “No supported conversion findings in this report,” “No findings match these filters,” and “No supported findings for this page.” Offer **Inspect actions and forms** when there is collected evidence to explore. Phrase the empty state around what the audit supported within its scope.

### 4. Make evidence, interpretation, and next steps easy to distinguish

In the selected finding, give the title and priority a clear home. Use the retained explanation for **Why it matters**. Follow with **What the audit observed**, **Suggested change**, and **How to validate**. Use small labels and spacing to separate the recorded fact, the AI interpretation, and the proposed work.

Render the retained structured `conversionEvidence` with the original location, actual recorded values or excerpt, and source URL. Support the existing plain evidence field for older reports. When a source is unknown, label it as unavailable. Display the audit timestamp or page collection time only with the correct scope. Keep fingerprints and technical details behind a disclosure. Wrap long titles, control labels, URLs, and excerpts naturally.

For a finding that cites one or more inspectable pages, show **Inspect source page** alongside the corresponding evidence. This selects the exact page in **Actions & forms**. A separate **Open audited page** link opens the safe recorded source URL. On the inspector, **View findings for this page** opens the Findings view with the requested page filter and other filters cleared. Ordinary view switches preserve each view’s local state. Match by validated HTTP(S) source identity with pathname and query intact. Reuse the existing source URL normalization where applicable and keep URL fragments out of page identity. Preserve fragments where they describe a recorded action destination.

Show existing fix steps under **Suggested change**, including any drafts already generated for that finding. Where generation is supported, make **Generate fix steps** an explicit action for the selected finding. Preserve loading, cancel, retry, timeout, and late-response protection. If no steps are available, keep the source evidence readable and explain the available next action. Scope export feedback and async announcements to the action taken.

### 5. Make Actions & forms a first-class evidence view

Use the validated collected-page inventory as the authoritative picker when provided. Use retained page records or source evidence for a legacy inventory only when the authoritative list is unavailable. Include collected pages with sparse evidence, with a clear empty state. Show enough of the hostname, pathname, and query to distinguish pages. Keep the selected page and counts in sync with the observations. On single-page reports, show the page label and source link without an unnecessary picker.

Use two clear groups. **Selected actions** shows the recorded shortlist from `analysis.actions`, with a disclosure for additional entries when needed. **Observed forms** shows the form observations from `analysis.forms`. Label the counts by group and keep them separate from finding totals. When one form is present in both, show its concise action row with a link to its matching form detail. Match using page and observation identity. An empty action shortlist means no action was selected for review. An empty form inventory means no form was recorded in the collected sample.

For each action, show the recorded label or name, control kind, location, and declared destination when known. Preserve the evidence semantics.

| Recorded observation | Appropriate display |
| --- | --- |
| Link with a recorded URL or fragment | Show the declared destination, including the relevant fragment when present. |
| Email or phone link | Show the recorded recipient or number and the action kind as inert evidence. |
| Button or script-controlled control without an established destination | Show “Destination not established from collected HTML” or the more specific recorded observation. |
| Named and unnamed controls | Use the actual captured name or an explicit missing-name state, with the evidence location. |
| Truncated or sampled evidence | Show the collection limit near the affected group. |

Use the existing safe observation parsing and formatting helpers. Keep these records informational. The only external navigation in the inspector should be an explicit safe link to the audited source page. The inspector should not follow action destinations, run handlers, open email drafts, dial numbers, or submit forms.

For forms, show the purpose or name as recorded, visible labels and help, editable and required question counts, and declared submission method or destination when available. Keep zero distinct from unknown. Use recorded associations and counts, including native form ownership, radio grouping, and exclusion of hidden, disabled, or read-only controls from editable-question counts where applicable. Explain that displayed fields may be a sample when collection was truncated. Never expose entered, prefilled, hidden, or personal field values. Treat question count as context. Judgments about friction, completion, dynamic errors, and accessibility behavior require appropriate evidence or manual testing.

### 6. Give the visitor goal and validation the right scope

Show **Likely visitor goal** once in a compact report-wide disclosure. Use the actual `analysis.goal` and its retained citations. Label it as a hypothesis from the collected evidence. Use an explicit unavailable state if none was retained. Page switching should affect page observations only.

Give the selected finding a concise **How to validate** disclosure with a short, practical checklist appropriate to the supported evidence. Treat the checklist as instructions for a future test. Keep its context specific.

- For an affected link or control, verify that the label explains the action, then try the actual destination or behavior using keyboard and mobile as appropriate.
- For an affected form, inspect labels, instructions, required indicators, keyboard flow, errors, and completion feedback in a suitable test environment with dummy data when relevant.
- For decision support or next-step copy, verify the actual terms or expectations and ask whether a visitor can explain what will happen after acting. Use the relevant facts from the finding.

Keep the general review scope available in a compact disclosure. Use the existing guidance links where relevant. Form labels and instructions can guide the manual review, and existing analytics guidance can explain how a team might measure a meaningful action separately. The audit records HTML and copy observations and qualitative assessments. It does not measure traffic, event delivery, conversion rates, outcome changes, or experiment results. [W3C WAI form labels](https://www.w3.org/WAI/tutorials/forms/labels/) · [W3C WAI form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) · [Google Analytics key events](https://support.google.com/analytics/answer/9267568?hl=en)

### 7. Keep scores, counts, and exports consistent

Use the existing reviewed-criteria and score helpers as the authority. Keep the qualitative label **Conversion clarity** and show coverage such as “3 of 4 criteria assessed.” Show all four criterion rows and make their actual explanations and sources available.

| Criterion | Weight |
| --- | ---: |
| Action clarity | 35 |
| Decision support | 25 |
| Form clarity | 20 |
| Next-step expectations | 20 |

Apply the weights only to eligible, source-backed criteria, normalize by the sum of their weights, and round once. Exclude invalid, unsupported, duplicate, and legacy rows according to the existing eligibility rules. Preserve a valid score of zero. Show **Not assessed** when no eligible assessment exists. Use the actual reason when an area was unassessed. Distinguish a page sample without observed forms from a sample with form evidence but no verified Form clarity assessment.

Keep page counts, source observations, action shortlist size, form count, and supported finding count distinct. Show the actual limitations when sampling or verification withheld material. Avoid inventing a relationship among these counts. Display recorded strengths and the retained summary with their citations, below the main workflow.

Build text and print detail from the same complete, validated Conversion presentation data. Iterate eligible criterion records for numeric rows. Include unassessed areas, scope, retained summary, goal hypothesis, strengths, findings, actual sources, and generated steps. Key observation records by page identity plus source ID so a reused ID cannot merge evidence from different pages. Include relevant sources attached to the goal, summary, criteria, strengths, actions, forms, and findings. Use existing safe parsing, source validation, and legacy fallbacks. Preserve the distinction between the report URL and a known finding source.

Use the same stable keys to find generated steps in the UI, text plan, and print output. Export the complete recorded Conversion section regardless of the visible view, selected finding, page, or filters. Include meaningful Conversion evidence and assessment in the full report print even when the finding count is zero. Keep copy and text download available through existing helpers and give visible feedback on success or failure. If clipboard access fails, offer the working text download next to the message.

### 8. Use a calm, accessible visual system

Match the current report workspace with white panels on the off-white canvas, deep ink text, readable slate metadata, subtle borders, and violet for active controls and focus. Reuse the Inter typography, existing icons, and established spacing and radii. Use semantic colors with text labels for priority and availability. Prefer approximately 14–16px for reading text and controls and 12–13px for secondary metadata. Keep the assessment in a compact value block with tabular numerals and a plain-language scope.

Keep the selected finding and next action visible without relying on color alone. Use persistent form labels, visible focus rings, meaningful icon names, semantic headings, and announcements for changed results and action feedback. Use native controls where practical. If using tabs, implement the corresponding keyboard and focus pattern. Give disclosure controls clear accessible names and accurate expanded states. Respect reduced motion. Verify contrast and keyboard access against WCAG 2.2 AA.

Base the finding-list layout on the width available after the sidebar. Use scoped styles and switch to one column before the detail becomes cramped. Wrap filter controls, keep touch targets comfortable, and avoid horizontal overflow with long queries, labels, or paths. Keep mobile DOM and reading order as heading → snapshot → view controls → selected workspace → assessment and scope.

### 9. Preserve report state and normal entry points

Keep the Conversion workspace mounted as appropriate when navigating between report sections. Preserve the active view, filters, selected finding, selected source page, and generated steps for the same audit. Reset view-local state for a new `analysisId` or the existing `analyzedAt` fallback. Make Overview and sidebar links reach Conversion through the normal report navigation. Keep source cross-links inside the section keyboard operable, with focus moved to the target heading or selector when helpful. Keep analyst callbacks, the report export, and other sections usable through their existing flows.

### 10. Verify the behavior in the running app

Use the existing Conversion model and component tests. Add focused regression coverage where they miss the redesigned behavior. Cover at least these cases.

- A finding opens the exact source page, including two collected URLs that differ only by query. The return action shows the correct page-specific findings. An uncited or unavailable page has a clear state.
- Same-title findings keep separate identities and generated steps after filtering or sorting. The same report retains its state after a navigation round trip. A new report starts cleanly.
- The page inventory includes a collected page with no retained observations. A linked form in both groups resolves to one form detail. Unknown destinations, zero questions, and absent counts remain distinct. Observation IDs reused on separate pages retain both records.
- Four-criterion, partial, zero-score, uncited, duplicate, malformed, and legacy reports agree across the screen, dashboard, text plan, and print. Zero-finding reports retain collected evidence in print.
- Filter-empty and report-empty states offer appropriate next actions. Copy, download, and print cover the full report scope intended for each action. Clipboard denial produces an actionable message.

Run the applicable test suite, lint, and production build. Verify the actual section through normal navigation in the running application. Check 320, 390, 768, 1024, and 1440px, a width near the layout transition, and enlarged text. Exercise filters, keyboard navigation, cross-links, copy, download, and the browser print entry point where the environment permits. Use isolated fixtures for repeatable edge cases. Label fixture screenshots as illustrative and record which checks used a live audit. Verify the running tab serves the updated build before collecting screenshots.

Deliver the implemented workspace, representative desktop and mobile screenshots, checks actually performed, and any limitations observed during verification.
