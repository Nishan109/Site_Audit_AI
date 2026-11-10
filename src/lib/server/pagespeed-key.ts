import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual, parseEnv } from "node:util";

const variable = "PAGESPEED_API_KEY";

export function localPageSpeedSetup(host: string | null) {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.SITEAUDIT_LOCAL_KEY_SETUP === "1" &&
    /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i.test(host ?? "")
  );
}

export function validPageSpeedKey(value: unknown) {
  return typeof value === "string" &&
    /^[A-Za-z0-9_-]{20,150}$/.test(value.trim())
    ? value.trim()
    : null;
}

export async function writeLocalPageSpeedKey(
  key: string,
  file = resolve(".env.local"),
) {
  if (validPageSpeedKey(key) !== key) throw new Error("Invalid PageSpeed key");
  const original = await readFile(file, "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    },
  );
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const assignment = `${variable}=${key}`;
  let replaced = false;
  let updated = original.replace(
    /^[\t ]*(?:export[\t ]+)?PAGESPEED_API_KEY[\t ]*=[^\r\n]*/gm,
    () => {
      if (replaced) return "";
      replaced = true;
      return assignment;
    },
  );
  if (!replaced)
    updated += `${original && !original.endsWith("\n") ? newline : ""}${assignment}${newline}`;

  const before = parseEnv(original);
  const after = parseEnv(updated);
  const expected = { ...before, [variable]: key };
  if (!isDeepStrictEqual({ ...after }, expected))
    throw new Error("Could not update the environment file safely");

  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, updated, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
