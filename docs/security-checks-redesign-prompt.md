# SiteAudit AI · Security checks redesign

## Review of the current section

I reviewed the Security checks components, collection and refresh paths, evidence rules, and export code. I also opened the current app in isolated Chromium sessions at 1440px and 390px with an illustrative report. The fixture had two security pages, one response with headers, 18 scoped checks, and five configuration review tasks. The review plan started about 2,107px down the desktop page and 4,270px down the mobile page. Selecting the second page and returning from User experience reset the selection at both widths. Opening the report with valid security evidence made no additional collection request.

| Current behavior | Effect on the user | Redesign direction |
| --- | --- | --- |
| A large overview, refresh strip, and full signal grid appear before the prioritized tasks. | The first useful configuration action is buried, particularly on mobile. | Lead with a compact collection snapshot and put **Review plan** and **Page signals** directly below it. |
| A signal links down the page to a task card, while its evidence and steps sit in separate disclosures. | The user has to scroll and reopen related details to decide what to do. | Show one selected task with its recorded value, scope, steps, and validation together. Provide a direct link back to the exact check. |
| The page picker uses an array index and displays hostname plus pathname. Refresh clears filters and selection before data arrives. | Query variants can look identical. A refresh or section round trip can lose the investigation in progress. | Use the exact recorded page and check identity. Preserve valid selection and filters, then reconcile them after a successful refresh. |
| The signal filter **To review** is based on steps, while the task plan also requires a priority. The recorded **Review** status has no separate filter. | A user can read a task filter as a technical status or assume an absent signal always needs fixing. | Use the same actionable predicate throughout and keep status separate from whether a check has suggested steps. |
| The screen validates the evidence through the refresh hook, while the text and print serializer reads the supplied review directly. Saved steps are looked up by title. | A malformed saved review can reach export, and same-title checks on two pages can pick up the same steps. | Use one validated snapshot for the screen and exports. Scope step lookup and navigation to the exact check. |

The existing collector already makes valuable distinctions between absent declarations, unavailable evidence, and settings that warrant review. The redesign should expose those distinctions earlier. Security checks are a page-specific review of public HTML and final response headers. The independent refresh already works without Gemini or a full website audit.

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, security UX writer, accessibility specialist, and full-stack Next.js engineer. Redesign the **Security checks** section of the existing SiteAudit AI application. Implement it through the existing `security` destination under **More checks** and retain the real security collection path.

Design for someone who needs to answer four questions. Which page and response were inspected? Which configuration needs attention first? What did the audit actually observe? How can I verify a change before rollout?

### 1. Inspect the implementation and preserve the collection contract

Read applicable `AGENTS.md` instructions and the installed Next.js documentation before changing framework behavior. Inspect these files and their consumers.

- `src/components/SecuritySection.tsx`, its CSS module, `useSecurityResults.ts`, and the existing shared review and export components.
- `src/lib/security.ts`, `security-presentation.ts`, `security-refresh.ts`, and the Security checks availability entry in `dashboard.ts`.
- `src/lib/server/security.ts`, `security-evidence.ts`, `security-refresh.ts`, and `src/app/api/security-checks/route.ts`.
- `src/components/TabPanel.tsx`, `navigation.ts`, `PrintReport.tsx`, and the security update callback in `src/app/page.tsx`.
- `tests/security-component.test.ts`, `tests/security-refresh.test.ts`, `tests/security.test.ts`, `tests/security-fixtures.ts`, and `scripts/verify-security.mts`.

Use the evidence already collected with the report or the independently refreshed snapshot. Use `hasSecurityResults` and the existing schemas to distinguish a valid scoped review from older booleans, a malformed response, or an unrelated report. The route already checks the requested URL, the final page URL, collection metadata, and each page’s check set. Retain the server-side public-address validation, DNS pinning, redirect and response limits, cancellation, and report ID guards.

Keep the section a deterministic review of collected evidence. Use existing steps and references. Inspecting a signal, changing a view, filtering, or exporting uses the current snapshot.

### 2. Put the decision and scope at the top

