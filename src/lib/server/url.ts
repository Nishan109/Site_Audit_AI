import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AuditError } from "./errors";

export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)));
  }
  // Only globally routable IPv6; reject mapped IPv4 and local scopes.
  return isIP(ip) === 6 && /^[23]/.test(ip) && !ip.startsWith("2001:db8");
}

export function normalizeUrl(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2048) {
    throw new AuditError("Enter a valid public website URL.", 400, "INVALID_URL");
  }
  const value = raw.trim();
  let url: URL;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`); }
  catch { throw new AuditError("Enter a valid website URL, for example https://example.com.", 400, "INVALID_URL"); }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port)) || !hostname.includes(".") && !isIP(hostname) ||
      /(^|\.)(localhost|local|internal|home|lan|invalid|test)$/.test(hostname) ||
      (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new AuditError("Use a public HTTP or HTTPS website. Local and private addresses cannot be audited.", 400, "INVALID_URL");
  }
  url.hash = "";
  return url.href;
}

export async function validatePublicHost(url: string) {
  const hostname = new URL(normalizeUrl(url)).hostname.replace(/^\[|\]$/g, "");
  let addresses;
  try { addresses = await lookup(hostname, { all: true }); }
  catch { throw new AuditError("This domain could not be resolved. Check the URL and try again.", 422, "WEBSITE_UNREACHABLE"); }
  const ipv4 = addresses.filter(item => item.family === 4);
  if (ipv4.length) addresses = ipv4;
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new AuditError("This URL resolves to a private or unsupported network address.", 400, "INVALID_URL");
  }
}
