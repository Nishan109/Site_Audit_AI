// Use the URL receiving this request, not a build-time canonical URL. The
// latter may still point to localhost or a different deployment/preview.
// Never derive a trusted origin from the caller's Origin or forwarded headers.
export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function isSameOrigin(request: Request): boolean {
  const origin = requestOrigin(request);
  return origin !== "null" && request.headers.get("origin") === origin;
}
