"use client";

import { useId, useState, type Ref } from "react";
import type { AIVisibilitySource } from "@/lib/ai-visibility";
import {
  aiHeadingRows,
  aiMarkupRows,
  aiVisibilityPageEvidence,
  type ReadinessPage,
} from "@/lib/ai-visibility-presentation";
import { reportTime } from "@/lib/dashboard-evidence";
import { AIVisibilityObservations } from "./AIVisibilityEvidence";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import layout from "./UXSection.module.css";
import workbench from "./ConversionSection.module.css";
import styles from "./AIVisibilitySection.module.css";

function RecordedValues({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <dl className={styles.rows}>
      {rows.map(({ label, value }, index) => (
        <div key={`${label}-${index}`}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AIVisibilityPageInspector({
  headingId,
  headingRef,
  page,
  pages,
  observations,
  onSelect,
  onFindings,
}: {
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  page?: ReadinessPage;
  pages: ReadinessPage[];
  observations: AIVisibilitySource[];
  onSelect: (page: string) => void;
  onFindings: (page: string) => void;
}) {
  const excerptId = useId();
  const [expandedPage, setExpandedPage] = useState("");
  const evidence = page && aiVisibilityPageEvidence(page, observations);
  const outline = aiHeadingRows(page?.record?.headings);
  const markup = page?.record?.markup;
  const expanded = page?.url === expandedPage;

  return (
    <div className={workbench.workArea}>
      <header className={workbench.heading}>
        <h3 id={headingId} ref={headingRef} tabIndex={-1}>
          Page evidence
        </h3>
        <p>Inspect the wording, headings, and markup collected for one page.</p>
      </header>
      {page && evidence ? (
        <>
          <div className={workbench.pageBar}>
            <div className={workbench.pageIdentity}>
              <span className={workbench.pageIcon}>
                <Icon name="globe" width="19" height="19" />
              </span>
              <div>
                <h4>{page.title}</h4>
                <p>{page.url}</p>
                {page.fetchedAt && (
                  <time className={styles.note} dateTime={page.fetchedAt}>
                    Collected {reportTime(page.fetchedAt)}
                  </time>
                )}
              </div>
            </div>
            {pages.length > 1 && (
              <label className={workbench.field}>
                Page to inspect
                <select
                  value={page.url}
                  onChange={(event) => onSelect(event.target.value)}
                >
                  {pages.map(({ url }) => (
                    <option key={url} value={url}>
                      {url}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className={workbench.sourceActions}>
              <ReviewSourceLink url={page.url} label="Open audited page" />
              <button
                type="button"
                className={layout.button}
                onClick={() => onFindings(page.url)}
              >
                View findings for this page
              </button>
            </div>
          </div>
          {page.record?.sampled && (
            <p className={styles.note}>
              Some content or technical observations were sampled on this page.
            </p>
          )}
          <div className={styles.pageGrid} key={page.url}>
            <section className={styles.panel}>
              <header>
                <h4>Collected wording</h4>
                <p>
                  {evidence.copy.length} recorded{" "}
                  {evidence.copy.length === 1 ? "excerpt" : "excerpts"}
                </p>
              </header>
              {evidence.copy.length ? (
                <>
                  <div id={excerptId}>
                    <AIVisibilityObservations
                      sources={evidence.copy.slice(0, expanded ? undefined : 3)}
                      showPage={false}
                    />
                  </div>
                  {evidence.copy.length > 3 && (
                    <button
                      type="button"
                      className={layout.button}
                      aria-controls={excerptId}
                      aria-expanded={expanded}
                      onClick={() => setExpandedPage(expanded ? "" : page.url)}
                    >
                      {expanded
                        ? "Show fewer excerpts"
                        : `Show all ${evidence.copy.length} collected excerpts`}
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.emptyObservation}>
                  No readable wording was collected for this page.
                </p>
              )}
            </section>
            <div className={styles.technicalStack}>
              <section className={styles.panel}>
                <header>
                  <h4>Headings and page metadata</h4>
                  <p>Recorded structure and page declarations</p>
                </header>
                {evidence.metadata.length ? (
                  <AIVisibilityObservations
                    sources={evidence.metadata}
                    showPage={false}
                  />
                ) : (
                  <p className={styles.note}>Page metadata was not recorded.</p>
                )}
                {evidence.headings.length ? (
                  <AIVisibilityObservations
                    sources={evidence.headings}
                    showPage={false}
                  />
                ) : outline.length ? (
                  <RecordedValues rows={outline} />
                ) : (
                  <p className={styles.note}>
                    {markup?.collected && Array.isArray(page.record?.headings)
                      ? "No headings collected."
                      : "Heading observations were not recorded."}
                  </p>
                )}
              </section>
              <section className={styles.panel}>
                <header>
                  <h4>Structured data</h4>
                  <p>Inventory of declared markup and JSON-LD parsing</p>
                </header>
                {markup?.collected === true ? (
                  <>
                    <RecordedValues rows={aiMarkupRows(markup)} />
                    <p className={styles.note}>
                      Vocabulary correctness and rich-result eligibility were
                      not tested.
                    </p>
                    {!!evidence.structured.length && (
                      <details className={styles.sourceDisclosure}>
                        <summary>View recorded markup observations</summary>
                        <AIVisibilityObservations
                          sources={evidence.structured}
                          showPage={false}
                        />
                      </details>
                    )}
                  </>
                ) : (
                  <p className={styles.emptyObservation}>
                    Not collected for this page.
                  </p>
                )}
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className={layout.empty}>
          <Icon name="file" width="22" height="22" />
          <h4>No collected page to inspect</h4>
          <p>Any saved finding evidence is available in Findings.</p>
        </div>
      )}
    </div>
  );
}
