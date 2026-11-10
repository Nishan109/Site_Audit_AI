# SiteAudit AI · Live review workspace redesign

## Review of the current experience

The screenshot shows the current waiting screen for `woxora.com/ebooks`. It confirms the submitted page and offers **Cancel review**, but the spinner gives the user little information about the work in progress or the time spent. The quiet header, clear page title, and cancellation control are worth keeping.

The source explains why the screen is limited. `LoadingState.tsx` receives only the submitted URL and a cancellation callback. The browser sends one `POST /api/analyze` request, and the route returns a single JSON report after `analyzeWebsite` finishes. The completed report already has an execution log, but those records are assembled at the end and have no measured durations. A visual redesign alone cannot reveal the active agent.

| Current behavior | What it means for the redesign |
| --- | --- |
| The screen shows the same spinner during page reads, research, specialist work, and validation. | Add server events at actual execution boundaries. Use the spinner only as a small indication of ongoing work. |
| The audit starts with evidence collection and optional research, then runs specialists in pairs. | Show simultaneous activity and independently settled results. One finished specialist does not imply that its partner or the phase is finished. |
| Unavailable web research can leave a usable page-based audit. | Treat optional research unavailability as a limitation and explain that the review continues. Keep it distinct from a blocking failure. |
| The client wait limit is 175 seconds, the route supplies a 160-second audit deadline, and the configured route duration is 180 seconds. | These are limits in the current code. The display should measure elapsed time and stage durations, with an honest remaining-time state. |
| Cancellation, retry for the same page after a website timeout, and protection against late responses are already present. | Keep those behaviors when adding a streaming response and a richer waiting screen. |

The proposed design is a compact **live review workspace** with the submitted page, a clearly labeled clock, actual work in progress, and expandable activity. Completed stages show what was produced and how long that stage took. Queued stages explain what comes next. A time estimate needs measured data from comparable audits.

---

## Copy-ready implementation prompt

Act as a senior SaaS product designer, interaction designer, accessibility specialist, and full-stack Next.js engineer. Redesign the **Reviewing your website** experience in the existing SiteAudit AI application. Build the UI and the real progress and timing data it needs. Preserve the existing public website audit, report validation, and completed-report navigation.

The user should be able to answer four questions at a glance. Which page is being reviewed? What is happening right now? How long has the review been running? Can I cancel or recover if it stalls?

### 1. Read the real workflow first

Read applicable `AGENTS.md` instructions and the installed Next.js route-handler and client-component documentation. Inspect the following implementation and callers.

- `src/components/LoadingState.tsx`, its current styles in `src/app/globals.css`, `AppShell.tsx`, and `src/app/page.tsx`.
- `src/app/api/analyze/route.ts`, `src/lib/server/audit.ts`, `evidence.ts`, `website-fetch.ts`, `research.ts`, `gemini.ts`, and `errors.ts` in the server library.
- `src/lib/types.ts`, `AgentLog.tsx`, `AuditEvidence.tsx`, and current print or export consumers of audit metadata.
- `tests/landing-workflow-component.test.ts`, `tests/start-screen-component.test.ts`, `tests/audit.test.ts`, and `scripts/verify-live-audit-ui.mjs`.
- The route runtime and limits in `vercel.json` and the deployment path that will serve the stream.

Use one existing audit run per submission. Keep the submitted page path and query for the actual request and retry. Preserve URL validation, public-network protections, same-origin collection rules, evidence grounding, provider fallback, and current concurrency. Progress instrumentation should observe the work the pipeline already performs.

### 2. Design a polished waiting workspace

Keep the existing SiteAudit AI header and **How it works** help. Use a centered workspace with a comfortable maximum width around 1,100px. Use the existing Inter font and icon system, a cool off-white canvas, white working surfaces, deep ink headings, readable slate text, and violet for active work and focus. Use subtle borders, restrained shadows, and a consistent 8px spacing rhythm. Leave decoration subordinate to the current action.

Use the following reading order.

