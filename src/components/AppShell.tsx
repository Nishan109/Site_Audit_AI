"use client";
import { useRef, type ReactNode } from "react";
import Icon from "./Icon";
import { REPORT_NAV, type ReportSection } from "./navigation";
import styles from "./AppShell.module.css";
import { focusReviewForm } from "./landing-navigation";
import AccountActions from "./AccountActions";
import type { Account } from "@/lib/auth";
import WorkspaceShell from "./WorkspaceShell";
interface Props {
  account?: Account | null;
  publicLanding?: boolean;
  children?: ReactNode;
  hasResult: boolean;
  isLoading: boolean;
  section: ReportSection;
  onSectionChange: (section: ReportSection) => void;
  onNewAudit: () => void;
  domain?: string;
}
export default function AppShell({
  account = null,
  publicLanding = false,
  children,
  hasResult,
  isLoading,
  section,
  onSectionChange,
  onNewAudit,
  domain,
}: Props) {
  const isLanding = !hasResult && !isLoading;
  const navigation = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  if (account && !publicLanding && !hasResult && !isLoading) {
    return <WorkspaceShell account={account}>{children}</WorkspaceShell>;
  }
  const scrollToTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  const select = (key: ReportSection) => {
    onSectionChange(key);
    navigation.current?.close();
    scrollToTop();
  };
  const newAudit = () => {
    onNewAudit();
    navigation.current?.close();
    scrollToTop();
  };
  const brandContent = (
    <>
      <span className="brand-mark">
        <Icon name="chart" width="21" height="21" />
      </span>
      <span>
        SiteAudit<span className="brand-ai">AI</span>
      </span>
    </>
  );
  const sectionButton = (item: (typeof REPORT_NAV)[number]) => (
    <button
      type="button"
      className={`nav-item ${section === item.key ? "is-active" : ""}`}
      aria-current={section === item.key ? "page" : undefined}
      onClick={() => select(item.key)}
      key={item.key}
    >
      <Icon name={item.icon} />
      {item.label}
    </button>
  );
  const sidebar = (
    <>
      <button
        type="button"
        className={`brand ${styles.sidebarBrand}`}
        onClick={newAudit}
        aria-label="SiteAudit AI home"
      >
        {brandContent}
      </button>
      <div className={styles.reportContext}>
        Reviewing<strong>{domain || "Your website"}</strong>
      </div>
      <button
        type="button"
        className="button button-primary sidebar-new"
        onClick={newAudit}
      >
        <Icon name="plus" width="16" height="16" />
        New review
      </button>
      <nav
        aria-label="Report navigation"
        className={`sidebar-navigation ${styles.reportNav}`}
      >
        <p className={styles.navHeading}>Your review</p>
        {REPORT_NAV.filter((item) => item.group === "Your report").map(
          sectionButton,
        )}
        {[
          { group: "Deeper insights", label: "More checks" },
          { group: "Growth tools", label: "Creative & research tools" },
        ].map(({ group, label }) => (
          <details
            className={styles.group}
            key={group}
            open={REPORT_NAV.some(
              (item) => item.group === group && item.key === section,
            )}
          >
            <summary>
              {label}
              <Icon name="down" width="14" height="14" />
            </summary>
            {REPORT_NAV.filter((item) => item.group === group).map(
              sectionButton,
            )}
          </details>
        ))}
      </nav>
      <div className={styles.navFooter}>
        Findings link to collected page evidence.
      </div>
    </>
  );
  return (
    <div className={`app-shell ${hasResult ? styles.reportShell : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {hasResult && (
        <>
          <aside className="app-sidebar">{sidebar}</aside>
          <dialog
            ref={navigation}
            className="navigation-dialog"
            aria-label="Report navigation"
          >
            <button
              type="button"
              className="icon-button drawer-close"
              aria-label="Close navigation"
              onClick={() => navigation.current?.close()}
            >
              <Icon name="close" />
            </button>
            {sidebar}
          </dialog>
        </>
      )}
      <div
        className={`app-workspace ${hasResult ? "" : styles.startWorkspace}`}
      >
        <header
          className={`workspace-topbar ${styles.accountHeader} ${hasResult ? "" : styles.startHeader}`}
        >
          {hasResult ? (
            <div className="breadcrumb">
              <button
                type="button"
                className="icon-button menu-toggle"
                aria-label="Open navigation"
                onClick={() => navigation.current?.showModal()}
              >
                <Icon name="menu" />
              </button>
              <span className="breadcrumb-workspace">Your report</span>
              <Icon name="chevron" width="13" height="13" />
              <span className="breadcrumb-current">
                {REPORT_NAV.find((item) => item.key === section)?.label ||
                  "Overview"}
              </span>
            </div>
          ) : (
            <button
              type="button"
              className={styles.headerBrand}
              onClick={newAudit}
              aria-label="SiteAudit AI home"
            >
              {brandContent}
            </button>
          )}
          {isLanding ? (
            <div className={styles.landingActions}>
              {(!account || publicLanding) && (
                <nav
                  className={styles.landingNav}
                  aria-label="Landing page navigation"
                >
                  <a href="#what-you-get">What you get</a>
                  <a href="#how-it-works">How it works</a>
                  <a href="#faq">FAQ</a>
                </nav>
              )}
              {!account && (
                <button
                  type="button"
                  className={styles.headerReview}
                  onClick={focusReviewForm}
                >
                  Review my website
                  <Icon name="arrow" width="15" height="15" />
                </button>
              )}
              <AccountActions account={account} publicLanding={publicLanding} />
            </div>
          ) : (
            <div className={styles.workspaceActions}>
              <AccountActions account={account} />
              <button
                type="button"
                className={styles.helpButton}
                aria-label="How it works"
                onClick={() => help.current?.showModal()}
              >
                <Icon name="help" width="17" height="17" />
                <span>How it works</span>
              </button>
            </div>
          )}
        </header>
        <main
          id="main-content"
          className={`app-main ${hasResult ? "" : styles.startMain} ${isLanding ? styles.landingMain : ""}`}
          tabIndex={-1}
        >
          {children}
        </main>
        <footer
          className={`workspace-footer ${hasResult ? "" : styles.startFooter}`}
        >
          <span>© {new Date().getFullYear()} SiteAudit AI</span>
          {hasResult && <span>AI-assisted reviews with page evidence</span>}
          {isLanding && (!account || publicLanding) && (
            <nav className={styles.footerNav} aria-label="Footer navigation">
              <a href="#what-you-get">What you get</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">FAQ</a>
            </nav>
          )}
        </footer>
      </div>
      <dialog ref={help} className="help-dialog" aria-labelledby="help-title">
        <button
          type="button"
          className="icon-button dialog-close"
          aria-label="Close help"
          onClick={() => help.current?.close()}
        >
          <Icon name="close" />
        </button>
        <h2 id="help-title">How to review a website</h2>
        <p className={styles.helpIntro}>
          Start with a public website address. Sign in to save a completed
          review and return to it later.
        </p>
        <ol className="help-steps">
          <li>
            <span>1</span>
            <div>
              <h3>Enter a website</h3>
              <p>
                Use a homepage or a specific page. We read it and up to two
                related pages.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>Read your report</h3>
              <p>
                See findings, source evidence and suggested improvements.
                Research context is included when available.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>Choose what to improve</h3>
              <p>
                Open a category for details, use Quick wins for smaller tasks,
                or export the report.
              </p>
            </div>
          </li>
        </ol>
        <div className="info-note">
          <Icon name="info" />
          <p>
            AI scores are assessments. They do not measure sales, search
            rankings, or full security and accessibility compliance.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            help.current?.close();
            if (!hasResult && !isLoading)
              document.getElementById("url-input")?.focus();
          }}
        >
          Got it
        </button>
      </dialog>
    </div>
  );
}
