# SiteAudit AI: landing-page analysis and redesign prompt

Prepared after reviewing the current landing-page screenshot, HeroSection.tsx, StartScreen.module.css, AppShell.module.css, the product README, and the current homepages of Linear, Stripe, Vercel, and Framer.

## Assessment of the current page

The URL form is clear and the entry flow is easy to understand. The presentation needs a stronger product story and a more distinctive visual composition.

| Current observation | Effect on the presentation | Recommended response |
| --- | --- | --- |
| The main composition is a centered headline above one large form card. | Visitors see the input mechanism before they understand the depth of the output. | Pair the form with a readable report preview. |
| There is no visible report example. | The product's evidence, prioritization, and practical recommendations are difficult to judge before submitting. | Show one complete example finding: observation, source excerpt, recommendation, and next step. |
| The headline and supporting text describe a broad website review. | The product's specific value receives little emphasis. | Make evidence and a practical improvement plan central to the positioning. |
| The background, card, and supporting rows use similar pale tones. | There is limited visual rhythm and brand distinction. | Establish stronger heading contrast, a restrained violet signature, and more intentional section composition. |
| Several supporting labels are 11–13px. | Important supporting information looks visually secondary and may require more effort to read. | Use a deliberate type scale with readable body and interface text; reserve small text for minor metadata. |
| Most capability details sit inside a closed disclosure. | New visitors have little visible context about the review before taking action. | Explain three main outcomes visibly and keep detailed scope in disclosures or FAQ. |
| The page provides an example URL that fills the form. | This demonstrates input, while the output remains unknown. | Add a separate, clearly labeled sample-report experience that requires no live analysis. |

The recommended direction is a light, product-led SaaS landing page: a confident headline, one obvious URL action, a coherent report preview, concise benefits, and honest scope. Further decoration should support that story.

## Reference observations

