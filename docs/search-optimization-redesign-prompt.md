# SiteAudit AI Search optimization redesign

## Current section review

This review combines the current source code, the existing SEO tests, and two saved browser screenshots from the specialist workspace verification. The screenshots use an illustrative bakery report. The analysis covers the application’s layout and evidence handling. [Desktop report](./verification/specialist-workspaces/seo-1440.png) · [Mobile page inspector](./verification/specialist-workspaces/seo-inspector-390.png)

The current section already has a compact heading, source-backed scoring, priority and area filters, evidence disclosures, implementation steps, and complete text exports. The per-page inspector presents recorded metadata, an illustrative search listing, and observed signals. The report retains SEO filters and the inspector’s selected page when the user visits another section.

| Current behavior | Effect on the workflow | Redesign direction |
| --- | --- | --- |
| The page inspector is a disclosure after the findings and assessments. | On mobile, users scroll past the expanded finding, other findings, and assessment cards before reaching the page selector. | Put **Findings** and **Page signals** within reach directly below the summary. |
| The finding column expands evidence and steps inside individual cards. | Comparing findings takes more scrolling, and the desktop assessment rail uses space that could help with reading long evidence. | Use a compact finding list and a single detail panel. Move assessment explanations below the main task. |
| A finding links to the external page, while the inspector has an independent page selector. | The user must locate the matching page again to see its recorded metadata or canonical declarations. | Add **Inspect source page** for the exact recorded page, alongside a distinct **Open audited page** link. |
| The inspector shows a search preview, check disclosures, and a separate declarations list. | Users can encounter the same signal in several places. | Group observations by SEO task and place the check detail beside the relevant values. |
| The preview uses the first non-empty title and description. | When multiple values were collected, the preview alone does not tell the user which values were omitted. | Explain which values the preview uses and provide a disclosure for all recorded values. |
| Inspector evidence is matched to a check by source ID. The text plan also deduplicates sources by ID alone. | Reused IDs in older or imported records can mix or drop observations from different pages. | Match and deduplicate observations using recorded page identity plus source ID. |
| The specialist screen uses eligible criteria, while the print detail block renders raw criterion values. The text serializer also looks up eligible keys while iterating raw rows. | Duplicate or ineligible criterion rows in saved data can produce inconsistent detail across the screen and exports. | Build presentation and export rows from the eligible criterion records. Show excluded rows as unassessed with their actual scope. |

The proposed design has two workflows. **Findings** helps users select a supported change, inspect its evidence, and review implementation steps. **Page signals** helps them inspect what was collected for a particular URL, even when the report contains no supported findings.

