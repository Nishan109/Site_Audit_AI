"use client";
import { useId, useRef, useState } from "react";
import Icon from "./Icon";
import styles from "./ReportExample.module.css";

const sections = ["Overview", "Messaging & copy", "Quick wins"];

/** A deliberately isolated illustration. It never becomes an AuditResult. */
export default function ReportExample({
  interactive = false,
}: {
  interactive?: boolean;
}) {
  const [selected, setSelected] = useState(1);
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div className={styles.report}>
      <div className={styles.topbar}>
        <span className={styles.reportName}>
          <Icon name="chart" width="17" height="17" /> Example report
        </span>
        <span className={styles.exampleLabel}>Illustrative example</span>
      </div>
      <div className={styles.content}>
        <div className={styles.pageIdentity}>
          <span className={styles.websiteIcon}>
            <Icon name="globe" width="20" height="20" />
          </span>
          <div>
            <h2>One finding. A clearer next step.</h2>
            <p>example.com/pricing</p>
          </div>
        </div>
        {interactive ? (
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Example report sections"
          >
            {sections.map((label, index) => (
              <button
                key={label}
                type="button"
                role="tab"
                id={`${id}-tab-${index}`}
                aria-selected={selected === index}
                aria-controls={`${id}-panel`}
                tabIndex={selected === index ? 0 : -1}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                onClick={() => setSelected(index)}
                onKeyDown={(event) => {
                  let next: number;
                  if (event.key === "ArrowRight")
                    next = (index + 1) % sections.length;
                  else if (event.key === "ArrowLeft")
                    next = (index + sections.length - 1) % sections.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = sections.length - 1;
                  else return;
                  event.preventDefault();
                  setSelected(next);
                  tabs.current[next]?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.category}>
            <Icon name="message" width="14" height="14" /> Messaging & copy{" "}
            <span>Finding → Evidence → Action</span>
          </div>
        )}
        <div
          {...(interactive
            ? {
                role: "tabpanel",
                id: `${id}-panel`,
                "aria-labelledby": `${id}-tab-${selected}`,
                tabIndex: 0,
              }
            : {})}
        >
          {interactive && selected === 0 ? (
            <div className={styles.overview}>
              <span className={styles.eyebrow}>THE EXAMPLE AT A GLANCE</span>
              <h3>Help visitors understand their next action.</h3>
              <p>
                This fictional pricing page uses a broad button label. The
                review connects that observation to a more specific suggestion.
              </p>
              <ul>
                <li>
                  <Icon name="file" /> A source excerpt you can inspect
                </li>
                <li>
                  <Icon name="pen" /> Suggested wording with a reason
                </li>
                <li>
                  <Icon name="check" /> A practical step to review yourself
                </li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  setSelected(1);
                  tabs.current[1]?.focus();
                }}
              >
                Explore the finding <Icon name="arrow" width="16" height="16" />
              </button>
            </div>
          ) : interactive && selected === 2 ? (
            <div className={styles.overview}>
              <span className={styles.eyebrow}>YOUR EXAMPLE ACTION PLAN</span>
              <h3>Make the next click easier to understand.</h3>
              <ol className={styles.actionList}>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Review the button in context</strong>
                    <p>
                      Confirm that it opens the plan comparison on the pricing
                      page.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Make the label specific</strong>
                    <p>
                      Replace “Learn more” with “Compare plans” if that matches
                      its destination.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Check the experience</strong>
                    <p>
                      Test the destination and keyboard operation after the
                      change.
                    </p>
                  </div>
                </li>
              </ol>
              <p className={styles.qualifier}>
                This is a suggested improvement, with no measured conversion
                outcome.
              </p>
            </div>
          ) : (
            <article className={styles.finding}>
              <div className={styles.findingHeading}>
                <span className={styles.priority}>Suggested improvement</span>
                <span className={styles.findingNumber}>01</span>
              </div>
              <h3>Make the primary action more specific.</h3>
              <div className={styles.evidenceTrail}>
                <div className={styles.trailItem}>
                  <span className={styles.trailDot} />
                  <p className={styles.itemLabel}>
                    <Icon name="file" width="14" height="14" /> What the page
                    says
                  </p>
                  <blockquote>“Learn more”</blockquote>
                  <p className={styles.source}>Button text · /pricing</p>
                </div>
                <div className={styles.trailItem}>
                  <span className={styles.trailDot} />
                  <p className={styles.itemLabel}>
                    <Icon name="pen" width="14" height="14" /> A clearer
                    alternative
                  </p>
                  <span className={styles.suggestedButton}>
                    Compare plans <Icon name="arrow" width="15" height="15" />
                  </span>
                  <p className={styles.reason}>
                    A more specific label explains what visitors will find next.
                  </p>
                </div>
              </div>
              <div className={styles.nextStep}>
                <Icon name="check" width="17" height="17" />
                <p>
                  <strong>Your next step</strong>Update the label and check that
                  it opens the plan comparison.
                </p>
              </div>
            </article>
          )}
        </div>
        <p className={styles.footer}>
          <Icon name="info" width="13" height="13" /> Fictional content to
          demonstrate the report. No live audit.
        </p>
      </div>
    </div>
  );
}
