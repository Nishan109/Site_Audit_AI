export function sourceURL(value: string) {
  try {
    const parsed = new URL(value);
    if (
      !/^https?:$/.test(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      return null;
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}
