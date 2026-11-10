# SiteAudit AI · AI Visibility redesign

## Review of the current section

I reviewed the section, evidence collector, verifier, dashboard scoring, and export code. I also opened the current app in isolated Chromium sessions at 1440px and 390px using the existing illustrative bakery report. In that report, the action-plan heading started about 2,411px down the desktop page and 4,409px down the mobile page. Selecting the second page and returning from User experience reset the inspector to its first page at both widths.

| Current behavior | Effect on the workflow | Redesign direction |
| --- | --- | --- |
| A large introduction, four assessment cards, the page inspector, and strengths come before the findings. | Users have to scroll through the methodology and evidence inventory to reach their first practical improvement. | Start with a compact snapshot and put **Findings** and **Page evidence** immediately below it. |
| Findings have separate evidence and implementation disclosures. The inspector has a separate index-based picker. | Moving from a finding to the collected page takes several steps. Query variants can look identical in the picker, and switching sections resets the page. | Show one selected finding with evidence and steps together. Add exact-page cross-links and preserve state per report. |
| The snapshot and cards calculate from the raw criterion array. The dashboard applies additional eligibility rules. | Partial or malformed saved reports can show a score in one place and a different score or coverage in another. | Build the screen, dashboard, and exports from one validated readiness assessment. |
| The inspector shows excerpts and markup. Collected headings and metadata exist in the evidence model, but are less accessible in the page view. | Users cannot easily compare the wording, context, and structure of one collected page. | Group available page evidence by content, headings and metadata, and markup. Label each collection state explicitly. |
| Text and print already share a serializer, but observations are deduplicated by ID alone. The plan has limited linkage from a finding or score to its source. | Reused IDs on different pages can drop evidence. Readers must hunt for the material behind a recommendation. | Give each observation a page-scoped identity and cite it next to the relevant statement in the export. |

The review supports qualitative observations about collected content. Live AI appearances, rankings, crawler access, and referral traffic are outside its scope. The redesign should make that boundary visible in the snapshot and provide a practical guide for users who want to measure those outcomes separately.

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, information architect, UX writer, accessibility specialist, and front-end engineer. Redesign the **AI visibility** section of the existing SiteAudit AI Next.js, React, and TypeScript application. Implement the redesign and connect it to completed reports through the existing `aeo` destination.

The workflow is **choose a supported content improvement → inspect the actual wording or structure → make the change → verify it**. Let the user inspect a collected page even when there are no supported findings.

### 1. Read the current implementation

Read applicable `AGENTS.md` instructions and the relevant installed Next.js documentation before changing framework behavior. Inspect these files and their callers.

- `src/components/AIVisibilitySection.tsx`, its CSS module, and `AIVisibilityEvidence.tsx`.
- `src/lib/ai-visibility.ts`, `src/lib/ai-visibility-presentation.ts`, `src/lib/review-workspace.ts`, and the AI readiness assessment in `src/lib/dashboard.ts`.
- `src/lib/server/ai-visibility-evidence.ts`, `ai-visibility.ts`, and `ai-visibility-schemas.ts` in the server directory.
- `src/components/TabPanel.tsx`, `navigation.ts`, `AppShell.tsx`, `PrintReport.tsx`, and the shared review components.
- The redesigned Conversion and Search optimization sections for layout, state, page navigation, and export patterns.
- `tests/ai-visibility.test.ts`, `tests/ai-visibility-component.test.ts`, `tests/ai-visibility-fixtures.ts`, and the dashboard and workspace tests.

Use `result.aeoAnalysis.review` for the current evidence review and `result.aeoAnalysis.issues` for retained findings. Preserve the collection and two-pass verification flow, linked quick wins, report navigation, and generated fix-step callbacks. Opening a section, switching views, filtering, inspecting, or exporting operates locally on the completed report.

### 2. Make the first screen useful

Keep **AI visibility** as the navigation and section label. Keep the audited domain as the report H1. Describe the task in plain language, such as “Review how clearly your pages explain their topic, answer questions, and support important claims.”

Use this order.