1. **Reviewing your website** as the only H1, with the submitted page and a one-line description of the current state. Make the hostname and path easy to distinguish. Allow long addresses to wrap without moving the cancel action off-screen.
2. A **Currently working on** panel with one line per active stage. When a pair of specialists is running, show both. In the same upper area, show **Time elapsed** in large tabular numerals and **Cancel review** as a clearly named secondary button.
3. A compact phase summary for **Collect evidence**, **Review content**, and **Prepare report**. Use actual state labels. A phase can contain multiple tasks and can finish with an optional limitation. Use a short plain-language note such as “Reviewing content from 2 collected pages” only once that count is known.
4. An **Agent and check activity** area. Start with active and recently settled work visible. Let the user expand the full activity or individual phase details to see queued tasks, measured durations, and safe outcomes.

On desktop, use a flexible work area with a narrower timing and control rail when there is room. Keep active work and the clock visible before the full history. On mobile, use a single-column sequence of identity → current action and timing → cancel → phases → activity. Keep the clock and current action together. Avoid a giant vertical stepper, a permanent technical console, or a decorative full-screen spinner. Loading should look like a real work surface with a stable hierarchy.

Use this illustrative desktop composition to guide the layout. The statuses and durations below are example values for design and tests.

```text
Reviewing your website                         Time elapsed
woxora.com/ebooks                              00:42
                                               Finish time varies by website
Currently working on                          [Cancel review]
Messaging     Reviewing how the page explains its offer
User experience     Checking navigation and HTML structure

Collect evidence · Complete with limits   Review content · Running   Prepare report · Queued

Agent and check activity
Website evidence     Complete      2 pages collected                  8s
Web research         Unavailable   Continuing with collected pages   12s
Messaging            Running       Reviewing messaging and copy
User experience      Running       Reviewing navigation and structure
[Show all activity]
```

Each activity row needs a descriptive name, text status, a brief action or outcome, and measured timing where available. Use aligned durations on desktop and wrap them below the status on mobile. Completed states can use a quiet green accent, optional limitations amber, and blocking errors a restrained red. Pair every color with text and an icon. Keep the active row visually steady when updates arrive.

### 3. Map the activity to actual execution

Define stable stage IDs and display labels. Keep orchestration in the existing audit pipeline. Emit start and terminal events at the real call sites. The UI can group stages visually, but the events must reflect the actual order and overlap.

| Actual work | Safe active wording | Safe outcome after it settles |
| --- | --- | --- |
| `collectEvidence` | “Reading the submitted page and eligible related pages” | “2 pages collected” when two pages actually returned. Show a limited sample if a related page was excluded. |
| `researchWebsite` | “Looking for relevant web sources” | Actual source and query counts when available, or “Web research unavailable. Continuing with collected pages.” |
| Messaging and UX, the first parallel batch | “Reviewing messaging and copy” and “Reviewing navigation and structure in the collected HTML” | Retained findings per specialist after its verification finishes. |
| SEO and Conversion, the second parallel batch | “Reviewing search signals” and “Reviewing action and decision clarity” | Retained findings per specialist. Keep this pair queued until its calls actually begin. |
| AI Visibility and Strategy, the next parallel work | “Reviewing content readiness” and “Building an evidence-based SWOT” | Recorded content-readiness findings and the actual strategy result. |
| Quick wins, schema checks, Security and Accessibility | “Selecting evidence-backed quick wins,” “Checking report data,” and the real header or HTML check labels | Counts from the actual shortlist and check results. Follow the real order of report assembly rather than inventing extra stages. |
| Completed report | “Preparing the report” while the actual report assembly is in progress | “Review complete” only when the validated report is ready. Indicate known coverage limitations accurately. |

Distinguish AI specialists from deterministic evidence collection, check functions, and report validation. Some HTML extraction occurs during page collection. Avoid a second timed row for that work unless a separate boundary is instrumented. The initial audit does not call PageSpeed, render the page in a browser, or test live AI citations. Keep status labels within the scope of the code.

Use short, allowlisted action codes mapped to human-readable text. Add a milestone such as “Checking findings against page evidence” only when the verifier call is actually instrumented. Add “Retrying a page request” or a provider fallback label only when the corresponding code emits the event. Without that instrumentation, keep the parent stage running with its established label. Show zero retained findings as a valid result. Never invent searches, competitor names, provider attempts, pages fetched, or a live token feed.

### 4. Deliver live events from the existing request

