import { loadPageHTML } from "./streamed-html";
import {
  SECURITY_HEADERS,
  type SecurityCookie,
  type SecurityReference,
  type SecurityResponse,
  type SecuritySnapshot,
} from "../security";

// Preserve commas inside URL tokens (notably data URLs); descriptors end at a comma.
function srcsetURLs(value: string) {
  const urls: string[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value[index])) index++;
    const start = index;
    while (index < value.length && !/\s/.test(value[index])) index++;
    const token = value.slice(start, index);
    if (!token) break;
    urls.push(token.replace(/,+$/, ""));
    if (token.endsWith(",")) continue;
    let nesting = 0;
    while (index < value.length) {
      const character = value[index++];
      if (character === "(") nesting++;
      else if (character === ")") nesting = Math.max(0, nesting - 1);
      else if (character === "," && !nesting) break;
    }
  }
  return urls;
}

/** Persist allowlisted headers and cookie attributes only; never retain cookie names or values. */
export function securityResponse(
  status: number,
  raw: Record<string, string | string[] | number | undefined>,
): SecurityResponse {
  const normalized = new Map(
    Object.entries(raw).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const values = (name: string) => {
    const value = normalized.get(name);
    return value === undefined
      ? []
      : Array.isArray(value)
        ? value
        : [String(value)];
  };
  const headers = Object.fromEntries(
    SECURITY_HEADERS.map((name) => [name, values(name)]),
  ) as SecurityResponse["headers"];
  const cookies: SecurityCookie[] = values("set-cookie").map((line) => {
    const attributes = line
      .split(";")
      .slice(1)
      .map((part) => part.trim());
    const sameSite = attributes
      .filter((part) => /^samesite\s*=/i.test(part))
      .map((part) =>
        part
          .slice(part.indexOf("=") + 1)
          .trim()
          .toLowerCase(),
      );
    return {
      secure: attributes.some((part) =>
        /^secure$/i.test(part.split("=")[0].trim()),
      ),
      httpOnly: attributes.some((part) =>
        /^httponly$/i.test(part.split("=")[0].trim()),
      ),
      sameSite:
        sameSite.length === 0
          ? "unspecified"
          : sameSite.length !== 1 ||
              !["strict", "lax", "none"].includes(sameSite[0])
            ? "unrecognized"
            : (sameSite[0] as "strict" | "lax" | "none"),
    };
  });
  return { status, headers, cookies };
}
export function extractSecurityEvidence(
  html: string,
  url: string,
  response?: SecurityResponse,
): SecuritySnapshot {
  const { $ } = loadPageHTML(html);
  let base = url;
  try {
    base = new URL($("base[href]").first().attr("href") || url, url).href;
  } catch {
    /* Keep the document URL. */
  }
  const httpAssets: SecurityReference[] = [],
    httpForms: SecurityReference[] = [];
  const add = (
    items: SecurityReference[],
    element: string,
    attribute: string,
    value: string,
  ) => {
    try {
      const target = new URL(value.trim(), base);
      if (target.protocol !== "http:") return;
      // Resource queries can contain signed tokens. Do not retain credentials, query strings or fragments.
      target.username = "";
      target.password = "";
      target.search = "";
      target.hash = "";
      items.push({ element, attribute, url: target.href });
    } catch {
      /* An invalid URL is not a confirmed resource request. */
    }
  };
  const selectors: Record<string, string[]> = {
    "script[src]": ["src"],
    img: ["src", "srcset"],
    "iframe[src]": ["src"],
    "audio[src]": ["src"],
    video: ["src", "poster"],
    source: ["src", "srcset"],
    "object[data]": ["data"],
    "embed[src]": ["src"],
    "track[src]": ["src"],
    "input[type='image'][src]": ["src"],
    "link[rel~='stylesheet'][href],link[rel~='preload'][href],link[rel~='modulepreload'][href]":
      ["href"],
  };
  for (const [selector, attributes] of Object.entries(selectors)) {
    $(selector).each((_, element) => {
      if (!("tagName" in element)) return;
      for (const attribute of attributes) {
        const value = $(element).attr(attribute);
        if (!value?.trim()) continue;
        const candidates = attribute === "srcset" ? srcsetURLs(value) : [value];
        for (const candidate of candidates)
          add(httpAssets, element.tagName, attribute, candidate);
      }
    });
  }
  $("form[action],button[formaction],input[formaction]").each((_, element) => {
    const attribute = element.tagName === "form" ? "action" : "formaction";
    const value = $(element).attr(attribute);
    if (value?.trim()) add(httpForms, element.tagName, attribute, value);
  });
  const metaCsp = $("head meta[http-equiv]")
    .toArray()
    .filter(
      (element) =>
        $(element).attr("http-equiv")?.toLowerCase() ===
        "content-security-policy",
    )
    .map((element) => $(element).attr("content") || "");
  return {
    url,
    htmlCollected: true,
    headersCollected: !!response,
    response,
    metaCsp,
    httpAssets: httpAssets.slice(0, 80),
    httpForms: httpForms.slice(0, 40),
    httpAssetCount: httpAssets.length,
    httpFormCount: httpForms.length,
    sampled: httpAssets.length > 80 || httpForms.length > 40,
  };
}
