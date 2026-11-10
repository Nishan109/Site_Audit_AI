const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Next's local server can normalize its URL to localhost even when the browser
// requested 127.0.0.1. Accept the HTTP authority only for loopback aliases on the
// same port; it cannot turn a public/forwarded hostname into a trusted origin.
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host && loopbackHosts.has(url.hostname)) {
    try {
      const authority = new URL(`${url.protocol}//${host}`);
      if (
        loopbackHosts.has(authority.hostname) &&
        authority.port === url.port &&
        authority.host === host.toLowerCase()
      ) return authority.origin;
    } catch {
      // Invalid authorities never expand the accepted origin.
    }
  }
  return url.origin;
}

export function isSameOrigin(request: Request): boolean {
  const origin = requestOrigin(request);
  return origin !== "null" && request.headers.get("origin") === origin;
}
