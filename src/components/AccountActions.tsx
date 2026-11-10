"use client";
import Link from "next/link";
import { useState } from "react";
import type { Account } from "@/lib/auth";
import styles from "./Account.module.css";
import workspaceStyles from "./WorkspaceHome.module.css";
import Icon from "./Icon";

export default function AccountActions({
  account,
  publicLanding = false,
  compact = false,
}: {
  account: Account | null;
  publicLanding?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      window.location.replace("/login");
    } catch {
      setError("Couldn’t log out. Please retry.");
      setBusy(false);
    }
  }
  if (compact && account)
    return (
      <div className={workspaceStyles.accountArea}>
        <details
          className={workspaceStyles.accountMenu}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Account menu">
            <span className={workspaceStyles.avatar}>
              {account.email.charAt(0).toUpperCase()}
            </span>
            <span className={workspaceStyles.accountIdentity}>
              <strong>Your account</strong>
              <span title={account.email}>{account.email}</span>
            </span>
            <Icon name="more" width="18" height="18" />
          </summary>
          <div className={workspaceStyles.accountDropdown}>
            <span>Signed in as</span>
            <strong>{account.email}</strong>
            <button disabled={busy} onClick={() => void logout()}>
              {busy ? "Logging out…" : "Log out"}
              <Icon name="arrow" width="14" height="14" />
            </button>
          </div>
        </details>
        {error && (
          <p role="alert" className={workspaceStyles.error}>
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className={styles.accountNav}>
      {account && publicLanding ? (
        <Link className="button button-primary" href="/workspace">
          Open workspace
        </Link>
      ) : account ? (
        <>
          <Link href="/workspace">Audit history</Link>
          <span title={account.email}>{account.email}</span>
          <button
            className="button button-secondary"
            onClick={() => void logout()}
            disabled={busy}
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
        </>
      ) : (
        <>
          <Link href="/login">Log in</Link>
          <Link className="button button-primary" href="/signup">
            Create account
          </Link>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
