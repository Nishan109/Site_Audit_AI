import {
  SECURITY_GUIDANCE,
  SECURITY_NOT_TESTED,
  securityActions,
  type SecurityCheck,
  type SecurityReview,
  type SecuritySnapshot,
  type SecurityStatus,
} from "../security";
import type { SecurityAudit } from "../types";
import type { PageEvidence } from "./evidence";

const steps = (...items: [string, string][]) =>
  items.map(([title, description]) => ({ title, description }));
// The first occurrence of a directive applies within a policy. Separate CSP policies combine.
function cspDirective(policies: string[], name: string) {
  return policies
    .flatMap((value) => value.split(","))
    .flatMap((policy) => {
      const directive = policy
        .split(";")
        .map((part) => part.trim().split(/\s+/))
        .find(([key]) => key.toLowerCase() === name);
      return directive ? [directive.slice(1)] : [];
    });
}
function pageChecks(page: PageEvidence, pageIndex: number): SecurityCheck[] {
  const snapshot: SecuritySnapshot = page.securitySnapshot || {
    url: page.url,
    htmlCollected: false,
    headersCollected: false,
    metaCsp: [],
    httpAssets: [],
    httpForms: [],
    httpAssetCount: 0,
    httpFormCount: 0,
    sampled: false,
  };
  const secure = new URL(page.url).protocol === "https:";
  const known = snapshot.headersCollected && !!snapshot.response;
  const header = (
    name: keyof NonNullable<SecuritySnapshot["response"]>["headers"],
  ) => snapshot.response?.headers[name] || [];
  const rows = (
    name: keyof NonNullable<SecuritySnapshot["response"]>["headers"],
  ) => [
    {
      label: name,
      value: !known
        ? "Response headers not collected"
        : header(name).length
          ? header(name)
              .map((value) => value || "(empty value)")
              .join("\n")
          : "Not present on the fetched response",
    },
  ];
  const make = (
    key: SecurityCheck["key"],
    area: SecurityCheck["area"],
    title: string,
    status: SecurityStatus,
    detail: string,
    context: string,
    observations: SecurityCheck["observations"],
    actionSteps: SecurityCheck["steps"] = [],
    priority?: SecurityCheck["priority"],
  ): SecurityCheck => ({
    id: `security-${pageIndex + 1}-${key}`,
    key,
    area,
    pageUrl: page.url,
    title,
    status,
    detail,
    context,
    observations,
    steps: actionSteps,
    priority,
    reference: SECURITY_GUIDANCE[key],
  });
  const checks: SecurityCheck[] = [];
  checks.push(
    make(
      "transport",
      "transport",
      "Page connection",
      secure ? "observed" : "review",
      secure
        ? "The collected page URL uses HTTPS."
        : "The collected page URL uses unencrypted HTTP.",
      "The final fetched URL is observed. TLS configuration, certificate lifetime and an unrequested HTTP-to-HTTPS redirect were not audited.",
      [{ label: "Final page URL", value: page.url }],
      secure
        ? []
        : steps(
            [
              "Enable HTTPS for this host",
              "Configure a valid certificate and verify the page and required resources over HTTPS.",
            ],
            [
              "Check redirects before rollout",
              "Verify intended HTTP-to-HTTPS redirects and existing public links after deployment.",
            ],
          ),
      secure ? undefined : "High",
    ),
  );
  for (const [key, references, title] of [
    ["assets", snapshot.httpAssets, "HTTP resource references"],
    ["forms", snapshot.httpForms, "HTTP form destinations"],
  ] as const) {
    const review = secure && references.length > 0;
    const count =
      key === "assets" ? snapshot.httpAssetCount : snapshot.httpFormCount;
    checks.push(
      make(
        key,
        "transport",
        title,
        !snapshot.htmlCollected || !secure
          ? "not-assessed"
          : review
            ? "review"
            : "not-observed",
        !snapshot.htmlCollected
          ? "Resource observations were not collected."
          : !secure
            ? "Mixed-content checks apply to HTTPS pages; review the HTTP connection first."
            : review
              ? `${count} explicit or resolved HTTP ${key === "assets" ? "resource reference(s)" : "form destination(s)"} were collected.`
              : `No HTTP ${key === "assets" ? "resource references" : "form destinations"} were found in the inspected HTML attributes.`,
        key === "assets"
          ? "References are potential mixed content, not confirmed network requests. Browsers or CSP may upgrade or block them. External CSS and JavaScript requests were not executed. Resource queries and fragments are omitted."
          : "A declared action is not a tested submission. JavaScript can change behavior. Form destinations were not opened or submitted; query strings are omitted.",
        references.length
          ? references.map((item) => ({
              label: `${item.element}[${item.attribute}]`,
              value: item.url,
            }))
          : [
              {
                label: "HTML scope",
                value: snapshot.htmlCollected
                  ? "Supported resource/form attributes in the collected document"
                  : "Not collected",
              },
            ],
        review
          ? steps(
              [
                "Locate the declared HTTP references",
                "Use the element and attribute evidence to locate these references in the relevant page or template.",
              ],
              [
                "Verify the intended HTTPS destination",
                "Confirm each destination supports HTTPS before updating it. Check actual requests or form behavior in browser developer tools.",
              ],
            )
          : [],
        review ? "Medium" : undefined,
      ),
    );
  }
  const enforced = header("content-security-policy").filter((value) =>
    value.trim(),
  );
  const reportOnly = header("content-security-policy-report-only").filter(
    (value) => value.trim(),
  );
  const meta = snapshot.metaCsp.filter((value) => value.trim());
  const hasCsp = enforced.length || meta.length;
  checks.push(
    make(
      "csp",
      "headers",
      "Content Security Policy",
      hasCsp
        ? "observed"
        : !known
          ? "not-assessed"
          : reportOnly.length
            ? "review"
            : "not-observed",
      enforced.length
        ? "An enforcing CSP response header was collected; policy strength is not assessed."
        : meta.length
          ? "A CSP meta declaration was collected. Meta policies support a limited set of directives."
          : !known
            ? "Response headers were not collected; an enforcing policy could not be established."
            : reportOnly.length
              ? "Only a report-only CSP header was collected. It reports violations without enforcing that policy."
              : "No non-empty CSP header or supported meta declaration was collected.",
      "Presence does not establish an effective policy or protection from injection. Multiple policies, script sources and application behavior need a dedicated review. A meta policy cannot enforce frame-ancestors.",
      [
        ...rows("content-security-policy"),
        ...rows("content-security-policy-report-only"),
        {
          label: "CSP meta declarations",
          value:
            meta.join("\n") ||
            (snapshot.htmlCollected
              ? "None collected in the document head"
              : "HTML not collected"),
        },
      ],
      !hasCsp && known
        ? steps(
            [
              "Inventory the page's resource needs",
              "Identify scripts, styles, embeds and external services before choosing a policy.",
            ],
            [
              "Test a policy before enforcing it",
              "Start with a suitable report-only response header, review violations and test key journeys before enforcing an application-specific policy.",
            ],
          )
        : [],
      !hasCsp && known ? "Medium" : undefined,
    ),
  );
  const hsts = header("strict-transport-security");
  const ages =
    hsts.length === 1
      ? hsts[0]
          .split(";")
          .map((item) => item.trim())
          .filter((item) => /^max-age\s*=/i.test(item))
          .map((item) => item.slice(item.indexOf("=") + 1).trim())
      : [];
  const validAge =
    ages.length === 1 && /^\d+$/.test(ages[0]) && !hsts[0].includes(",");
  const positiveAge = validAge && /[1-9]/.test(ages[0]);
  checks.push(
    make(
      "hsts",
      "headers",
      "HTTPS persistence (HSTS)",
      !secure || !known
        ? "not-assessed"
        : positiveAge
          ? "observed"
          : hsts.length
            ? "review"
            : "not-observed",
      !secure
        ? "HSTS is only honored when received over HTTPS."
        : !known
          ? "Response headers were not collected."
          : positiveAge
            ? `A positive HSTS max-age (${ages[0]} seconds) was collected.`
            : validAge
              ? "The HSTS header sets max-age=0, which removes this host's stored HSTS policy when received securely."
              : hsts.length
                ? "A single unambiguous numeric HSTS max-age was not established."
                : "No HSTS response header was collected; a browser's existing HSTS or preload state is unknown.",
      "This response does not establish preload enrollment or the security of subdomains. Do not enable includeSubDomains or preload until every affected host is ready.",
      rows("strict-transport-security"),
      secure && known && !positiveAge
        ? steps(
            [
              "Confirm HTTPS coverage and intent",
              "Verify certificate operation and HTTPS availability for the host and any intended subdomains.",
            ],
            [
              "Choose an appropriate HSTS rollout",
              "Review the observed header and intended max-age with the hosting owner. Test before extending duration or adding subdomain/preload controls.",
            ],
          )
        : [],
      secure && known && !positiveAge ? "Low" : undefined,
    ),
  );
  const ancestors = cspDirective(enforced, "frame-ancestors");
  const framePolicy = ancestors.some(
    (tokens) => tokens.length > 0 && !tokens.includes("*"),
  );
  const xfo = header("x-frame-options");
  const xfoValid =
    xfo.length === 1 && /^(DENY|SAMEORIGIN)$/i.test(xfo[0].trim());
  // An enforcing frame-ancestors policy takes precedence over X-Frame-Options.
  // A permissive CSP declaration must not be rescued by a conflicting XFO value.
  const framingObserved = ancestors.length ? framePolicy : xfoValid;
  checks.push(
    make(
      "framing",
      "headers",
      "Page embedding controls",
      !known
        ? "not-assessed"
        : framingObserved
          ? "observed"
          : xfo.length || ancestors.length
            ? "review"
            : "not-observed",
      !known
        ? "Response headers were not collected."
        : framePolicy
          ? "An enforcing CSP frame-ancestors directive with a scoped source list was collected."
          : xfoValid && !ancestors.length
            ? "A recognized X-Frame-Options value was collected."
            : xfo.length || ancestors.length
              ? "Observed framing declarations need review; no recognized restricted setting was established."
              : "No enforcing frame-ancestors directive or recognized X-Frame-Options value was collected.",
      "Embedding may be intentional. frame-ancestors is not inherited from default-src and is not enforced through a meta or report-only policy. ALLOW-FROM is obsolete. This is not a clickjacking exploit test or a full source-list validator.",
      [
        ...rows("x-frame-options"),
        {
          label: "Enforcing CSP frame-ancestors",
          value:
            ancestors
              .map((tokens) => tokens.join(" ") || "(empty directive)")
              .join("\n") ||
            (known ? "Not collected" : "Headers not collected"),
        },
      ],
      known && !framingObserved
        ? steps(
            [
              "Confirm who should embed this page",
              "Check whether customers, partner tools or your own sites intentionally frame this page.",
            ],
            [
              "Set a compatible framing policy",
              "Choose an enforcing frame-ancestors policy appropriate to that intent, then test allowed and disallowed embedding. Do not automatically block required embeds.",
            ],
          )
        : [],
      known && !framingObserved ? "Low" : undefined,
    ),
  );
  const mime = header("x-content-type-options");
  const nosniff = mime.length === 1 && /^nosniff$/i.test(mime[0].trim());
  checks.push(
    make(
      "mime",
      "headers",
      "Content-type sniffing control",
      !known
        ? "not-assessed"
        : nosniff
          ? "observed"
          : mime.length
            ? "review"
            : "not-observed",
      !known
        ? "Response headers were not collected."
        : nosniff
          ? "The X-Content-Type-Options header contains nosniff."
          : "A single recognized nosniff response-header value was not collected.",
      "The document header does not establish correct MIME types or protections on separate scripts and stylesheets. Those responses were not fetched for this check.",
      rows("x-content-type-options"),
      known && !nosniff
        ? steps(
            [
              "Verify the resource MIME types",
              "Confirm the application serves HTML, JavaScript and stylesheets with their intended Content-Type values.",
            ],
            [
              "Add or correct nosniff where appropriate",
              "Configure the response header and test the actual resources and browser journeys before rollout.",
            ],
          )
        : [],
      known && !nosniff ? "Low" : undefined,
    ),
  );
  const referrer = header("referrer-policy");
  const recognized = [
    "no-referrer",
    "no-referrer-when-downgrade",
    "origin",
    "origin-when-cross-origin",
    "same-origin",
    "strict-origin",
    "strict-origin-when-cross-origin",
    "unsafe-url",
  ];
  const policy = referrer
    .join(",")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => recognized.includes(value))
    .at(-1);
  checks.push(
    make(
      "referrer",
      "headers",
      "Referrer response policy",
      !known
        ? "not-assessed"
        : !referrer.length
          ? "not-observed"
          : !policy || policy === "unsafe-url"
            ? "review"
            : "observed",
      !known
        ? "Response headers were not collected."
        : !referrer.length
          ? "No Referrer-Policy response header was collected. Its absence is not an automatic defect."
          : policy
            ? `The last recognized response-policy token is ${policy}.`
            : "No recognized Referrer-Policy response-header token was collected.",
      "Modern browsers normally default to strict-origin-when-cross-origin. Meta declarations and element-level policies may also affect requests and were not evaluated here. Actual referrer transmissions were not measured.",
      rows("referrer-policy"),
      known && referrer.length && (!policy || policy === "unsafe-url")
        ? steps(
            [
              "Review cross-site referrer needs",
              "Confirm whether full paths and query strings should be disclosed to destination sites.",
            ],
            [
              "Choose and test the intended policy",
              "Use a recognized policy that fits those needs and inspect actual outgoing requests before deployment.",
            ],
          )
        : [],
      known && referrer.length && (!policy || policy === "unsafe-url")
        ? "Low"
        : undefined,
    ),
  );
  const cookies = snapshot.response?.cookies || [];
  const sameSiteWithoutSecure = cookies.filter(
    (cookie) => cookie.sameSite === "none" && !cookie.secure,
  ).length;
  checks.push(
    make(
      "cookies",
      "cookies",
      "Response cookie attributes",
      !known
        ? "not-assessed"
        : sameSiteWithoutSecure
          ? "review"
          : cookies.length
            ? "observed"
            : "not-observed",
      !known
        ? "Cookie response headers were not collected."
        : cookies.length
          ? `${cookies.length} Set-Cookie header(s) were observed; only attribute summaries are retained.`
          : "No Set-Cookie headers were observed on this final response. This does not establish a cookie-free site.",
      "Cookie values and names are not retained. JavaScript cookies, other paths, authenticated sessions and consent behavior were not tested. Some cookies intentionally need JavaScript access; missing HttpOnly is not automatically a defect. Omitted SameSite is not proof of unrestricted behavior.",
      !known
        ? [{ label: "Cookie attributes", value: "Not collected" }]
        : [
            { label: "Set-Cookie headers", value: String(cookies.length) },
            {
              label: "Secure attribute",
              value: `${cookies.filter((cookie) => cookie.secure).length} of ${cookies.length}`,
            },
            {
              label: "HttpOnly attribute",
              value: `${cookies.filter((cookie) => cookie.httpOnly).length} of ${cookies.length}`,
            },
            ...["strict", "lax", "none", "unspecified", "unrecognized"].map(
              (value) => ({
                label: `SameSite ${value}`,
                value: String(
                  cookies.filter((cookie) => cookie.sameSite === value).length,
                ),
              }),
            ),
            {
              label: "SameSite=None without Secure",
              value: String(sameSiteWithoutSecure),
            },
          ],
      sameSiteWithoutSecure
        ? steps(
            [
              "Confirm cross-site cookie requirements",
              "Identify which response cookies intentionally need SameSite=None without copying their values into reports.",
            ],
            [
              "Review the Secure attribute",
              "Modern browsers require Secure with SameSite=None. Correct the cookie configuration over HTTPS and verify the intended session flow in a browser.",
            ],
          )
        : [],
      sameSiteWithoutSecure ? "Medium" : undefined,
    ),
  );
  return checks;
}
export function buildSecurityAudit(pages: PageEvidence[]): SecurityAudit {
  const entries = pages.map((page, index) => ({
    url: page.url,
    title: page.title,
    fetchedAt: page.fetchedAt,
    headersCollected: !!page.securitySnapshot?.headersCollected,
    sampled: !!page.securitySnapshot?.sampled,
    checks: pageChecks(page, index),
  }));
  const review: SecurityReview = {
    method: "observed-security-signals-v1",
    summary:
      "A focused review of the response headers and HTML collected from your listed pages. Each observation includes its evidence and practical next steps where a review is warranted.",
    pages: entries,
    scope: {
      pages: entries.length,
      headersCollected: entries.filter((page) => page.headersCollected).length,
      checks: entries.reduce((count, page) => count + page.checks.length, 0),
      actions: 0,
      sampled: entries.some((page) => page.sampled),
    },
    notTested: [...SECURITY_NOT_TESTED],
  };
  const actions = securityActions(review);
  review.scope.actions = actions.length;
  const root = pages[0];
  const csp =
    root?.securitySnapshot?.response?.headers["content-security-policy"];
  return {
    overallScore: null,
    httpsEnabled: root ? new URL(root.url).protocol === "https:" : null,
    cspHeaders: root?.securitySnapshot?.headersCollected
      ? !!csp?.some((value) => value.trim())
      : null,
    mixedContent: root?.securitySnapshot
      ? new URL(root.url).protocol === "https:" &&
        root.securitySnapshot.httpAssets.length > 0
      : null,
    cookieConsent: null,
    review,
    issues: actions.map((check) => ({
      priority: check.priority!,
      title: check.title,
      detail: check.detail,
      pageUrl: check.pageUrl,
      evidence: check.observations
        .map((row) => `${row.label}: ${row.value}`)
        .join("\n"),
      fixSteps: check.steps,
    })),
  };
}