- [Linear](https://linear.app/): strong heading scale, restrained visual treatment, and an actual interface presentation. Adapt the hierarchy and product emphasis to SiteAudit AI.
- [Stripe](https://stripe.com/in): distinctive brand artwork, prominent typography, and a clear relationship between positioning and the primary action. Develop an original, restrained visual signature for SiteAudit AI.
- [Vercel](https://vercel.com/): a recognizable central brand element, a limited hero action set, and clear visual separation between actions. Apply that discipline to the review flow.
- [Framer](https://www.framer.com/): a direct product statement followed by a large demonstration of the product. Make SiteAudit AI's actual output tangible early on the page.

These references inform the proposed direction; they do not establish that a particular layout will increase conversions for this product.

## Copy-and-paste redesign prompt

Act as a senior SaaS product designer, brand designer, UX writer, and front-end engineer. Redesign the public landing page for SiteAudit AI into a polished, distinctive, professional SaaS experience. Produce a complete working implementation in the existing project.

### 1. Product and audience

SiteAudit AI reviews public website content and creates source-backed findings and practical improvement suggestions. Its main reviews cover messaging and copy, content structure and navigation, search optimization, conversion clarity, and AI content readiness. Reports also provide quick wins, limited security and accessibility observations, separately requested PageSpeed measurements, competitor research when available, and creative tools.

The audience is founders, business owners, marketers, and small teams who want to understand what to improve without deciphering a technical audit. Treat this audience as the design assumption rather than a validated customer-research finding.

The primary action is to enter a public website URL and start a real review. The secondary action is to inspect a clearly labeled sample report. Within a few seconds, a visitor should understand what the product does, what the report contains, and how to begin.

### 2. Starting-point diagnosis

The current page contains a centered heading, a large URL form, three small instructional steps, and a collapsed scope explanation. Its functional clarity is useful. Its product demonstration, brand expression, and explanation of the outcome need substantial improvement.

Create a cohesive composition with a clear narrative: enter a URL, understand a finding, inspect its evidence, and choose a practical next step. Give each visible element a role in that narrative.

Use Linear's hierarchy and interface presentation, Stripe's distinctive brand treatment, Vercel's disciplined actions, and Framer's emphasis on demonstrating the product as principles. Develop an original light visual direction for SiteAudit AI.

### 3. Visual system

Use a light foundation with deep ink typography, white surfaces, and violet as the principal accent. Suggested starting tokens are:

- Page background: #F7F8FC or a similarly neutral off-white.
- Primary surface: #FFFFFF.
- Main text: #182236.
- Supporting text: #58657A.
- Brand accent: #7052E8.
- Accent hover: #5F41D0.
- Soft accent surface: #F0EBFF.
- Borders: #DDE3ED.

Verify contrast in the final combinations. Color values are starting points rather than automatic proof of accessibility.

Use the existing Inter variable font. Set a responsive desktop hero heading around 56–68px, tablet around 44–52px, and mobile around 34–40px. Use a tight but readable heading line height around 1.08–1.15. Aim for 17–18px hero supporting copy, 16px body copy, 14–16px controls and navigation, and 12–13px only for minor metadata.

Use a centered content container around 1160–1200px, consistent spacing based on an 8px rhythm, approximately 80–104px between major desktop sections, and 48–64px on mobile. Adjust these values to the actual content and viewport. Use 10–12px control radii and 16–20px major-surface radii, subtle borders, and restrained shadows.

Create one original brand motif around the idea of tracing evidence to action. It could be a fine connecting line or an understated violet highlight integrated into the report preview. Keep the form and report content visually dominant. Build interface visuals with HTML, CSS, and the existing icon system.

### 4. Header

Build a compact header approximately 72px high on desktop and 64px on mobile. Place the SiteAudit AI identity on the left. Include working anchor links for What you get, How it works, and FAQ. Add a compact Review website action that scrolls to and focuses the URL input.

Use subtle separation from the page. If the header is sticky, keep focused controls and anchor targets visible beneath it. On small screens, show the brand and a useful primary action; put additional navigation behind an accessible menu if necessary. Every control must lead to an implemented destination.

### 5. Hero: positioning, action, and product proof

Create a balanced two-column hero on wide screens. Allocate roughly equal visual weight to the copy/form and report preview, with a 48–64px gap. Stack them on smaller screens with the explanation and form first.

Suggested copy:

Eyebrow: AI website review

Headline: Know what to improve. See the evidence.

Supporting paragraph: Get an AI review of your website's messaging, page structure, and search foundations, with supporting evidence and practical next steps.

Form label: Website address

Placeholder: yourwebsite.com

Primary button: Review my website

Helper: Public websites only. No installation needed. Reviews can take a few minutes.

Secondary action: Explore an example report

Refine wording where needed, retaining the specificity and honest scope. Use one H1. Keep the input, button, and helper visually connected. Avoid a separate oversized decorative panel around a small form. On mobile, make the input and primary button full width with comfortable touch targets.

At a 1440×900 viewport, the visitor should see the headline, supporting copy, URL field, primary action, and a meaningful portion of the preview without scrolling. At 390×844, prioritize the explanation and primary action, with the preview following naturally.

### 6. Report preview: make the output understandable

Design one convincing, readable product preview using the actual report's visual language. Give it a clear Example report title and a persistent Illustrative example label. Keep it distinct from a completed audit of the visitor's URL.

Show a compact report header, a small amount of section navigation, one prioritized finding, a source excerpt, and a practical next step. Make the finding title and evidence readable at the displayed size.

Use a coherent fictional example associated with example.com/pricing:

- Area: Messaging & copy.
- Finding: Make the primary action more specific.
- Evidence: The pricing-page button reads “Learn more”.
- Suggested wording: “Compare plans”.
- Rationale: A more specific label explains what visitors will find next.
- Next step: Update the button label and check that it opens the plan comparison.

Present the sample as a demonstration of report structure. Avoid numeric marketing grades, conversion forecasts, invented customer results, and apparent live collection statuses in this illustration.

Use straight-on interface geometry with aligned edges and restrained depth. Place every element within a responsive frame. On mobile, simplify navigation and secondary metadata while keeping the finding, evidence, recommendation, and example label readable. Reflow the preview's contents rather than shrinking an entire desktop screenshot into tiny text. Essential content must remain visible without overlapping cards or clipped controls.

The secondary example action should open or reveal a local sample with functioning controls, keyboard support, and a clear way to close or return. It must not submit a live audit or consume AI quota.

### 7. Supporting page narrative

Under the hero, include a compact factual strip: Page evidence included, Prioritized next steps, and Exportable report. Use product facts confirmed by the code. Establish credibility through the demonstration and transparent process.

Add a What you get section with three concise outcomes:

1. Clearer messaging: understand where collected wording could explain the offer or next action more clearly.
2. Better content structure: review navigation, headings, and search foundations from the collected pages.
3. A practical improvement plan: inspect evidence, prioritize supported findings, and work through suggested next steps.

Use varied, intentional composition: one focused interface detail and concise supporting content can create more interest than a wall of identical feature cards. Keep the main three outcomes visible. Place secondary checks and creative tools in a compact expandable area.

Explain How it works in three steps: Enter a website; Review findings and evidence; Choose what to improve. Use short descriptions and a clean horizontal sequence on desktop, stacked vertically on mobile.

Include an FAQ with these practical questions:

- Which pages does the review read?
- Does it test the rendered website or submit forms?
- Are AI scores measured performance results?
- What happens if a page or provider cannot be reached?
- Can I export the report?

Answer from the actual implementation. The collector reads the submitted page and up to two related pages; access can fail. AI assessments do not measure conversion rates, rankings, or actual citations in AI answers. Full visual, keyboard, security, and accessibility testing requires separate checks. PageSpeed is requested separately and depends on provider availability.

End with a concise invitation and a Review my website action that returns to the existing form and focuses it. Use a compact footer with only real destinations. Keep the page purposeful rather than adding filler sections.

### 8. Interaction and content integrity

Retain the existing URL handling, HTTP/HTTPS validation, trimming, credential rejection, helpful inline errors, and server-side public-URL protections. Preserve the entered URL following an unsuccessful review.

Represent empty, focused, filled, invalid, submitting, canceled, failed, and successful states deliberately. Prevent duplicate requests. Keep cancellation available during analysis. Announce meaningful status and validation changes accessibly.

Tie any progress description to actual application state. An indeterminate state with an honest explanation is appropriate when completion progress is unknown.

Use visible labels and helpful error messages. Native form behavior should let Enter submit valid input. If a field is invalid, associate the error with it and focus the relevant field. Keep primary-action wording consistent across the landing page.

Use social proof only when real, authorized material is already available. Build trust with evidence, transparent scope, and the sample report while customer proof is unavailable. Do not add invented testimonials, customer logos, ratings, audit counts, certification badges, pricing promises, or guarantees about results.

### 9. Responsive behavior, accessibility, and motion

Inspect 320, 390, 768, 1024, and 1440px widths. Check intermediate widths too. Ensure that long URLs, headings, expanded FAQ answers, errors, and example-report content wrap within the viewport. Preserve useful content at text zoom and avoid horizontal page scrolling.

Aim for WCAG 2.2 AA. Use semantic landmarks, one H1, ordered heading levels, visible focus states, persistent labels, appropriate accessible names, and sufficient contrast. Check normal text against a 4.5:1 contrast target and qualifying large text against 3:1. Choose approximately 44px minimum interactive target dimensions where practical as the product's touch-target design goal.

Use native disclosure controls or implement correct disclosure semantics. Custom tabs must support appropriate keyboard behavior. For any modal, manage focus on entry, contain focus while open, support Escape, and return focus to the trigger on close.

Use restrained 150–220ms hover and focus transitions. Optional entrance effects should be subtle, preserve layout, and leave all content available immediately. Honor prefers-reduced-motion. Keep critical content independent of animation and avoid background effects that obscure text or consume attention continuously.

### 10. Implementation and delivery

Work in the existing Next.js, React, and TypeScript project. Read applicable AGENTS.md instructions and the installed Next.js documentation before changing framework behavior.

Inspect HeroSection.tsx, StartScreen.module.css, AppShell.tsx, AppShell.module.css, Icon.tsx, and src/app/page.tsx. Preserve the current review callback, loading/cancellation flow, real API connections, completed-report navigation, and specialist tools. Maintain isolation between illustrative demo content and real audit results.

Use scoped components and CSS modules. Define reusable design tokens and avoid broad global overrides that accidentally restyle report workspaces. Reuse existing fonts and icons. Keep the public landing page free of the report sidebar until an actual report exists. Introduce additional components only when they provide a clear responsibility.

Complete the design and implementation, connect all controls, and verify the result. Run appropriate behavioral checks for submission, validation, cancellation, navigation, and the example-report experience. Run the existing test suite, lint, and production build. Inspect desktop and mobile screenshots and fix clipping, weak hierarchy, tiny preview text, inconsistent spacing, and focus problems.

Report the finished changes, validations actually performed, representative screenshots, and any remaining limitation. Describe any performance measurements as measured observations with their test conditions.

Success means the page communicates the product and its next action quickly, the report preview makes the benefit tangible, the visual system feels coherent and distinctive, every interaction works, and the existing live audit remains reliable.

## Accessibility references

- [W3C: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
