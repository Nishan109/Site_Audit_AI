# SiteAudit AI: Messaging & copy analysis and redesign prompt

## What this review covers

This brief is based on the current implementation of MessagingSection.tsx, ReviewWorkspace.tsx and its CSS module, ReviewEvidence.tsx, the messaging model and presentation helpers, report navigation/state ownership, and the related component tests. The existing 1440px and 390px Messaging screenshots were also inspected. Those screenshots are clearly labeled fixture reports from the previous verification run; they are visual references, not new live audits or evidence of measured user behavior.

This request prepares a focused redesign prompt. It does not implement another UI revision.

## Current strengths

- The large promotional hero and score ring have already been replaced by a compact summary.
- Findings already retain their priority, source page, explanation, source wording, and practical steps.
- Wording suggestions support editing, restoration, copying, complete plan export, empty edits, and explicit unreviewed-edit labels.
- Scoring uses source-eligible criteria, preserves valid zero scores, and distinguishes missing assessments.
- Filtering, finding identity, per-report draft retention, missing-step handling, and late-response cancellation already have meaningful tests.

## Where the current UI can improve

| Observation | Effect on the experience | Proposed response |
| --- | --- | --- |
| The active finding renders its explanation, full evidence cards, and implementation steps before the wording editor. | The main editing task appears late in a long article, especially on mobile. | Put the actual current/draft comparison immediately after a short finding explanation. |
| The original wording can appear in an evidence card and again in the comparison. | The user rereads the same wording before taking action. | Use one source-linked current-copy presentation, with additional supporting facts in a disclosure. |
| Expanded findings occupy substantial vertical space before the next finding. | Comparing findings requires scrolling past a complete detail/editor stack. | Use a compact finding queue and one active editing panel. |
| The right column is dedicated to assessments and a summary. | Useful editor width is spent on information that is secondary during revision. | Give the wider panel to editing and move assessment explanations into a compact secondary disclosure. |
| The summary strip, priority controls, focus-area selector, wording toggle and result count form several rows. | Users make several scanning decisions before reaching the task. | Use a modest summary line and one organized filter area; keep less-used controls secondary. |
| The current suggestion label remains “Suggested draft” after editing, supplemented by a separate edited badge. | Ownership and review status take more interpretation than necessary. | Use an explicit draft status and consistent labels for an AI option versus the user's revision. |
| Session retention information is inside a lower scope disclosure. | Users may assume an edited draft survives a reload. | Place a brief, accurate retention note near editing/export actions. |

These are design judgments grounded in the current code and screenshots. The recommendation is to make Messaging a focused copy-review workspace while preserving the audit's evidence and limits.

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, interaction designer, UX writer, accessibility specialist, and front-end engineer.

Redesign and implement **only the Messaging & copy workspace** in the existing SiteAudit AI Next.js, React, and TypeScript application.

Create a professional, focused copy-review workspace that makes the next useful action obvious. Build the finished interface and connect its controls using existing report data and callbacks.

### 1. Establish the purpose and scope

The user should be able to:

1. Choose a supported messaging finding.
2. Understand the specific wording concern.
3. See the actual current copy and its source.
4. Compare it with an existing, evidence-backed wording option.
5. Edit and copy a draft, or export the complete copy plan.

The section reviews collected website wording. It does not measure visitor comprehension, conversion rates, business results, or the commercial effectiveness of a revision.

Preserve the landing page, completed-audit overview, app shell, report header, other specialist sections, live audit collection, research, timeout handling, and generated fix-step workflows. Do not redesign Search optimization, Conversion, Quick wins, User experience, or creative tools as part of this task.

Opening the section, selecting findings, filtering, editing, copying and exporting must not start a new AI review. Additional implementation steps may be requested only through the existing explicit generation action.

### 2. Inspect the actual architecture before editing

Read applicable AGENTS.md instructions. Consult the relevant installed Next.js documentation before changing framework behavior.

Inspect:

- src/components/MessagingSection.tsx.
- src/components/ReviewWorkspace.tsx and ReviewWorkspace.module.css.
- src/components/ReviewEvidence.tsx.
- src/components/MessagingReview.tsx, MessagingEvidence.tsx, and IssueCard.tsx for remaining shared/legacy consumers.
- src/lib/messaging.ts and messaging-presentation.ts.
- src/lib/review-workspace.ts, dashboard.ts, and types.ts.
- src/components/TabPanel.tsx, navigation.ts, and src/app/page.tsx.
- ReportHeader.tsx and PrintReport.tsx for export boundaries.
- tests/messaging-component.test.ts, messaging.test.ts, review-workspace-component.test.ts, review-workspace.test.ts, and relevant fixtures.