1. Section heading and a compact action row with **Copy readiness plan** and **Download readiness plan**.
2. A compact snapshot with **Content readiness**, assessed-criterion coverage, supported findings, and collected pages. Put “Live AI appearances and citations were not measured” beside the score or scope.
3. **Findings** and **Page evidence** as the two main views.
4. A collapsible **Assessment and strengths** area with the retained summary, all four criteria, and cited strengths.
5. A compact **Measure visibility separately** guide with collection limitations and official references.

Use one qualitative score out of 100. Show **Not assessed** when unavailable and keep a valid zero visible. A small, accurately scaled meter is optional. Make the distinction between the report score, the number of collected pages, and the number of collected observations clear. Avoid a full-width promotional hero, repeated limitations banners, and meter graphics that take space from the first useful action.

### 3. Turn Findings into a working view

Default to the highest-priority retained finding using the existing stable priority order. On wide report layouts, show a compact finding list beside a single detail panel. On narrow layouts, use a labeled native finding selector or a short list before the selected detail.

- Show title, text priority, recorded criterion when present, and source-page label when useful. Distinguish same-title findings in the selector with page or a stable display number. Use `reviewIssues` occurrence keys for state, rendering, and fix-step lookup.
- Provide **All**, **High**, **Medium**, and **Low** with contextual counts, and a compact criterion filter where useful. Offer a source-page filter for multiple pages or when arriving from Page evidence. Unknown criterion values stay discoverable under **All**.
- Show the matching count and a working **Clear filters** action. Keep the overall supported finding count independent of filters. Retain the selected identity when it is still available. If filters hide it, render a valid result or the applicable empty state.
- Differentiate no supported findings in the report, no findings for the selected page, and no findings matching filters. If the report still has recorded observations, offer **Inspect page evidence**. A report without findings is a statement about the collected sample.

Lay out the selected finding as **Why it matters**, **What the audit observed**, **Suggested change**, and **How to check it**. Show the retained explanation and steps. Quote collected copy faithfully with its page, heading or region, and sampling label where recorded. Render heading, metadata, and markup records as structured values. Call these references **Audit sources** or **Collected evidence**, so users can distinguish them from citations in an actual AI answer.

When there are no stored fix steps, retain the existing explicit generation flow where supported. Reuse the shared generator, stable occurrence key, legacy title-key fallback, loading, cancel, timeout, retry, and late-response protection. An unavailable action needs an honest state with the evidence still visible. Keep user-triggered draft guidance visibly separate from collected wording. Preserve the requirement to verify any proposed factual claim before publishing.

Add two short, contextual manual checks. For an answer finding, compare the revision against the question a visitor needs answered and verify the details. For identity, check that the page accurately identifies the organization, offer, and relevant scope. For supporting detail, confirm the underlying source, date, qualification, or constraint where applicable. For structure, verify that the heading describes the material immediately below it. Present these as future checks.

### 4. Connect the finding to its exact source

For each cited page with an inspector record, offer **Inspect source page** beside **Open audited page**. The first action selects the precise recorded page in Page evidence and moves focus to the view heading. The second opens a safe HTTP(S) link to the source. From Page evidence, **View findings for this page** switches back, selects that source-page filter, and clears other filters so the user sees all relevant priorities and criteria.

Use the app’s credential-free HTTP(S) URL normalization. Keep the full path and query string in page identity and visible labels. Ignore fragments for page identity. Keep distinct query variants separate. Match findings to a known primary page or any retained source, with each finding counted once per filtered list. Group repeated links to the same page where helpful, while keeping distinct source observations readable. Where source detail is missing or invalid, show a clear unavailable state. Reserve the report URL for report identity.

Keep the selected view, filter values, finding, and inspected page for the same report when navigating away. The current `TabPanel` conditionally unmounts AI visibility when the active section changes. Keep this workspace mounted behind a hidden wrapper or use an equivalent report-scoped state design. Reset local state for a new `analysisId` or the existing `analyzedAt` fallback. Ordinary view switches retain state. Cross-links set the destination context deliberately.

### 5. Build Page evidence around the collected page

