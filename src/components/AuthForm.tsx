"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import styles from "./Account.module.css";

export type AuthMode = "signup" | "login" | "forgot" | "reset";
const labels = {
  signup: "Create account",
  login: "Log in",
  forgot: "Send recovery link",
  reset: "Update password",
};

export default function AuthForm({
  mode,
  minLength,
  notice,
}: {
  mode: AuthMode;
  minLength: number;
  notice?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [confirmation, setConfirmation] = useState(
    notice === "expired" && (mode === "login" || mode === "signup"),
  );
  const [updated, setUpdated] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(action: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setField("");
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Please try again shortly.");
        setField(data.field || "");
        if (data.confirmation) setConfirmation(true);
        if (response.status === 429) setCooldown(60);
        return;
      }
      setPassword("");
      if (data.redirect) {
        window.location.assign(data.redirect);
        return;
      }
      setMessage(data.message);
      setConfirmation(Boolean(data.confirmation) || action === "resend");
      setUpdated(Boolean(data.updated));
      setCooldown(60);
    } catch {
      setError(
        "The request couldn’t finish. Check your connection and try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {notice === "expired" && (
        <p className={styles.notice} role="status">
          This link has expired or was already used. Request another
          confirmation or recovery link below.
        </p>
      )}
      {notice === "review" && (
        <p className={styles.notice}>
          Create an account to run your review and find it again later. Your
          website address is kept in this tab for 30 minutes where browser
          storage is available.
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert" id="auth-error">
          {error}
        </p>
      )}
      {updated ? (
        <Link className="button button-primary" href="/workspace">
          Open workspace <Icon name="arrow" />
        </Link>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void submit(mode);
          }}
        >
          {mode !== "reset" && (
            <div>
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={field === "email"}
                aria-describedby={field === "email" ? "auth-error" : undefined}
              />
            </div>
          )}
          {(mode === "signup" || mode === "login" || mode === "reset") &&
            !(mode === "signup" && confirmation && message) && (
              <div>
                <div className={styles.labelRow}>
                  <label htmlFor="auth-password">
                    {mode === "reset" ? "New password" : "Password"}
                  </label>
                  {mode === "login" && (
                    <Link href="/forgot-password">Forgot password?</Link>
                  )}
                </div>
                <div className={styles.password}>
                  <input
                    id="auth-password"
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    disabled={busy}
                    minLength={mode === "login" ? 1 : minLength}
                    maxLength={512}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={field === "password"}
                    aria-describedby={
                      field === "password"
                        ? "auth-error"
                        : mode !== "login"
                          ? "password-help"
                          : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-pressed={show}
                  >
                    {show ? "Hide" : "Show"}
                    <span className="sr-only"> password</span>
                  </button>
                </div>
                {mode !== "login" && (
                  <p id="password-help" className={styles.hint}>
                    Use at least {minLength} characters. A longer, unique
                    password is easier to keep secure.
                  </p>
                )}
              </div>
            )}
          {!(mode === "signup" && confirmation && message) && (
            <button
              className="button button-primary"
              disabled={busy || (mode === "forgot" && cooldown > 0)}
              type="submit"
            >
              {busy
                ? "Please wait…"
                : mode === "forgot" && cooldown > 0
                  ? `Try again in ${cooldown}s`
                  : labels[mode]}{" "}
              <Icon name="arrow" width="16" height="16" />
            </button>
          )}
          {confirmation && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy || cooldown > 0 || !email}
              onClick={() => void submit("resend")}
            >
              {cooldown > 0
                ? `Resend available in ${cooldown}s`
                : "Resend confirmation email"}
            </button>
          )}
        </form>
      )}
      <p className={styles.alternate}>
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : mode === "login" ? (
          <>
            New to SiteAudit AI? <Link href="/signup">Create account</Link>
          </>
        ) : (
          <Link href="/login">Back to log in</Link>
        )}
      </p>
      {notice === "expired" && (
        <Link href="/signup">Request a new signup confirmation</Link>
      )}
    </>
  );
}