Understand stable finding keys, report-scoped state, eligible score calculation, source shapes, generated-step lookup, and draft-aware exports. Preserve existing behavior instead of replacing working functionality with placeholders.

### 3. Use a finding queue and one active editing panel

Replace the repeated expanded article/editor stack with a focused layout.

At sufficiently wide content widths:

- A compact finding queue occupies approximately 260–300px.
- A wider active-finding panel receives the remaining space.
- Do not add a third assessment rail beside them.
- Preserve a coherent page scroll rather than creating several small, independently scrolling panels.

Choose the layout based on the actual content width after the app sidebar and page padding. Around 960px of available workspace width is a reasonable starting point for the two-column layout, subject to verification.

On narrower screens, replace the permanently expanded queue with a clearly labeled native finding selector and an accessible “Browse findings” disclosure if useful. Show the active finding and draft before a long list of other findings or assessment criteria.

Keep the main task understandable without requiring users to interpret multiple dashboards, tabs, or score cards.

### 4. Keep the section header and summary compact

Retain the existing report identity and the single Messaging & copy section H2. Do not introduce a second promotional title or another H1.

Use one concise description, such as:

“Choose a finding, compare the wording, and refine your next draft.”

Provide a compact section export area. Keep full-plan actions quieter than the active draft's copy action.

Use a restrained summary strip or line showing available real data:

- Messaging assessment, with its qualitative label.
- Assessed-area coverage.
- Full supported-finding count.
- Number of findings with wording options.
- Recorded collection scope where known.

Avoid recreating several large metric cards. Do not use missing metadata as a zero-page statement; use “Scope not recorded” or another accurate missing state when collection scope is unavailable.

Keep full counts stable during filtering. If source-eligible assessment data is unavailable, display “Not assessed.” A valid zero must remain zero.

### 5. Make the finding queue scannable

Each queue entry should show:

- Actual finding title.
- Text priority label.
- Messaging area.
- A short source-page label where useful.
- “Wording option available” only when copySuggestion exists.
- An unmistakable selected state.

Use concise rows or small list cards, with a clear selected border/background and accessible state. Use native buttons for selection. Do not apply listbox or tab semantics unless the corresponding keyboard behavior is actually implemented. Avoid nesting links and buttons inside a clickable selection button.

Use the existing High → Medium → Low order and preserve the retained order within ties. Initially select the first retained finding, regardless of whether it has an AI wording option. Do not rank a lower-priority finding first merely because it has an editor.

Make the first finding's recommended-starting-point treatment modest and qualitative. Do not invent an impact score or urgency measurement.

For long lists, show a reasonable initial number and a working show-more action. A finding's identity must never come from its filtered row position.

### 6. Put the copy comparison near the top of the active panel

Use this active-panel order when a wording option exists:

1. Priority, area and actual finding title.
2. Brief retained explanation of the wording concern.
3. Current copy versus editable draft.
4. Copy and restore actions, with concise status/retention information.
5. Supporting facts and source context.
6. Existing implementation steps or the explicit generation action.

The comparison should be the principal working surface. Do not force users to pass several full evidence cards and an implementation checklist before reaching it.

Keep long explanations accessible through a “Read full explanation” control where necessary. Do not generate an unsupported summary to shorten the text.

Use one source-linked presentation of the original wording. If the same excerpt also exists in supporting evidence, avoid displaying an identical expanded quotation twice by default. Keep all source associations and full evidence accessible.

### 7. Make current wording and user drafts unambiguous

For copySuggestion, use:

- **Current copy:** exact original collected wording, read-only.
- **Your draft:** the existing replacement, editable.
- **AI wording option:** initial status when the draft matches the supplied replacement.
- **Edited by you:** status after an actual change.
- **Copy wording:** prominent action that copies the current textarea value.
- **Restore suggestion:** secondary action available when the draft differs.

Display the source page near the original. Use source kind/region metadata when recorded, such as a heading or main-content excerpt. Do not invent the exact placement or claim a quotation appeared above the fold.

