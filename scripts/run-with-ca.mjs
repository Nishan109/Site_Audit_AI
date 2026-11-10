import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Node 22.13 predates --use-system-ca. Respect the existing Windows trust
// store without disabling TLS verification or trusting a downloaded CA.
const env = { ...process.env };
const args = process.argv.slice(2);
delete env.SITEAUDIT_LOCAL_KEY_SETUP;
if (
  args[0] === "node_modules/next/dist/bin/next" &&
  args[1] === "dev" &&
  !args.slice(2).some((arg) => arg === "--hostname" || arg.startsWith("--hostname=") || arg.startsWith("-H"))
) {
  args.push("--hostname", "127.0.0.1");
  env.SITEAUDIT_LOCAL_KEY_SETUP = "1";
}
if (process.platform === "win32" && !env.NODE_EXTRA_CA_CERTS) {
  const directory = join(tmpdir(), "siteaudit-ai-certificates");
  mkdirSync(directory, { recursive: true });
  const certificateFile = join(directory, "windows-trusted-roots.pem");
  const certificates = execFileSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference = 'Stop'; foreach ($location in @('CurrentUser','LocalMachine')) { $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', $location); $store.Open('ReadOnly'); try { foreach ($certificate in $store.Certificates) { '-----BEGIN CERTIFICATE-----'; [Convert]::ToBase64String($certificate.RawData, [Base64FormattingOptions]::InsertLineBreaks); '-----END CERTIFICATE-----' } } finally { $store.Close() } }",
  ], { encoding: "utf8", windowsHide: true });
  if (!certificates.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error("Could not read the Windows trusted certificate store.");
  }
  writeFileSync(certificateFile, certificates, "utf8");
  env.NODE_EXTRA_CA_CERTS = certificateFile;
}

const child = spawn(process.execPath, args, {
  env, stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => { console.error(error.message); process.exit(1); });
