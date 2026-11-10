import Icon from "./Icon";
import styles from "./WorkspaceLoading.module.css";

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark}>
        <Icon name="chart" width="21" height="21" />
      </span>
      <span>
        SiteAudit<span className={styles.brandAi}>AI</span>
      </span>
    </div>
  );
}

// Decorative placeholders contain no controls or report data. Next replaces
// this server-rendered fallback as soon as the workspace route is ready.
export default function WorkspaceLoading() {
  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar} aria-hidden="true">
        <Brand />
        <div className={styles.sideContent}>
          <div className={styles.accountPlaceholder}>
            <span className={styles.square} />
            <div className={styles.lines}>
              <span className={styles.line} />
              <span className={`${styles.line} ${styles.short}`} />
            </div>
          </div>
          <span className={styles.sideAction} />
          <div className={styles.sideNavigation}>
            {[0, 1, 2, 3].map((row) => (
              <div
                className={row === 0 ? styles.selectedNav : styles.navRow}
                key={row}
              >
                <span className={styles.smallSquare} />
                <span className={styles.line} />
              </div>
            ))}
          </div>
          <div className={styles.sideFooter}>
            <span className={styles.square} />
            <span className={styles.line} />
          </div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar} aria-hidden="true">
          <div className={styles.desktopBreadcrumb}>
            Workspace <Icon name="chevron" width="13" height="13" />
            <span className={styles.breadcrumbPlaceholder} />
          </div>
          <div className={styles.mobileBrand}>
            <Brand />
          </div>
          <span className={styles.topbarPlaceholder} />
        </header>

        <main
          className={styles.main}
          aria-labelledby="workspace-loading-title"
        >
          <section
            className={styles.statusCard}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.loader} aria-hidden="true">
              <span className={styles.orbit} />
              <span className={styles.loaderMark}>
                <Icon name="chart" width="25" height="25" />
              </span>
            </div>
            <div className={styles.statusText}>
              <p className={styles.eyebrow}>SiteAudit AI workspace</p>
              <h1 id="workspace-loading-title">Opening your workspace</h1>
              <p className={styles.description}>
                Loading your reviews and saved findings.
              </p>
            </div>
          </section>

          {/* Keep the live status outside the busy region so its announcement
              is not deferred until the route has finished loading. */}
          <div
            className={styles.preview}
            role="region"
            aria-label="Workspace content"
            aria-busy="true"
          >
            <div className={styles.reviewCard} aria-hidden="true">
              <div className={styles.reviewContent}>
                <div className={styles.sectionLabel}>
                  <span className={styles.smallSquare} />
                  <span className={styles.line} />
                </div>
                <span className={styles.headingLine} />
                <span className={`${styles.line} ${styles.descriptionLine}`} />
                <div className={styles.formPlaceholder}>
                  <span className={`${styles.line} ${styles.short}`} />
                  <div className={styles.inputRow}>
                    <span className={styles.inputPlaceholder} />
                    <span className={styles.buttonPlaceholder} />
                  </div>
                  <span className={`${styles.line} ${styles.hintLine}`} />
                </div>
              </div>
              <div className={styles.reviewAside}>
                {[0, 1, 2].map((row) => (
                  <div className={styles.asideRow} key={row}>
                    <span className={styles.smallSquare} />
                    <div className={styles.lines}>
                      <span className={styles.line} />
                      <span className={`${styles.line} ${styles.short}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.historyCard} aria-hidden="true">
              <div className={styles.historyHeader}>
                <div className={styles.sectionLabel}>
                  <span className={styles.smallSquare} />
                  <span className={styles.line} />
                </div>
                <span className={styles.searchPlaceholder} />
              </div>
              {[0, 1, 2].map((row) => (
                <div className={styles.historyRow} key={row}>
                  <span className={styles.square} />
                  <div className={styles.lines}>
                    <span className={styles.line} />
                    <span className={`${styles.line} ${styles.short}`} />
                  </div>
                  <span className={styles.datePlaceholder} />
                  <span className={styles.statePlaceholder} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