Use side-by-side panes only when both remain readable. Stack current wording before the draft on small screens. Short headlines should be visible in full. For lengthy text, provide an explicit expand control rather than silently truncating important content.

Keep the current 2,400-character draft limit. Preserve line breaks, punctuation, intentionally empty edits, and user-entered text. A character counter may indicate length, but it must not imply copy quality.

Disable copying an empty/whitespace-only draft. Restoring should recover the existing suggestion exactly and return its status to the unedited AI option. Editing or restoring must not change the recorded assessment score.

Keep one concise note near the editor: edits have not been re-reviewed, copying does not publish changes, and drafts are retained only within the current report session. Use the full scope disclosure for longer explanations.

Do not add “Saved,” “Published,” “AI verified,” or “Ready to publish” states without working behavior and data that justify them.

### 8. Handle findings without a wording option honestly

If no grounded replacement was supplied, keep the active finding useful:

- Show its actual explanation and recorded evidence.
- Show existing implementation steps.
- Offer the existing explicit generation action when steps are absent.
- State that no wording draft was included in this review.

Do not fabricate replacement copy, infer a new offer, or show an empty editor that appears to be an AI result.

Missing fix steps must never remove an otherwise available wording editor. Use one coherent active panel with optional modules, rather than switching to an incompatible legacy layout because a field is absent.

If any optional “Show changes” feature is added, derive it deterministically from the original wording and current draft. It shows textual differences only and must not claim that highlighted changes improve performance. Complete the core experience before adding this optional feature.

### 9. Keep evidence easy to inspect

Preserve actual CopySource data: quote, pageUrl, kind, region, destination, and renderingNote where supplied.

Keep the original wording visible and place additional material behind clearly named disclosures such as “Supporting facts” and “View source context.” Show exact supporting quotations and page links. Distinguish the sources used to identify the finding from facts used to support a wording suggestion when these differ.

Do not invent evidence, URLs, collection timestamps, or facts to make the panel feel complete. If a timestamp is displayed, connect it to an actual recorded field. Otherwise omit it.

Preserve safe source URL handling and render website text as text. Do not introduce raw HTML rendering for copy or diff highlighting.

Do not turn sampled HTML wording into claims about rendered appearance, complete website coverage, independently certified business facts, visitor behavior, or actual conversions.

### 10. Simplify filters and define selection behavior

Keep priority filtering and the ability to find entries with wording options. Put the area selector in a compact secondary position. Avoid presenting multiple equally prominent filter rows before the active task.

Search is optional. Add it only if the list length warrants it, label it clearly, and keep it local to retained report findings. Do not suggest a web search or a new AI review.

Use a predictable selection policy:

- Retain the active finding if it still matches the filters.
- Otherwise show the first matching finding in retained priority order.
- Keep all edited drafts, including those hidden by filters.
- If no findings match, show a filter-empty state with reset; do not show an unrelated active finding as though it matched.
- Do not start a model request when selection changes.

Distinguish full section totals from the matching result count. No-match and no-supported-findings states must use different explanations.

Keep focus on the control the user operated while filtering. Selecting a finding may expose a named “Edit draft” action that focuses its textarea. Avoid unexpected focus jumps on every state change.

### 11. Preserve stable identity and report-scoped state

Use reviewIssues and reviewIssueKey, or compatible existing identity helpers. Preserve associations with dashboard findings and generated steps. Do not use a title alone or a visible index as selection/draft identity.

Preserve the active finding, filters, edited drafts, and relevant disclosures while users visit another section and return within the same audit.

Reset state for a new report using analysisId or analyzedAt. Retain the documented behavior that reload/new audit clears session drafts unless durable storage is explicitly implemented as a separate feature.

Test same-title findings from different pages and exact duplicate records. One finding's generated steps, edits, copy feedback, or selection state must not attach to another.

Retain cancellation, request timeouts and late-response guards. Switching reports must prevent an older generation reply from updating the new report. Pending clipboard success must not describe an older draft after the user edits it.

### 12. Keep assessment details accurate and secondary

Use reviewedCriteria, messagingScore, and existing dashboard eligibility as the authority. Preserve the current criteria and weights:

- Purpose & message clarity: 35%.
- Audience & next-step clarity: 25%.
- Specific, supportable language: 25%.
- Consistency & readability: 15%.