Use the recorded page inventory from the completed audit. When validated `pagesAnalyzed` records are supplied, use them for page identity and coverage. Match the detailed `review.pages` records by URL. A collected page with sparse AI-specific evidence remains selectable and gets a useful empty state. For a saved report without the newer page inventory, fall back to the available recorded review pages and sources with an explicit scope. Never count a source link or cited external destination as a collected page.

Show the selected title and full page URL, a labeled picker when there is a real choice, and the page collection timestamp only when it is available for that page. Place the content and markup next to each other when space permits. Stack the page identity, content, and technical details in that order on mobile.

| Group | Required behavior |
| --- | --- |
| **Collected wording** | Show a short initial set of actual excerpts with heading, region, and sampling information. Offer **Show all collected excerpts** when additional records exist. Respect recorded excerpt order and match ID references within the exact page. Preserve other recorded copy for that page. If the sample has no readable copy, show that state without inferring live-page absence. |
| **Headings and page metadata** | Show the recorded title elements, descriptions, and heading outline when available. Keep metadata and headings separate from body quotations. Distinguish an empty collected field from a missing record. |
| **Structured data** | Show JSON-LD block count, unparseable block count, and the declared JSON-LD, Microdata, and RDFa types separately. Show actual zero values for a collected inventory. If `markup.collected` is false or the record is missing, show **Not collected** and omit placeholder zeros and types. Keep malformed technical records readable through a safe fallback. |

Use `AIVisibilityObservations` and the existing parser where useful. Deduplicate evidence by normalized page URL plus source ID. Repeated IDs on different pages remain distinct. Keep source values inert and links validated. Use the page and excerpt sampling indicators with their respective scope. The collector samples long pages and retains bounded excerpts. Show those limits without inferring coverage across the full site.

