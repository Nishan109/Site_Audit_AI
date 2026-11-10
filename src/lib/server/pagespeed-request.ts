import { normalizeUrl, validatePublicHost } from "./url";
import { AuditError } from "./errors";
import {
  parsePageSpeed,
  pageSpeedPayloadSchema,
} from "../pagespeed-measurement";
import {
  PAGE_SPEED_DEVICES,
  pageSpeedResultSchema,
  hasPageSpeedMeasurements,
  type PageSpeedDevice,
} from "../pagespeed";

type PageSpeedDependencies = {
  fetch: typeof fetch;
  validate: typeof validatePublicHost;
  apiKey?: string;
  quota?: { blockedUntil: number };
};
let sharedQuota = { blockedUntil: 0 };
let quotaKey: string | undefined;
function configuredDependencies(): PageSpeedDependencies {
  const apiKey = process.env.PAGESPEED_API_KEY?.trim();
  if (apiKey !== quotaKey) {
    quotaKey = apiKey;
    sharedQuota = { blockedUntil: 0 };
  }
  return { fetch, validate: validatePublicHost, apiKey, quota: sharedQuota };
}
const defaultRetrySeconds = 60;
function retryAfterSeconds(header: string | null, now: number) {
  const value = header?.trim();
  const seconds =
    value && /^\d+$/.test(value)
      ? Number(value)
      : value
        ? Math.ceil((Date.parse(value) - now) / 1000)
        : 0;
  return seconds > 0 ? Math.min(seconds, 86400) : defaultRetrySeconds;
}

export class PageSpeedError extends AuditError {
  constructor(
    message: string,
    status: number,
    code: string,
    public keyConfigured: boolean,
    public retryAfterSeconds?: number,
  ) {
    super(message, status, code);
  }
}

function quotaError(keyConfigured: boolean, seconds: number) {
  return new PageSpeedError(
    "Google returned no new measurements. You can retry after the cooldown or import a Lighthouse report.",
    429,
    "PAGESPEED_QUOTA",
    keyConfigured,
    seconds,
  );
}

export async function requestPageSpeed(
  rawUrl: unknown,
  rawStrategy: unknown,
  signal: AbortSignal,
  deps: PageSpeedDependencies = configuredDependencies(),
) {
  const url = normalizeUrl(rawUrl);
  const strategy = rawStrategy === undefined ? "mobile" : rawStrategy;
  if (!PAGE_SPEED_DEVICES.includes(strategy as PageSpeedDevice))
    throw new AuditError(
      "Choose mobile or desktop for the PageSpeed test.",
      400,
      "INVALID_STRATEGY",
    );
  signal.throwIfAborted();
  await deps.validate(url);
  signal.throwIfAborted();
  const apiKey = deps.apiKey?.trim();
  const remaining = Math.ceil(
    ((deps.quota?.blockedUntil ?? 0) - Date.now()) / 1000,
  );
  if (remaining > 0) throw quotaError(!!apiKey, remaining);
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", String(strategy));
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("locale", "en");
  if (apiKey) endpoint.searchParams.set("key", apiKey);
  let response: Response;
  try {
    response = await deps.fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(75_000)]),
    });
  } catch {
    if (signal.aborted) throw signal.reason;
    throw new PageSpeedError(
      "Google did not finish the performance test in time. Try again or open PageSpeed Insights directly.",
      504,
      "PAGESPEED_TIMEOUT",
      !!apiKey,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object"
        ? (body.error as { status?: unknown; errors?: unknown })
        : undefined;
    const quota =
      response.status === 429 ||
      error?.status === "RESOURCE_EXHAUSTED" ||
      (Array.isArray(error?.errors) &&
        error.errors.some(
          (item: unknown) =>
            item &&
            typeof item === "object" &&
            "reason" in item &&
            typeof item.reason === "string" &&
            /quota|rateLimit|dailyLimit/i.test(item.reason),
        ));
    if (quota) {
      const now = Date.now();
      const delay = retryAfterSeconds(response.headers.get("retry-after"), now);
      if (!deps.quota) throw quotaError(!!apiKey, delay);
      deps.quota.blockedUntil = Math.max(
        deps.quota.blockedUntil,
        now + delay * 1000,
      );
      throw quotaError(
        !!apiKey,
        Math.ceil((deps.quota.blockedUntil - now) / 1000),
      );
    }
    if ([400, 401, 403].includes(response.status))
      throw new PageSpeedError(
        "Google could not authorize or accept this PageSpeed request. The site owner can review the PageSpeed service configuration, or you can open Google's report directly.",
        502,
        "PAGESPEED_CONFIGURATION",
        !!apiKey,
      );
    throw new PageSpeedError(
      "Google could not complete this performance test. Try again later or open PageSpeed Insights directly.",
      502,
      "PAGESPEED_UNAVAILABLE",
      !!apiKey,
    );
  }
  const payload = pageSpeedPayloadSchema.safeParse(body);
  if (!payload.success)
    throw new PageSpeedError(
      "Google returned an incomplete measurement response. Please try the test again.",
      502,
      "PAGESPEED_INVALID_RESPONSE",
      !!apiKey,
    );
  const settings = payload.data.lighthouseResult?.configSettings;
  const formFactor = settings?.formFactor || settings?.emulatedFormFactor;
  if (formFactor && formFactor !== strategy)
    throw new PageSpeedError(
      "Google returned a test for a different device. The measurements were withheld; please retry the selected device.",
      502,
      "PAGESPEED_INVALID_RESPONSE",
      !!apiKey,
    );
  const parsed = parsePageSpeed(payload.data, {
    url,
    strategy: strategy as PageSpeedDevice,
  });
  if (!hasPageSpeedMeasurements(parsed))
    throw new PageSpeedError(
      "Google returned no usable performance measurements for this page. Try again or check the URL in PageSpeed Insights.",
      502,
      "PAGESPEED_NO_MEASUREMENTS",
      !!apiKey,
    );
  const result = pageSpeedResultSchema.safeParse(parsed);
  if (!result.success)
    throw new PageSpeedError(
      "The performance measurements could not be verified. Try the test again.",
      502,
      "PAGESPEED_INVALID_RESPONSE",
      !!apiKey,
    );
  signal.throwIfAborted();
  return result.data;
}