Use an opt-in streaming response from the existing Node.js `POST /api/analyze` route. A practical contract is `Accept: application/x-ndjson` with newline-delimited UTF-8 events in the response. Keep the current JSON contract for callers that request or expect JSON. Add an optional typed progress sink to `analyzeWebsite` so the JSON and streaming paths use the same implementation. Keep existing no-store behavior and vary the representation by the request header where needed. Confirm real chunk delivery with the deployed runtime and any proxy. The installed Next.js guide and platform documentation inform this transport. [Next.js streaming Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route#streaming) · [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration)

Define a small, versioned discriminated union for **run started**, **stage started**, **stage updated**, **stage settled**, **heartbeat**, **run completed**, and **run failed**. Include a run ID, increasing sequence number, and server elapsed offset. Stage events use a stable ID, allowed status, optional known count or reason code, and duration for settled work. The terminal success contains the validated existing `AuditResult`. A terminal error carries a sanitized user-facing code and message. The run ID identifies the in-flight attempt. Preserve the completed report’s `analysisId` semantics.

- Use **Queued**, **Running**, **Complete**, **Unavailable**, **Failed**, and **Not run** where appropriate. Treat retry as an actual substate only when reported. A local user cancellation can stop the interface immediately. Indicate what the client knows about the stopped request without claiming a server acknowledgment that never arrived.
- Start tracking each parallel specialist separately. Settle each independently. On a blocking failure, abort siblings through the existing signal and close the run. Keep completed work in the history and stop indicating active work. Preserve the difference between skipped work, a canceled request, and a stage whose last confirmed status is incomplete.
- Treat optional research failure as a recoverable terminal stage. Check the parent abort signal before handling optional failures so cancellation or the overall deadline cannot become a routine “research unavailable” event followed by more requests.
- Keep event payloads small. Use recorded aggregate counts and approved messages. Exclude raw provider payloads, prompts, page HTML, credentials, cookies, stack traces, and private request details. Do not expose internal chain of thought. Reuse sanitized error mapping for JSON and streamed failures.
- Validate requests before starting expensive work. Preserve normal JSON HTTP errors when applicable before the stream begins. Once headers are sent, send a terminal error event for an in-flight failure and close cleanly. An HTTP 200 for the stream alone is not audit success.
- Implement streaming UTF-8 decoding and incremental line framing. Handle split lines, multiple events per chunk, final decoder flush, bounded buffered input, event validation, and unsupported versions. Drop stale or duplicate events without letting state move backward. A connection that closes without a valid terminal report needs a recovery state. Treat heartbeats as connection activity only.
- Keep one POST per user attempt. If the response to that request is valid legacy JSON, accept it through the same final report validation and show **Live stage details unavailable** while appropriate. Avoid retrying a POST automatically to switch protocols. Preserve local and deployment limits rather than increasing them simply to accommodate the new UI.

### 5. Show timing with a clear source

**Elapsed time** is the visitor’s wait since submitting this review. Use a client monotonic clock and update the displayed value about once per second. Derive the value from the start time so timer drift and hidden browser tabs do not accumulate error. Freeze the final value when the run ends. The visual clock should not be an ARIA live region.

**Stage duration** comes from measured monotonic timestamps in the server process. Record actual start and finish offsets. A completed row can say “Finished in 18s” using the measured difference. While receiving progress, a running row can show an approximate elapsed value anchored to its last server event. If updates go quiet, distinguish the visitor’s elapsed clock from last confirmed stage information. Queued stages have no elapsed runtime. Several tasks can overlap, so total wall time is measured for the run and never calculated by adding stage durations.

**Time remaining** needs calibration. Start with “Estimating…” only if an estimation method is active. Otherwise use clear wording such as “Finish time varies with the website and review workload” or “No reliable estimate yet.” Display a range only when comparable measured runs support it, with the estimate calibrated for remaining phases and parallel work. Label any such range **Estimated**, recalculate it from actual milestones, and replace it with an honest delayed state if it is exceeded. Do not turn timeout budgets, completed-task counts, or a hard-coded demo schedule into an ETA or percentage.

If timing is carried into the completed report, persist optional initial-run duration data under a backward-compatible contract. Label it **Initial review timing** and distinguish server processing from visitor wait. The existing **Behind the report** disclosure can show recorded durations when present. Earlier reports can omit timing. A later research retry must not replace or reinterpret the original audit’s timings.

### 6. Preserve cancellation, errors, and the report handoff

Keep the existing loading-to-results transition. Accept a report only when the final payload passes the same live-data, evidence, and schema checks as the current route. When the report arrives, transition directly and focus the report heading. A brief completion status can be announced without an artificial delay.

Wire the same abort path to **Cancel review**, any existing header action that leaves the review, and a new submission. Cancel the stream reader and propagate disconnect or cancellation to the route, the audit, and its provider calls. Stop intervals, heartbeats, and listeners on success, error, abort, or unmount. Guard every state update by the active request and run identity. A late response, heartbeat, or terminal event from a canceled attempt cannot overwrite a later one.

Design explicit states for the following.

- **Connecting** with the submitted page and elapsed time before the first event. Keep stage work unconfirmed until the server starts it.
- **Working** with concurrent active stages and actual milestones.
- **Still waiting for an update** after a period without an event, using the last confirmed activity. A slow provider can be working while the progress channel is quiet.
- **Continuing with limited research or coverage** when the pipeline supports a report with that limitation.
- **Canceled** with the submitted address restored, focus returned to the URL field, and a concise announcement. The user can submit again.
- **Timed out**, **Website could not be read**, **Provider error**, and **Connection ended before the report arrived** with safe, distinct explanations. Keep the submitted URL and support an appropriate **Retry this page** or **Edit website address** action. Distinguish DNS or page-read errors from audit timeout and insufficient HTML evidence.
- **Complete** with the existing report and its actual evidence. Zero findings can be a valid completed review.

If retaining the activity panel after a failure, freeze it at the last confirmed state. Offer a working retry using the same URL and a new attempt identity. Keep the existing way to dismiss errors or edit the address. There is no partial-report CTA unless a valid partial report exists in the real pipeline.

### 7. Make the experience accessible and responsive

Use a semantic heading structure and readable list or disclosures for agent activity. Announce meaningful phase changes, optional limitations, failure, cancellation, and completion through a concise status region. Keep the continuously changing timer outside it. Avoid putting the entire interactive workspace under `aria-busy` in a way that suppresses those announcements. Keep Cancel review reachable by keyboard while the audit runs. Preserve working focus for the help dialog and return focus on dismiss. Keep visual focus visible and respect reduced-motion preferences.

Use short labels and wrap content gracefully at 320px. Keep status, action, and duration understandable without color or animation. Use comfortable touch targets. Prevent layout shifts as timers gain digits, statuses change, or disclosures expand. Avoid auto-scrolling the user away from the part of the activity they are reading. Show detailed history on demand.

### 8. Verify the real path and deliver the result

Add focused tests and adapt existing workflow coverage. Use deterministic event fixtures only in tests. Verify the following through the real client and route boundaries.

- Legacy JSON success and errors, the opt-in stream, a first progress event arriving before the report, and one audit invocation per request.
- A true parallel pair, a fast task beside a slow task, correct queue and phase states, and measured nonnegative durations. Include a skipped or canceled sibling after a blocking failure.
- Optional research failure with a usable report, a related page that could not be collected, and real zero counts. Distinguish all three from a blocking failure.
- Split UTF-8 and NDJSON chunks, missing terminal event, malformed data, duplicate or late events, network failure, and client or server timeout.
- Cancel during connection and during active work, immediate retry, and navigation away. Verify propagation to downstream signals and that stale callbacks cannot restore the wrong report.
- Honest elapsed timing across hidden-tab or long-wait simulation. Verify that a heartbeat or clock tick never creates a stage transition.
- Keyboard operation, screen-reader status behavior, reduced motion, and no horizontal overflow with long addresses. Inspect 320, 390, 768, 1024, and 1440px and enlarged text.

Run tests, lint, and the production build. Capture desktop and mobile screenshots showing actual controlled progress events, including two agents working in parallel and an optional limitation. Clearly label illustrative test captures. Where a real-provider run is available, verify event ordering, timing, and report handoff using a public URL. Verify streaming on the intended hosting path if accessible and distinguish it from local streaming. Report the checks actually performed and any unverified conditions.
