import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { POST } from "../src/app/api/pagespeed/key/route";
import { writeLocalPageSpeedKey } from "../src/lib/server/pagespeed-key";

const example = "test_only_pagespeed_key_123456";

test("local key setup replaces only the PageSpeed variable and preserves other dotenv values", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "siteaudit-key-test-"));
  const file = join(directory, ".env.local");
  t.after(async () => {
    await unlink(file);
    await rmdir(directory);
  });
  await writeFile(
    file,
    '# local settings\r\nOTHER="keep this"\r\nPAGESPEED_API_KEY=old-test-key\r\n',
  );
  await writeLocalPageSpeedKey(example, file);
  const saved = await readFile(file, "utf8");
  assert.equal(
    saved,
    `# local settings\r\nOTHER="keep this"\r\nPAGESPEED_API_KEY=${example}\r\n`,
  );
  assert.equal(parseEnv(saved).OTHER, "keep this");
  await assert.rejects(() =>
    writeLocalPageSpeedKey(`${example}\nOTHER=injected`, file),
  );
  assert.equal(await readFile(file, "utf8"), saved);
});

test("the key endpoint refuses unbound, foreign-origin, and invalid requests without echoing input", async (t) => {
  const previous = { ...process.env };
  t.after(() => {
    for (const name of ["NODE_ENV", "SITEAUDIT_LOCAL_KEY_SETUP"]) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  Object.assign(process.env, {
    NODE_ENV: "development",
    SITEAUDIT_LOCAL_KEY_SETUP: "",
  });
  function request(origin: string, key: string) {
    return new Request("http://localhost:3001/api/pagespeed/key", {
      method: "POST",
      headers: {
        host: "localhost:3001",
        origin,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
      },
      body: JSON.stringify({ key }),
    });
  }
  assert.equal(
    (await POST(request("http://localhost:3001", example))).status,
    404,
  );
  process.env.SITEAUDIT_LOCAL_KEY_SETUP = "1";
  assert.equal(
    (await POST(request("https://outside.example", example))).status,
    403,
  );
  const invalid = await POST(request("http://localhost:3001", "invalid-input"));
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(await invalid.text(), /invalid-input/);
});