Label markup as a recorded inventory. JSON parse status and declared types describe what was collected. Vocabulary correctness, rich-result eligibility, crawler behavior, and AI inclusion require separate checks. Avoid implying an automatic score or a requirement for FAQ markup or AI-specific schema. Google’s published guidance for its Search AI features gives the relevant scope for that statement. [Google Search Central guidance](https://developers.google.com/search/docs/appearance/ai-features)

### 6. Use one assessment model across the report

Use `aiVisibilityScore` for the current weighted calculation. Reuse the dashboard’s recorded-page eligibility checks and the shared criterion review logic. Keep the candidate validation and presentation logic outside JSX. Apply the same rules in the dashboard, specialist snapshot, assessment rows, text plan, and print.

| Criterion | Base weight |
| --- | ---: |
| Clear, useful answers | 35 |
| Identity & topic context | 25 |
| Attribution & supporting detail | 25 |
| Readable content structure | 15 |

Include only eligible current-method criteria with a finite score from 0 through 100, a nonempty explanation, and relevant recorded sources. Use the verifier’s existing rule that numeric content criteria require collected copy, with collected headings also eligible for structure. Metadata and markup alone cannot support numeric content scores. Exclude withheld criteria, uncited explanations, invalid values, and unsupported legacy scores. Keep the first eligible record per known criterion under the existing duplicate handling. Reweight the available criteria and round once. Use the number of eligible criteria for coverage. For example, eligible scores of 80 for answers, 60 for identity, and 70 for structure give `(80 × 35 + 60 × 25 + 70 × 15) / 75 ≈ 71.33`, displayed as 71. This example is illustrative.

Render all four rows with their actual eligible explanations and cited observations. When an area is unassessed, show the retained scope reason when available. For a withheld explanation, use a compact unavailable message without rendering the rejected text. Respect `assessmentValidation.summaryWithheld` as well. A partially verified assessment can still have supported findings, readable page evidence, and strengths. Missing optional validation metadata in a saved report needs a safe presentation.

Handle legacy `AEOAnalysis` reports without a current cited review. Keep recorded findings available where supported and provide a concise route to the existing **Run again** action. Earlier FAQ presence, entity coverage, schema, and aggregate values must stay out of the readiness score. Do not use a nominal zero to fill missing data. Keep evidence counts, sample coverage, and verification counts separate. Verification totals can include candidate strengths as well as draft findings.

### 7. Make the measurement guide practical

Use one compact disclosure with an honest status for each area outside the collected content review.

- **Live AI appearances and citations · Not measured.** Choose representative visitor questions. In each service used, record the date, exact question, product or mode, relevant locale or account context, observed response, and cited URLs. Repeat under comparable conditions. Treat the entries as observations for those queries.
- **Crawler access and indexing · Not tested.** With the site owner, check the relevant crawler’s robots.txt rules, server or CDN logs, and available indexing diagnostics. Search, training, and user-initiated retrieval can use different agents or controls. Never infer that a bot crawled or was blocked from a markup declaration, an audit fetch, or a reference link. Link to official guidance for the user’s intended service. [OpenAI crawler guidance](https://developers.openai.com/api/docs/bots) · [Google Search AI controls](https://developers.google.com/search/docs/appearance/ai-features#controlling)
- **Traffic and conversions · Not measured.** Use authorized analytics or search reporting for observed traffic and outcomes. Keep these separate from readiness and avoid displaying platform-specific attribution when the data combines sources.
- **Website claims and credentials · Not independently verified.** Prompt the user to confirm material claims before adding or changing supporting copy.

Keep the guide separate from the qualitative score. References are guidance, and the user can follow them manually. A dashboard that shows live appearances, rankings, or bot status would require real provider-specific collection and evidence. This redesign uses the existing report scope.

### 8. Make export behavior complete and predictable

Reuse `usePlanExport` and `aiVisibilityPlan`. Keep the text download, clipboard copy, and existing full report print entry point. All three use the same eligible assessment and complete AI visibility record. Include retained findings and generated steps, cited summary and strengths, criterion explanations, collected URLs and sampling notes, page observations, markup collection states, and review limits. Associate each cited source with the finding or explanation that uses it. Preserve legacy source and step fallbacks without substituting an unrelated page.

Keep copy and download available with any active view, filter, or selection. In print, preserve useful observations for zero-finding reports. Keep technical detail wrap-safe and allow long report sections to paginate. Use a safe filename from the audited host. Report copy success only after the write resolves. On clipboard failure, show an actionable text-download option. Handle download-start failure with visible feedback. Keep the browser print dialog behavior clear.

### 9. Match the report design and verify the result

Use the existing Inter font, icons, neutral workspace, white panels, and violet interaction states. Give the selected finding and primary actions an unmistakable state with text and visual treatment. Use 14–16px for readable controls and content and 12–13px for supporting metadata. Use tabular numerals for comparable values. Keep panel padding and spacing consistent with the refreshed Conversion and Search optimization workspaces. Base layouts on usable space after the sidebar, and wrap long URLs, headings, source excerpts, and filters.

Use semantic headings, persistent control labels, visible focus, adequate contrast, and accessible status messages. If views are buttons, expose their pressed state and controlled region. If using ARIA tabs, implement their full keyboard and focus behavior. Preserve native disclosures where useful and respect reduced motion.

Adapt existing tests and add regressions where the redesign changes behavior. Verify at least the following.

- Exact-page cross-links for query variants, missing or malformed URLs, reused observation IDs on different pages, sparse collected pages, and multi-source findings.
- Stable finding identity, filtered counts, empty states, keyboard focus, and report-state retention and reset through the normal sidebar and mobile section selector.
- Full and partial scores, valid zero, uncited, duplicate, malformed, withheld, and legacy assessments. Check score and coverage parity with the dashboard and exports, including numeric data incorrectly present on a withheld row.
- Collected markup with zero blocks, uncollected markup, malformed observation data, sampled copy, and pages with no readable excerpts. Check that content and markup never carry over between pages.
- Complete copy, text download, and print with filters active. Verify clipboard failure, zero-finding print, and preservation of generated steps.
- No new audit request during local review interactions. Keep fixtures isolated from production report data.

Run the relevant tests, lint, and the production build. Inspect the updated workspace in the running app at 320, 390, 768, 1024, and 1440px, plus a width near the layout transition and enlarged text. Capture representative desktop and mobile screenshots of both views. State which checks used illustrative fixtures, which used a live audit if applicable, and any remaining verification limits.