Keep the audited domain as the report H1 and **Security checks** as the section heading. Use a short description such as “Inspect the settings recorded on your public pages and review the changes worth checking.” Replace the large hero and separate reassurance panel with a compact workspace in this order.

1. Section heading and a short collection status row with the recorded timestamp and **Refresh checks**.
2. Compact snapshot with **Pages inspected**, **Responses with headers**, **Scoped checks**, and **Configuration reviews**.
3. **Review plan** and **Page signals** as the two main views.
4. A concise **Collection scope and limits** disclosure, including what was tested, what was outside scope, and technical guidance.

Put **Copy security plan** and **Download security plan** where users can reach them without scrolling past the findings. With a validated snapshot, show whether it came from the original audit or a later security refresh when that can be determined. Use the actual refresh `checkedAt` for a refreshed snapshot and each page’s `fetchedAt` for its observations. Keep the report’s creation timestamp separate. Label the requested page and final fetched page distinctly when a redirect changes the URL.

Use the existing security scope and validated records. Security pages can differ from the marketing audit page inventory after a refresh. **Responses with headers** counts collected final responses. It does not count individual header names. **Scoped checks** includes the check records marked unassessed. **Configuration reviews** comes from `securityActions(review)`, including its requirement for a priority and available steps. Show a real zero only when collection supports it. A missing snapshot has a collection state instead of zero-filled metrics.

Make the scope legible beside the counts, such as “Public response headers and initial HTML.” Keep numeric security grades, compliance badges, scan percentages, and claims of vulnerability clearance out of the summary.

### 3. Make the review plan a practical queue

On first opening a valid snapshot with configuration tasks, use **Review plan** and select the first task in the existing stable priority order. When collection yields no tasks, make **Page signals** easy to reach and keep the plan’s empty state available. Do not switch a user away from their chosen view when a refresh succeeds.

Use a compact queue and one detail panel at desktop widths. Show the title, review priority, category, and exact source page label. For mobile, use a labeled native selector or short list followed by the detail. Show the first available priority as a starting point and maintain stable ordering within equal priorities. Treat priority as a configuration review recommendation. It does not establish exploitability or severity of a verified vulnerability.

Provide **All priorities**, **High**, **Medium**, and **Low** or an equivalent compact filter. Add a labeled area selector for **Connections and destinations**, **Response policies**, and **Cookie attributes** where useful. Offer page filtering when there is a choice or when the user comes from a page signal. Keep the total task count independent of active filters. Show matching results and an accessible **Clear filters** action. Distinguish an empty report plan, a page with no review tasks, and a filter with no matches.

Organize the detail panel into these blocks.

- **What we observed** shows the actual check result, its source URL, collection context, and the relevant values or references.
- **Why review it** uses the recorded explanation and applicability limits. Show the check status separately from task priority.
- **Suggested steps** shows the existing deterministic steps for the selected check. Keep support for valid saved steps only when they belong to that check. Do not resolve same-title tasks across multiple pages from a global title alone. Apply the same lookup rule in the panel and the exports.
- **How to verify the change** gives a short staging checklist tied to the actual check. Refer to the existing steps where they already explain validation. For example, a recorded HTTP resource reference can lead to checking the intended HTTPS destination and observing the real browser request after rollout in a controlled environment. Preserve the difference between manual instructions and tests performed by SiteAudit AI.

Use the selected task’s existing technical reference. Avoid a generic server configuration generator or buttons that change the target site.

### 4. Build Page signals around one exact response

Use the validated security page inventory as the source of truth. Preserve the full path and query for page identity. Ignore URL fragments when comparing page identity, and use safe credential-free HTTP(S) links. Distinguish query variants in the picker and page label. A single page can show its identity and collection timestamp without an unnecessary selector.

Group checks under three clear areas. A compact list or table that becomes stacked rows on mobile is preferable to nine equally large cards. Each row shows the check title, actual status, a short observation, and **View evidence**. Show useful details in one expandable row or a selected evidence panel. Keep the full response URL and header coverage visible while inspecting.

| Recorded status | Meaning to communicate |
| --- | --- |
| **Observed** | A value, declaration, or attribute summary was recorded in the sample. |
| **Review** | The recorded condition warrants review in context. |
| **Not observed** | The signal was absent or unrecognized in the inspected material, as explained by the specific check. |
| **Not assessed** | Collection was unavailable or the check did not apply to this response. |

