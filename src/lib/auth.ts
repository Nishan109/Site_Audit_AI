export interface Account {
  id: string;
  email: string;
}

export const DRAFT_KEY = "siteaudit-pending-url";
const draftLifetime = 30 * 60 * 1000;

export function rememberWebsite(url: string, storage?: Storage) {
  try {
    (storage || window.sessionStorage).setItem(
      DRAFT_KEY,
      JSON.stringify({ url, expires: Date.now() + draftLifetime }),
    );
  } catch {
    /* The user can enter the address again when storage is unavailable. */
  }
}

export function pendingWebsite(storage?: Storage): string {
  try {
    storage ||= window.sessionStorage;
    const value = JSON.parse(storage.getItem(DRAFT_KEY) || "null");
    if (
      value &&
      typeof value.url === "string" &&
      value.url.length <= 2048 &&
      value.expires > Date.now()
    )
      return value.url;
    storage.removeItem(DRAFT_KEY);
  } catch {
    /* Treat unavailable or corrupt drafts as empty. */
  }
  return "";
}

export function safeReturnPath(value: unknown): string {
  return typeof value === "string" &&
    /^\/workspace(?:\/audits\/[a-f\d-]{36})?$/.test(value)
    ? value
    : "/workspace";
}
