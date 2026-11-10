"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import type { Account } from "@/lib/auth";
import Icon from "./Icon";
import AccountActions from "./AccountActions";
import { focusReviewForm } from "./landing-navigation";
import styles from "./WorkspaceHome.module.css";

export default function WorkspaceShell({
  account,
  children,
}: {
  account: Account;
  children?: ReactNode;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const [area, setArea] = useState<"overview" | "history">("overview");

  function goTo(area: "overview" | "history") {
    setArea(area);
    drawer.current?.close();
    const target = document.getElementById(
      area === "history" ? "history-title" : "workspace-title",
    );
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  function newReview() {
    setArea("overview");
    drawer.current?.close();
    focusReviewForm();
  }

  const navigation = (
    <>
      <Link className={styles.brand} href="/" aria-label="SiteAudit AI home">
        <span className={styles.brandMark}>
          <Icon name="chart" width="21" height="21" />
        </span>
        <span>
          SiteAudit<span className={styles.brandAi}>AI</span>
        </span>
      </Link>
      <div className={styles.spaceLabel}>
        <span className={styles.spaceIcon}>
          <Icon name="layers" width="16" height="16" />
        </span>
        <div>
          <strong>Personal workspace</strong>
          <span>Your website intelligence</span>
        </div>
      </div>
      <button className={styles.newReview} onClick={newReview}>
        <Icon name="plus" width="17" height="17" />
        New review
      </button>
      <nav className={styles.navigation} aria-label="Workspace navigation">
        <p className={styles.navLabel}>Workspace</p>
        <button
          className={area === "overview" ? styles.navActive : styles.navItem}
          aria-current={area === "overview" ? "location" : undefined}
          onClick={() => goTo("overview")}
        >
          <Icon name="grid" width="18" height="18" />
          Overview
        </button>
        <button
          className={area === "history" ? styles.navActive : styles.navItem}
          aria-current={area === "history" ? "location" : undefined}
          onClick={() => goTo("history")}
        >
          <Icon name="file" width="18" height="18" />
          Audit history
        </button>
        <p className={styles.navLabel}>Resources</p>
        <button
          className={styles.navItem}
          onClick={() => {
            drawer.current?.close();
            help.current?.showModal();
          }}
        >
          <Icon name="help" width="18" height="18" />
          How it works
        </button>
        <Link className={styles.navItem} href="/">
          <Icon name="external" width="18" height="18" />
          Back to website
        </Link>
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.sidebarNote}>
          <Icon name="sparkle" width="19" height="19" />
          <strong>A clearer next step.</strong>
          <p>Every finding connects to page evidence and a practical action.</p>
        </div>
        <AccountActions account={account} compact />
      </div>
    </>
  );

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className={styles.sidebar}>{navigation}</aside>
      <dialog
        className={styles.drawer}
        ref={drawer}
        aria-label="Workspace navigation"
      >
        <button
          className={styles.drawerClose}
          aria-label="Close navigation"
          onClick={() => drawer.current?.close()}
        >
          <Icon name="close" />
        </button>
        {navigation}
      </dialog>
      <div className={styles.workArea}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <button
              className={styles.menuButton}
              aria-label="Open navigation"
              onClick={() => drawer.current?.showModal()}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <Icon name="chevron" width="13" height="13" />
            <strong>{area === "history" ? "Audit history" : "Overview"}</strong>
          </div>
          <span className={styles.privateLabel}>
            <Icon name="shield" width="14" height="14" />
            Private workspace
          </span>
        </header>
        <main className={styles.main} id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} SiteAudit AI</span>
          <span>Evidence for your next improvement.</span>
        </footer>
      </div>
      <dialog
        className="help-dialog"
        ref={help}
        aria-labelledby="workspace-help-title"
        onClose={() =>
          document.getElementById("url-input")?.focus({ preventScroll: true })
        }
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close help"
          onClick={() => help.current?.close()}
        >
          <Icon name="close" />
        </button>
        <h2 id="workspace-help-title">From website to next step</h2>
        <ol className={styles.helpSteps}>
          <li>
            <strong>Start with a public page</strong>
            <p>
              Enter a homepage or a specific page. We collect it and up to two
              accessible related pages.
            </p>
          </li>
          <li>
            <strong>Review the evidence</strong>
            <p>
              Explore messaging, user experience, search foundations, conversion
              clarity, and AI content readiness.
            </p>
          </li>
          <li>
            <strong>Choose an improvement</strong>
            <p>
              Inspect a finding, follow its suggested steps, and export your
              report. Return to the original snapshot from audit history.
            </p>
          </li>
        </ol>
        <p className={styles.helpScope}>
          Scores are qualitative AI assessments. The report lists the pages
          collected and the limits of each check.
        </p>
        <button
          className="button button-primary"
          onClick={() => {
            help.current?.close();
            newReview();
          }}
        >
          Start a review
          <Icon name="arrow" width="16" height="16" />
        </button>
      </dialog>
    </div>
  );
}
