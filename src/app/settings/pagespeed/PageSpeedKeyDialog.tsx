"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Icon from "@/components/Icon";
import { PAGE_SPEED_KEY_CHANNEL } from "@/lib/pagespeed";
import styles from "./settings.module.css";

export default function PageSpeedKeyDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function open() {
    dialog.current?.showModal();
    input.current?.focus();
  }

  useEffect(() => {
    if (!dialog.current?.open) open();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/pagespeed/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ key: input.current?.value }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.saved !== true) {
        setError(
          typeof result?.error === "string"
            ? result.error
            : "The key could not be saved. Try again.",
        );
        return;
      }
      if (input.current) input.current.value = "";
      setSaved(true);
      if (typeof window.BroadcastChannel === "function") {
        const channel = new BroadcastChannel(PAGE_SPEED_KEY_CHANNEL);
        channel.postMessage("saved");
        channel.close();
      }
    } catch {
      setError("The key could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="button button-primary"
        onClick={open}
      >
        Configure PageSpeed API key
      </button>
      <dialog
        ref={dialog}
        className={`help-dialog ${styles.dialog}`}
        aria-labelledby="pagespeed-key-title"
        aria-describedby="pagespeed-key-description"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => {
          if (input.current) input.current.value = "";
          setError("");
          setSaved(false);
          opener.current?.focus();
        }}
      >
        <button
          type="button"
          className="icon-button dialog-close"
          aria-label="Close key setup"
          disabled={saving}
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" />
        </button>
        <span className={styles.badge}>
          <Icon name="shield" width="15" height="15" /> Local setup
        </span>
        <h2 id="pagespeed-key-title">PageSpeed API key</h2>
        <p id="pagespeed-key-description">
          Paste the key from Google Cloud Credentials. SiteAudit saves it in{" "}
          <code>.env.local</code> for this computer.
        </p>
        <form className={styles.form} onSubmit={save}>
          <label htmlFor="pagespeed-key">Google PageSpeed API key</label>
          <input
            ref={input}
            id="pagespeed-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={160}
            required
            disabled={saving}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className={styles.saved} role="status">
              Key saved. Return to PageSpeed insights and run the test again.
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className="button button-secondary"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              {saved ? "Done" : "Cancel"}
            </button>
            {!saved && (
              <button
                type="submit"
                className="button button-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save key"}
              </button>
            )}
          </div>
        </form>
        <a
          className={styles.guide}
          href="https://developers.google.com/speed/docs/insights/v5/get-started"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get a PageSpeed API key{" "}
          <Icon name="external" width="14" height="14" />
        </a>
      </dialog>
    </>
  );
}