The design treats title and snippet previews as illustrations. Google can choose different title links and snippets, and display length depends on available space. A declared canonical expresses a preference. Actual indexing and Google-selected canonicals require separate inspection. [Google title links](https://developers.google.com/search/docs/appearance/title-link) · [Google snippets](https://developers.google.com/search/docs/appearance/snippet) · [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [Search Console URL Inspection](https://support.google.com/webmasters/answer/9012289)

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, interaction designer, accessibility specialist, UX writer, and front-end engineer. Implement a focused redesign of the **Search optimization** section in the existing SiteAudit AI Next.js, React, and TypeScript application.

### 1. Scope the redesign

Build a professional SEO review workspace for a completed audit. Users should be able to find a worthwhile improvement, read the evidence for it, inspect the recorded signals for the affected page, and export the full SEO plan.

Limit changes to the SEO workspace and any shared presentation or export changes required to support it. Keep the `seo` navigation destination and the existing report identity, shell, overview, and specialist workflows. Reuse recorded report data and callbacks. Opening the section, switching views, selecting pages, filtering, and exporting must work locally on the completed report. Keep fix-step generation an explicit action for one selected finding. The audit collector, SEO verifier, assessment recovery, research retries, and other review services should continue through their existing entry points.

### 2. Inspect the actual implementation

Read applicable `AGENTS.md` files and the relevant installed Next.js documentation before changing framework behavior. Inspect the following files and the existing screenshot fixtures.

- `src/components/SEOSection.tsx`, `SEOSection.module.css`, `SEOPageInspector.tsx`, and `SEOEvidence.tsx`.
- `src/components/ReviewWorkspace.tsx`, `ReviewWorkspace.module.css`, and `ReviewEvidence.tsx` for shared controls, generation, export, and evidence behavior.
- `src/components/UXSection.tsx` and `MessagingSection.tsx` for current specialist styling, finding selection, and responsive patterns.
- `src/lib/seo.ts`, `seo-presentation.ts`, `review-workspace.ts`, `dashboard.ts`, and `types.ts`.
- `src/lib/server/seo.ts`, `seo-evidence.ts`, and `seo-assessment.ts` to understand what the report can establish.
- `src/components/TabPanel.tsx`, `navigation.ts`, `ReportHeader.tsx`, `PrintReport.tsx`, and `src/app/page.tsx` for navigation and export boundaries.
- `tests/seo-component.test.ts`, `seo.test.ts`, `review-workspace.test.ts`, and `review-workspace-component.test.ts`.
- `tests/review-workspace-fixtures.ts` and `scripts/verify-review-ui.mjs` for controlled browser checks.

Identify all consumers of shared components and helpers before changing their behavior. Use scoped SEO styles and opt-in presentation changes where useful.

### 3. Set the page hierarchy

Keep the audited domain as H1 and **Search optimization** as the section H2. Follow it with a short task description, the SEO plan actions, a compact assessment summary, and a visible choice between Findings and Page signals. Place detailed criteria, recorded strengths, and scope information after the working area.

Use plain copy such as “Review supported improvements and inspect the search signals collected for each page.” Keep the global report export in the existing header and label the section actions **Copy SEO plan** and **Download SEO plan (.txt)**.

The summary should show the qualitative on-page score or **Not assessed**, assessed criteria out of four, total retained SEO findings, and the number of collected pages. If displaying High priority, describe it as a subset of the finding count. Show response-header coverage separately when it helps explain what was collected. Label missing coverage as **Not recorded** where the report lacks a reliable value. Keep **Indexing and rankings not tested** visible without opening the method disclosure.

### 4. Give each view a clear job

Make **Findings** the initial view for a new report. Add an equally visible **Page signals** control beside it. Use a labeled button group with an exposed selected state or a fully implemented accessible tabs pattern. Inactive content must stay outside the keyboard order and accessibility tree.

Normal switching between the views preserves the finding filters, selected finding, selected inspector page, and relevant disclosures. When switching through a cross-link, make the specific target clear.

- **Inspect source page** opens Page signals for the exact page attached to the finding or chosen evidence item.
- **View findings for this page** opens Findings with that page explicitly selected and shows all priorities and areas for that page. Announce the resulting filter state and provide a clear way to return to all findings.
- **Open audited page** opens the recorded page URL through a safe external link.

Keep the page filter and inspector selection separate. Changing the inspector page by itself leaves the report-wide findings untouched. Show the page currently being inspected and distinguish page-level counts from report-level totals. If a finding spans several pages, use the primary recorded page for the main inspector action and label any additional source links individually. If no matching page inventory is available, retain the recorded source evidence and explain that page inspection is unavailable for that item.

### 5. Build a focused finding workspace

On wider available content, use a compact finding list of about 260–300px and give the remaining width to one active detail panel. Use a narrow-screen native selector labeled **Choose an SEO finding**, with the active finding before any long list. Base the layout on workspace width after the sidebar and page padding. Around 960px of available width is a starting point to test.

Use the retained priority order High, Medium, Low with stable order within each group. Default to the first retained finding. Use the shared `reviewIssues` identity conventions for keys, selection, disclosures, and generation. Preserve distinct identities for same-title findings on different pages and exact duplicate occurrences. Keep the initial list concise and provide an accessible expansion if the actual list is longer.

Keep priority filters and the SEO review-area selector. Add a recorded-page filter for cross-navigation and for multi-page reports where useful. Provide a visible filtered result count and **Reset filters**. Report-wide counts should stay consistent while the visible set changes. Keep the selected finding if it still matches and otherwise select the first matching record. When nothing matches, show a reset action. When the report itself has no findings, show a neutral explanation and a route to inspect the collected pages. Give older findings without an explicit SEO criterion a reachable **Other / earlier findings** option.

Each finding row should show its title, priority, and review area. Show a source label when it distinguishes records. The active panel should present the retained explanation, recorded observations, exact source links, the recommended steps, and the scope of any manual follow-up. Keep long explanations readable. Preserve the complete recorded text when using a disclosure. A visible selected state and a keyboard route into the detail panel should make it easy to use without moving focus on every selection.

### 6. Render evidence faithfully

Use `SEOSource`, `seoObservationRows`, and `ReviewEvidence` where their behavior fits. Show observed fields as labeled values. Keep JSON and technical details in a disclosure. Structured `seoEvidence` must remain visible when plain `issue.evidence` or fix steps are absent. Present saved plain evidence with a label that reflects its actual format. If the source URL was not recorded, say so and keep the submitted URL clearly labeled as the audited address.

Resolve source references by page identity and source ID. Use the existing safe URL normalization conventions and preserve meaningful paths and query strings. Keep different query variants and distinct collected URLs separate. Resolve links to recorded HTTP(S) URLs and display unsupported or malformed values as text. When an old or malformed observation cannot be parsed, show its saved text without crashing the report. Do not render collected strings as HTML or execute copied markup.

Reuse `ReviewFixSteps` or equivalent existing behavior. Keep evidence accessible during loading, timeout, failure, retry, and cancellation. Use occurrence-specific keys for new generation and preserve existing saved-step compatibility. If keys change, update the SEO serializer and print consumer together. Generated steps should be labeled as suggestions for the user to review.

### 7. Make Page signals useful on its own

Use the recorded `analysis.pages` as the inspector inventory. Label the page control **Collected page** and give it the accessible name **SEO page to inspect** or an equally specific label. Display the selected URL and actual header-collection state. For a single recorded page, a readable page identity can replace a selector with only one option. For multiple pages, keep the selector operable on mobile and distinguish pages with similar paths or different queries.

Group the recorded fields by task.

| Group | Show from the report |
| --- | --- |
| Titles and descriptions | All collected title and meta-description values, declared HTML language when available, and the illustrative listing. |
| Canonical and directives | Declared and resolved canonical values, HTML versus HTTP origin, crawler or agent names, actual directive values, response status, and header availability. |
| Content and page structure | Ordered collected headings, recorded content excerpts, and sampled internal links with their actual labels and declared destinations. |
| Structured data | JSON-LD block and parse-error counts when recorded, plus recorded JSON-LD, microdata, and RDFa types. |

Place check details next to their related field group, with a single route to the supporting observation. Preserve the recorded statuses **Observed**, **Review**, **Not observed**, and **Not assessed**. Explain them in a compact method note. A status describes a collected signal or its availability. Use plain text and color together, with neutral styling for presence and unavailable information. A deterministic **Review** status must stay distinct from an independently verified finding. Keep the two counts separate.

Handle absent page inventories, missing check arrays in earlier records, empty groups, unavailable headers, and truncated samples. Keep the report summary and findings usable if the inspector cannot render a page. Show recorded values that are available and distinguish unavailable fields from a recorded empty value or numeric zero.

### 8. Present the search listing preview honestly

Create a restrained card headed **Illustrative search listing** with a visible **Preview only** label. Show the recorded URL, first non-empty collected title, and first non-empty meta description for the selected page. Render them as text with readable wrapping. Explain that Google may choose different wording. Show placeholders such as **No title collected** or **No description collected** as separate interface messages. Do not insert suggested or synthetic search copy into an observed preview.

When several titles or descriptions were recorded, state which value the illustration uses and provide access to all original values. Character counts may be shown as secondary information. Keep counts neutral and avoid fixed-length targets, red overflow warnings, SEO penalties, or ranking forecasts based on length. Avoid Google branding or simulated rank positions. [Google title links](https://developers.google.com/search/docs/appearance/title-link) · [Google snippets](https://developers.google.com/search/docs/appearance/snippet)

Put the preview beside supporting page signals where the content width allows. On small screens, place page identity and the selector first, then the preview and grouped evidence. Preserve full collected text when wrapping or shortening a preview display. Page changes should update the preview and every related signal group together.

### 9. Respect the boundaries of the audit

Use the following distinctions in labels, check details, and exports.

- Canonical declarations are recorded preferences. Show the declaration method and exact target. Keep Google-selected canonical and actual indexing as separate follow-up checks. An unavailable header leaves the HTTP canonical unknown. [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [Search Console URL Inspection](https://support.google.com/webmasters/answer/9012289)
- A recorded `noindex` or `none` value needs the recorded crawler and declaration method. Preserve the existing check detail and suggest confirming intent where appropriate. Absence in the collected sample leaves wider crawling and indexing unresolved. Keep page and header directives distinct from `robots.txt` coverage. [Robots meta tags and HTTP headers](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- JSON parseability describes syntax. Keep vocabulary validity, feature-specific eligibility, and actual rich-result appearance separate. Preserve the existing unassessed state when the structured-data criterion lacks relevant evidence. [Google structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- Collected links show a label and declared destination. A link becomes a tested destination only through actual recorded testing. Keep ordered headings and sampled excerpts within their collected HTML scope.
- Rendered content, live rankings, impressions, clicks, CTR, search snippets, sitemap coverage, and full-domain crawl results require their own observations. Show those limits using the recorded scope and existing guidance.

Keep **Open Search Console** as an external follow-up action. Explain that URL Inspection is used within the appropriate property. Use the existing `SEO_GUIDANCE` links with descriptive labels and scope them to the relevant action. Opening guidance should have no effect on findings, scores, or testing status. [Search Console URL Inspection](https://support.google.com/webmasters/answer/9012289)

### 10. Keep assessment values consistent

Use the existing `page-seo-review-v1` method, source eligibility rules from `reviewedCriteria`, the recorded page inventory passed by `TabPanel`, and `seoScore`. Align UI and SEO export values with the completed-audit dashboard. Keep scoring logic in a shared presentation or model helper where necessary. Work from eligible criterion records when displaying details and serializing scores, including when duplicate or malformed saved records share the same criterion key.

| Criterion | Base weight |
| --- | --- |
| Titles & descriptions | 30% |
| Canonical & indexing signals | 30% |
| Content & page structure | 25% |
| Structured data | 15% |

Reweight available eligible criteria and round once. Keep `null`, invalid, uncited, uncollected-page, and legacy assessments excluded. Preserve a valid zero score. Use **Not assessed** when no eligible score exists. If a bar is shown, make its scale 0–100 and use the exact assessment value. Explain the method briefly. For example, scores of 72, 85, and 80 in the first three areas, with Structured data unassessed, yield 79/100 across three of four criteria.

Preserve `assessmentValidation.summaryWithheld`, `withheldCriteria`, and the existing partial-assessment message. A withheld explanation must remain hidden in the workspace and both export formats. Separate explicit unverified fields from areas with insufficient collected evidence. Place the four criterion details, supported summary and sources, and recorded strengths in secondary disclosures. Keep meaningful source access in each. No supported finding count should be used as a scoring penalty or bonus.

### 11. Retain report state and complete exports

Keep the SEO section mounted under the existing report key based on `analysisId` or `analyzedAt`. Preserve filters, mode, selected finding, selected page, and relevant disclosures during navigation within that report. Reset them for a new report. Retain existing cancellation and timeout behavior. Prevent late generation from writing to a disposed report or a different finding.

Use `seoPlan` as the basis of a complete text export. Include every retained finding, source observation, eligible score, recorded page and check, supported strength, saved step, and scope limit that applies. Use page-plus-source identity to avoid dropping distinct records. If source or field data is unavailable, serialize its real availability state. Report-wide export content should be independent of the active view, filters, selected page, and open disclosures.

Keep clipboard and download feedback accurate. On clipboard denial, show a visible download alternative. Handle download-start failure and object URL cleanup. Preserve the global print dialog behavior and align the printed SEO section with the same eligible assessment and evidence rules. Keep global report sections outside SEO available in the print output.

### 12. Use a readable visual system

Match SiteAudit AI’s existing specialist workspaces using Inter, the current icons, off-white backgrounds, white surfaces, ink headings, slate supporting text, and violet for selection and focus. Use subtle borders and restrained shadows. Apply priority colors sparingly and keep their text labels visible.

Use an 8px spacing rhythm, roughly 20–24px interior padding for primary desktop surfaces, 14–16px body and control type, and 12–13px secondary metadata. Use tabular numerals for assessment scores and counts. Let evidence use the available width. Avoid a third column, a score hero, or horizontal scrolling for metadata or code.

At 320px and 390px, wrap control groups, stack evidence fields, and use the native finding and page selectors where appropriate. Ensure long URLs, query strings, heading text, source labels, and raw observations remain readable. Keep the first relevant task above methodology and other disclosures. Use semantic landmarks, logical heading levels, keyboard-operable controls, visible focus, meaningful status announcements, and reduced-motion support. Verify actual contrast and aim for WCAG 2.2 AA.

### 13. Verify the implementation and report the results

Run appropriate existing tests, lint, and the production build. Add focused regression coverage only where the redesigned interaction or evidence handling introduces a gap. Confirm the following behaviors with real controls and controlled report data.

- The current report opens the updated SEO section through its normal navigation, with the compact summary and both views accessible.
- The finding order, selection, priority and area filters, and explicit page filter remain consistent through both navigation directions. Same-title findings on different pages and duplicate occurrences stay independent.
- Inspecting page A shows page A’s metadata, response state, checks, and sources. Selecting page B updates all related values. A source ID collision across pages does not mix evidence or remove an export entry.
- A zero score displays as zero. A missing, uncited, withheld, or incompatible legacy assessment displays as unassessed. Eligible score, criterion coverage, and explanations agree with the dashboard and exports.
- Multiple title and description values remain available. Missing headers, absent metadata, invalid JSON-LD, malformed saved observation data, and missing page inventories show distinct honest states. Actual indexing, rankings, and rich-result eligibility stay untested in the UI.
- Verified findings remain usable in a partial report. A withheld summary is absent from rendered and exported SEO detail. No findings, no filter matches, and no findings for a selected page have distinct messages and useful next actions.
- Finding details, filters, selected page, and view survive a section round trip. A new report resets them. Opening and inspecting the section sends no automatic AI request. Explicit generation handles failure, retry, and cancellation without hiding evidence.
- Copy, an actual text download, and print content include the whole recorded SEO review. Feedback remains accurate when clipboard or download access fails.
- Keyboard focus is visible and predictable through view switches and cross-links. Hidden content is absent from keyboard navigation. Verify width and reading order at 320, 390, 768, 1024, and 1440px, intermediate widths, and enlarged text. Inspect screenshots of findings, the mobile page inspector, and representative partial or empty states.

Keep fixtures in test code. Label screenshots from fixture-based checks as illustrative. Distinguish live audit verification, fixture UI checks, and print serialization checks in the delivery notes. Use a fresh tab or reload after rebuilding a non-hot-reloading local app. Confirm the updated SEO controls appear in the running application before reporting completion.

Deliver the implemented workspace, the relevant changed files, representative desktop and mobile screenshots, the checks actually performed, and any remaining limitations.