Exclude missing, invalid, uncited or unavailable assessments. Reweight available eligible areas using the existing calculation and rounding. Preserve zero. Do not implement another score formula inside the UI.

Place the complete criterion breakdown, reasons and source quotations in a compact “Assessment details” disclosure below the working area or another clearly secondary location. Keep the numeric score labeled as a qualitative assessment, not completion progress or a measured outcome.

Keep supported strengths and sampling/verification limitations available. Do not display a new summary, inferred confidence percentage, predicted conversion lift, or automatic revised score after editing.

### 13. Preserve full-plan exports and honest feedback

Continue using messagingPlan for full copy-plan exports. Include every retained finding, full sources, applicable generated/retained steps, current draft values, and draft status, regardless of selection or filters.

Preserve intentionally empty edits in exports instead of silently substituting the original AI replacement. Keep current website wording distinguishable from proposed and user-edited text.

Keep “Copy wording” scoped to the active draft. Label full-plan actions distinctly so users can predict what will be copied or downloaded.

Clipboard failure needs visible, actionable feedback and a working text-download alternative. Keep stale-operation protection. Handle download-start failure, clean up object URLs/temporary anchors, and announce download initiation without claiming the file was saved.

Preserve the global recorded-report PDF/print entry point. Do not claim that it includes local draft edits unless those inputs are actually connected and verified. Current section text exports already support drafts and should retain that behavior.

### 14. Use a professional visual and responsive system

Match SiteAudit AI's current neutral off-white workspace, white surfaces, deep ink text, readable slate support text, and restrained violet accents. Reuse existing tokens and Inter/icon assets.

Use approximately:

- 24–28px section heading.
- 18–20px active finding heading.
- 14–16px working text, labels and controls.
- At least 16px mobile textarea text.
- 12–13px secondary metadata.
- 20–24px panel padding and an 8px spacing rhythm.

Use tabular numerals for comparable scores/counts. Keep borders subtle, selection clear, and shadows restrained. Reduce repeated card nesting and pale decorative labels. Do not add a hero illustration, fake browser frame, generic dashboard charts, or a website screenshot that was not collected.

Give the draft enough room to read and edit comfortably. Avoid a third column that squeezes both original and draft into narrow strips. Keep copy actions nearby without sticky overlays covering text or mobile keyboards.

At 320, 390, 768, 1024 and 1440px, plus intermediate widths and zoom, verify long domains, long finding titles, extended copy, empty states and wrapped controls. Adapt to available content width after the desktop sidebar. Do not introduce horizontal page scrolling.

### 15. Accessibility, implementation and verification

Use logical headings, persistent editor labels, native selection/disclosure controls, semantic links, visible focus, and appropriate selected/expanded state. Aim for WCAG 2.2 AA and verify actual contrast combinations. Announce copy/export feedback and meaningful selection changes without excessive live-region noise.

Use a Messaging-specific CSS module and a small number of focused components where helpful. Reuse the existing evidence, export and step-generation logic. Add opt-in shared component behavior only when necessary. Do not globally reorder ReviewFindings or restyle ReviewWorkspace in ways that change other specialist sections.

Run existing model and component tests. Add focused coverage for:

- Initial priority-based selection and clear queue selection state.
- Selection/filter transitions and full-count versus matching-count semantics.
- Editor availability when steps are missing.
- No replacement, no findings, filtered empty, legacy and partial assessment states.
- Exact original/suggested text, edits, restoration, empty drafts and copy disabling.
- Same-title/different-page findings, duplicate records and stable generated-step lookup.
- State preservation within an audit and reset for a new report.
- Full exports despite hidden/unselected findings; clipboard denial, stale feedback and download failure.
- Explicit generation loading, failure, retry, timeout and cancellation; no requests caused by normal navigation or editing.
- Keyboard use, focus, screen reading order, text contrast, narrow widths and zoom.
- Other specialist workspaces and global recorded-report exports remain intact.

Run npm test, npm run lint and npm run build. Inspect real desktop/mobile screenshots of the implemented components. Keep fixtures isolated from live reports and clearly label illustrative screenshots. Capture queue selection, current/draft comparison, edited state, supporting evidence and empty/error states.

Deliver the finished Messaging & copy workspace, representative screenshots, checks actually performed, and any remaining limitations. Explain the improved user journey. Do not stop after supplying a design mockup or pretend that a UI redesign independently validates the website's copy performance.
