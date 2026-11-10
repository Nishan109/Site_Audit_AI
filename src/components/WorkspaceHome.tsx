"use client";

import { useId, useState, type ReactNode } from "react";
import Icon from "./Icon";
import styles from "./WorkspaceHome.module.css";

export default function WorkspaceHome({
  url,
  onUrlChange,
  onSubmit,
  ready,
  history,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (url: string) => void;
  ready: boolean;
  history?: ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const processId = useId();
  return (
    <div className={styles.home}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Your workspace</p>
          <h1 id="workspace-title" tabIndex={-1}>
            Website reviews
          </h1>
          <p>Start a new review or return to your saved findings.</p>
        </div>
      </div>
      <section className={styles.launchCard} aria-labelledby="new-review-title">
        <div className={styles.launchMain}>
          <div className={styles.cardLabel}>
            <span className={styles.launchIcon}>
              <Icon name="globe" width="19" height="19" />
            </span>
            <span>New website review</span>
          </div>
          <h2 id="new-review-title">Review a public website.</h2>
          <p>
            Turn your page content into supported findings and practical next
            steps.
          </p>
          <form
            className={styles.reviewForm}
            aria-label="Start a website review"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(url);
            }}
          >
            <label htmlFor="url-input">Your website address</label>
            <div className={styles.inputRow}>
              <div className={styles.urlField}>
                <Icon name="globe" width="18" height="18" />
                <input
                  id="url-input"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  required
                  maxLength={2048}
                  placeholder="yourwebsite.com or a specific page"
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  aria-describedby="review-hint"
                />
              </div>
              <button
                id="analyze-button"
                className={styles.reviewButton}
                disabled={!ready || !url.trim()}
              >
                Review website
                <Icon name="arrow" width="17" height="17" />
              </button>
            </div>
            <div className={styles.formNotes} id="review-hint">
              <span>
                <Icon name="shield" width="13" height="13" />
                Public pages only
              </span>
              <span>
                <Icon name="clock" width="13" height="13" />
                Can take a few minutes
              </span>
            </div>
          </form>
        </div>
        <aside
          className={`${styles.launchAside} ${detailsOpen ? styles.processExpanded : ""}`}
          aria-label="What your review includes"
        >
          <span className={styles.asideLabel}>From page to perspective</span>
          <button
            className={styles.processToggle}
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={processId}
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            What’s included?
            <Icon name="down" width="15" height="15" />
          </button>
          <ol className={styles.process} id={processId}>
            <li>
              <span>01</span>
              <div>
                <strong>Collect the evidence</strong>
                <p>Content and HTML from your pages.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Find what matters</strong>
                <p>Five focused AI perspectives.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Choose your next step</strong>
                <p>Priorities, sources, and an action plan.</p>
              </div>
            </li>
          </ol>
          <div className={styles.privateNote}>
            <Icon name="shield" width="14" height="14" />
            Completed reviews save to your private history.
          </div>
        </aside>
      </section>
      {history}
      <div className={styles.bottomNote}>
        <Icon name="info" width="14" height="14" />
        <p>
          Every report is a recorded review of the pages collected. Open a
          finding to see its evidence and scope.
        </p>
      </div>
    </div>
  );
}