Offer **All signals** and filters for the four recorded statuses. Use an optional **Has review steps** filter or a separate label for actionable checks. A record with a suggested review may have a **Not observed** status. Use the same eligibility predicate as the plan for its count and link. Keep area and status filters simple and announce the filtered count. Keep the status legend one compact disclosure.

From a task, **Inspect source signal** opens Page signals with the exact response and check selected, expands its evidence, and moves keyboard focus to the relevant row or detail heading. From an actionable signal, **View review steps** opens the same check’s task and clears conflicting filters as needed. Keep **Open audited page** a separate safe external link. Resource and form destinations are evidence values and should remain inert.

For identity, use normalized page URL plus `SecurityCheck.key` within the active report. The server’s current check IDs include the page index and can change when a refresh changes the page order. Use stable identity for keys, selected detail, cross-links, and saved steps. Keep normal view switches and section round trips from resetting valid state. Reset view-local state for a new `analysisId` or the existing `analyzedAt` fallback, even when the same URL is reviewed again.

### 5. Keep technical claims faithful to the recorded values

Display the existing `detail`, `context`, and `observations` as the evidence for each check. Preserve the meaning of empty declarations, repeated values, and unavailable evidence. Render long policies as wrap-safe text with optional disclosure. A change in layout must not reinterpret a raw header as a validated defense.

