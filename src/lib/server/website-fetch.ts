import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { AuditError } from "./errors";
import { isPublicAddress, normalizeUrl } from "./url";
import { securityResponse } from "./security-evidence";
import type { SecurityResponse } from "../security";
import type { SEOResponse } from "./seo-evidence";

interface HTMLResponse {
  html: string;
  url: string;
  csp: boolean;
  seoResponse?: SEOResponse;
  securityResponse?: SecurityResponse;
}
type SendRequest = (
  url: URL,
  options: RequestOptions,
  receive: (response: IncomingMessage) => void,
) => ClientRequest;
interface ReaderOptions {
  resolveHost?: (hostname: string) => Promise<LookupAddress[]>;
  sendRequest?: SendRequest;
  attemptTimeoutsMs?: readonly number[];
  totalTimeoutMs?: number;
  retryDelayMs?: number;
}
const timeout = () =>
  new AuditError(
    "We couldn’t finish reading this page within 30 seconds, including a retry. Try again in a moment or enter another public page on the same website.",
    504,
    "WEBSITE_TIMEOUT",
  );
const transientCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);
function retryable(error: unknown) {
  if (error instanceof AuditError)
    return ["WEBSITE_TIMEOUT", "WEBSITE_TEMPORARY_FAILURE"].includes(
      error.code,
    );
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    transientCodes.has(String(error.code))
  );
}

/** DNS promises cannot be cancelled, but a cancelled audit must stop waiting for them. */
function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", aborted, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));
  });
}

/** A fresh, DNS-pinned HTML read with one retry and an absolute shared deadline. */
export function createWebsiteReader({
  resolveHost = (hostname) => lookup(hostname, { all: true }),
  sendRequest = (url, options, receive) =>
    (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      options,
      receive,
    ),
  attemptTimeoutsMs = [12_000, 18_000],
  totalTimeoutMs = 30_000,
  retryDelayMs = 200,
}: ReaderOptions = {}) {
  const readAttempt = async (
    url: string,
    signal: AbortSignal,
    attempt: number,
    redirects = 0,
  ): Promise<HTMLResponse> => {
    signal.throwIfAborted();
    const parsed = new URL(normalizeUrl(url));
    let addresses: LookupAddress[];
    try {
      addresses = await abortable(
        resolveHost(parsed.hostname.replace(/^\[|\]$/g, "")),
        signal,
      );
    } catch (error) {
      signal.throwIfAborted();
      if (retryable(error)) throw error;
      throw new AuditError(
        "This domain could not be resolved. Check the website URL.",
        422,
        "WEBSITE_UNREACHABLE",
      );
    }
    signal.throwIfAborted();
    // Retain the existing IPv4 preference on networks with synthesized NAT64 answers.
    const ipv4 = addresses.filter((item) => item.family === 4);
    if (ipv4.length) addresses = ipv4;
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicAddress(address))
    )
      throw new AuditError(
        "Private network addresses cannot be audited.",
        400,
        "INVALID_URL",
      );
    // A retry may use the next independently validated address for the same host.
    const pinned = addresses[attempt % addresses.length];
    const response = await new Promise<HTMLResponse & { location?: string }>(
      (resolve, reject) => {
        const req = sendRequest(
          parsed,
          {
            signal,
            family: pinned.family,
            agent: false,
            lookup: (_hostname, _options, callback) =>
              callback(null, pinned.address, pinned.family),
            headers: {
              "User-Agent": "SiteAuditAI/1.0",
              Accept: "text/html,application/xhtml+xml",
            },
          },
          (res) => {
            const status = res.statusCode || 0;
            res.on("error", reject);
            res.on("aborted", () =>
              reject(
                Object.assign(new Error("Incomplete page response"), {
                  code: "ECONNRESET",
                }),
              ),
            );
            if (status >= 300 && status < 400 && res.headers.location) {
              resolve({
                location: res.headers.location,
                html: "",
                url: parsed.href,
                csp: false,
              });
              res.destroy();
              return;
            }
            if (status < 200 || status >= 300) {
              reject(
                new AuditError(
                  `The website returned HTTP ${status} and could not be read. It may block automated access.`,
                  422,
                  [502, 503, 504].includes(status)
                    ? "WEBSITE_TEMPORARY_FAILURE"
                    : "WEBSITE_UNREACHABLE",
                ),
              );
              res.destroy();
              return;
            }
            if (!/html/i.test(res.headers["content-type"] || "")) {
              reject(
                new AuditError(
                  "This URL does not serve a readable HTML webpage.",
                  422,
                  "UNSUPPORTED_PAGE",
                ),
              );
              res.destroy();
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            res.on("data", (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > 3_000_000) {
                const error = new AuditError(
                  "This page is too large to analyze safely.",
                  422,
                  "PAGE_TOO_LARGE",
                );
                reject(error);
                res.destroy(error);
              } else chunks.push(chunk);
            });
            res.on("end", () => {
              if (!res.complete) {
                reject(
                  Object.assign(new Error("Incomplete page response"), {
                    code: "ECONNRESET",
                  }),
                );
                return;
              }
              const values = (value: string | string[] | undefined) =>
                value === undefined
                  ? []
                  : Array.isArray(value)
                    ? value
                    : [value];
              resolve({
                html: Buffer.concat(chunks).toString("utf8"),
                url: parsed.href,
                csp: !!res.headers["content-security-policy"],
                seoResponse: {
                  status,
                  xRobotsTag: values(res.headers["x-robots-tag"]),
                  link: values(res.headers.link),
                },
                securityResponse: securityResponse(status, res.headers),
              });
            });
          },
        );
        req.on("error", reject);
        req.end();
      },
    );
    signal.throwIfAborted();
    if (response.location) {
      if (redirects >= 4)
        throw new AuditError(
          "The website redirected too many times.",
          422,
          "WEBSITE_UNREACHABLE",
        );
      return readAttempt(
        new URL(response.location, parsed).href,
        signal,
        attempt,
        redirects + 1,
      );
    }
    return response;
  };
  return async (rawUrl: string, parent: AbortSignal): Promise<HTMLResponse> => {
    parent.throwIfAborted();
    const url = normalizeUrl(rawUrl);
    const total = new AbortController();
    const totalTimer = setTimeout(() => total.abort(timeout()), totalTimeoutMs);
    const budget = AbortSignal.any([parent, total.signal]);
    try {
      for (let attempt = 0; attempt < attemptTimeoutsMs.length; attempt++) {
        budget.throwIfAborted();
        const deadline = new AbortController();
        const attemptTimer = setTimeout(
          () => deadline.abort(timeout()),
          attemptTimeoutsMs[attempt],
        );
        const signal = AbortSignal.any([budget, deadline.signal]);
        try {
          return await readAttempt(url, signal, attempt);
        } catch (error) {
          budget.throwIfAborted();
          const failure = signal.aborted ? signal.reason : error;
          if (!retryable(failure) || attempt + 1 === attemptTimeoutsMs.length)
            throw failure;
        } finally {
          clearTimeout(attemptTimer);
        }
        if (retryDelayMs > 0) {
          await new Promise<void>((resolve, reject) => {
            const aborted = () => {
              clearTimeout(timer);
              reject(budget.reason);
            };
            const timer = setTimeout(() => {
              budget.removeEventListener("abort", aborted);
              resolve();
            }, retryDelayMs);
            if (budget.aborted) {
              aborted();
              return;
            }
            budget.addEventListener("abort", aborted, { once: true });
          });
        }
      }
      throw timeout();
    } finally {
      clearTimeout(totalTimer);
    }
  };
}
export const readPublicHTML = createWebsiteReader();