| Check family | Evidence and limits the UI must preserve |
| --- | --- |
| **Page connection** | Show the final fetched scheme. HTTPS on that response does not establish TLS versions, cipher configuration, certificate lifetime, or how an unrequested HTTP URL redirects. |
| **HTTP resources and forms** | Show recorded element and attribute evidence, redacted destinations, and sampling limits. An HTTP reference in an HTTPS document is an observation about its HTML. Browser requests, upgrades, blocks, and submissions were outside the collection. |
| **Content Security Policy and framing** | Keep enforcing response policies, report-only policies, and meta declarations distinct. Retain the recorded interpretation of framing controls and directive precedence. A meta `frame-ancestors` declaration is not an enforcing framing policy. Avoid requiring a duplicate header when the recorded policy already covers the case. [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/#directive-frame-ancestors) |
| **HTTPS persistence** | Show the retained HSTS state and actual header value. Keep positive `max-age`, `max-age=0`, malformed values, and missing evidence distinct. A zero value removes the received host policy under the applicable processing rules. Preload enrollment and subdomain readiness require separate verification. [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797#section-6.1.1) |
| **Content-type and referrer policy** | Use the existing recognized-value checks and associated context. Preserve the distinction between a recognized response declaration and behavior of resources or browser requests that were not collected. |
| **Cookie attributes** | Show only the retained counts and summaries for Secure, HttpOnly, and SameSite. Distinguish a collected response with no `Set-Cookie` headers from a response whose headers were unavailable. Keep the recorded `SameSite=None` without Secure review scoped to those response attributes. Consent, cookie values, authenticated sessions, and site-wide behavior are outside this check. [HTTP Working Group cookie specification](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-storage-model) |

Preserve collector privacy. Never recover cookie names or values, raw `Set-Cookie` lines, or resource credentials, query strings, and fragments that the collector removed. The actual audited page identity and a redacted resource destination serve different purposes. Do not use a resource destination as the page picker key. Treat retained values as text and use validated links for the audited page and approved guidance only.

### 6. Design collection and refresh states explicitly

Preserve the existing automatic **security-only** collection when the user first opens Security checks for a report without valid security evidence. Keep it scoped to the active section so a hidden mounted panel does not trigger a request. A report with valid security evidence should display it immediately. **Refresh checks** should use `POST /api/security-checks`, not restart `/api/analyze`.

- **Collecting initial evidence** shows the page and a compact collecting status. Avoid placeholder checks or disabled controls that suggest a result exists.
- **Results collected** shows the validated snapshot, timestamp, and working view controls.
- **Refreshing existing results** keeps the last successful data, selection, and exports available. Identify the displayed snapshot as the last successful one and prevent duplicate submissions.
- **Refresh succeeds** replaces the security snapshot atomically and updates the shared report, dashboard availability, and print data. Preserve the selected page and check when they still exist. Fall back predictably if they were removed or changed. Reconcile filters after success, rather than clearing them when collection starts.
- **Collection fails or times out** shows a specific actionable error and **Retry security checks**. If a previous snapshot exists, keep it visible with its original timestamp. An incomplete response or one from a different URL must never replace validated data.
- **Earlier report or missing evidence** explains the current collection state. Preserve the security-only recovery even when older security scores or flags exist. Those fields do not count as collected observations.

Keep state scoped to the report and requested page. Preserve the existing cancellation behavior when leaving or replacing the active report, and reject late responses. If retaining the workspace when hidden, explicitly gate automatic collection and cleanup by the active section. Returning from another section should reuse valid data and view state. Avoid repeated automatic retries after a failure. Keep a security refresh from changing marketing findings or rewriting the original audit’s timing.

### 7. Make export and limitations consistent

Reuse the shared copy and download behavior where appropriate. Use `securityPlan` as the complete serialization path for clipboard, text, and the existing report print. Feed it the validated snapshot for this report, even when Security checks is not the active section. Preserve every collected page, status, exact safe source reference, retained observation, selected step version, timestamp, sampling flag, header coverage state, and review limit. Export the full review regardless of the active filters or view. Allow long policy text and long reports to wrap and paginate.

Give visible copy and download feedback. Report clipboard success after the write resolves. Offer the text download when clipboard access fails and handle download-start failure. Exports require a valid collected snapshot. If a legacy report is printed before collection, use a clearly labeled scope-only state that points to the existing Security checks recovery. Preserve complete exports when there are zero configuration tasks.

Consolidate limitations into one easy-to-find disclosure. Keep the existing scope for exploit testing, malware and dependencies, TLS configuration, authentication and authorization, rendered browser behavior and submitted forms, and consent or compliance. Keep practical next steps and authoritative references near the corresponding check. Avoid presenting collection as a security certification.

### 8. Apply the report design system and verify the result

Match the refreshed AI Visibility and Conversion sections. Use existing Inter typography and icons, a neutral background, white panels, readable slate text, restrained violet interactions, and text-labeled semantic states. Use approximately 14–16px body and control text and 12–13px metadata. Use consistent panel padding and tabular numerals. Keep compact evidence and a clear next action above methodology and guidance.

Adapt to the available width after accounting for the sidebar. Reflow counts into two columns on narrow screens, wrap filters, keep status and observation text together, and wrap long URLs and policy strings without horizontal page scrolling. Use native disclosures and labeled controls. Provide visible focus, selected and expanded states, logical headings, keyboard navigation, and concise status announcements for refresh and exports. Respect reduced motion.

Run the existing tests, lint, and production build. Add focused regressions for the redesign and verify the actual section through normal navigation. Cover the following.

- Initial audit results, security-only collection for an earlier report, successful refresh, failure with previous evidence visible, timeout, retry, cancellation, and stale responses from another report. Opening or navigating within a valid snapshot should make no collection request.
- Exact URL and check links across query variants, duplicated titles, multiple pages, reordered refreshed pages, and same-URL reports with different identities.
- All four statuses, missing header coverage, collected zero cookie headers, a **Not observed** check with a valid review task, and zero-task reports. Distinguish filter-empty and collection-empty states.
- Report-only and enforcing CSP, meta versus response framing, HSTS zero and malformed declarations, and HTTP references without simulated browser behavior. Preserve redaction in screen, copy, text, and print.
- Complete export with filters active, clipboard failure, download, print, and safe handling of incomplete saved data. Verify consistency with dashboard availability.
- Desktop and mobile reading order, keyboard focus on cross-links, long policy values, and responsive layouts at 320, 390, 768, 1024, and 1440px, plus an intermediate width and enlarged text.

Deliver the implemented workspace, desktop and mobile screenshots of both views, the checks actually performed, and any remaining verification limits. Keep illustrative fixtures isolated from real results and identify any live collection separately.
