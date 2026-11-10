"use client";

import { useId, useRef, useState, type Ref } from "react";
import type { ConversionAnalysis, ConversionSource } from "@/lib/conversion";
import { sourceURL } from "@/lib/dashboard";
import {
  conversionData,
  conversionDestination,
  conversionObservationRows,
  conversionPageLabel,
  conversionSourceKey,
  distinctConversionSources,
} from "@/lib/conversion-presentation";
import Icon from "./Icon";
import { ReviewSourceLink } from "./ReviewEvidence";
import layout from "./UXSection.module.css";
import styles from "./ConversionSection.module.css";

function ObservationRows({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <dl className={styles.observationRows}>
      {rows.map(({ label, value }, index) => (
        <div key={`${label}-${index}`}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : "Unknown";
}

export default function ConversionPageInspector({
  id,
  headingRef,
  analysis,
  observations,
  pages,
  page,
  onPageChange,
  onFindings,
}: {
  id: string;
  headingRef: Ref<HTMLHeadingElement>;
  analysis?: ConversionAnalysis;
  observations: ConversionSource[];
  pages: string[];
  page?: string;
  onPageChange: (page: string) => void;
  onFindings: (page: string) => void;
}) {
  const prefix = useId();
  const [expandedPage, setExpandedPage] = useState("");
  const formDetails = useRef(new Map<string, HTMLDetailsElement>());
  const onPage = (source: ConversionSource) =>
    sourceURL(source.pageUrl) === page;
  const actions = distinctConversionSources(
    (analysis?.actions || []).filter(onPage),
  );
  const forms = distinctConversionSources(
    (analysis?.forms || []).filter(onPage),
  );
  const formKeys = new Set(forms.map(conversionSourceKey));
  const fields = observations.filter(
    (source) => source.kind === "field" && onPage(source),
  );
  const showAll = expandedPage === page;

  function openForm(key: string) {
    const target = formDetails.current.get(key);
    if (!target) return;
    target.open = true;
    target.querySelector("summary")?.focus();
  }

  return (
    <div className={styles.workArea}>
      <header className={styles.heading}>
        <h3 id={id} ref={headingRef} tabIndex={-1}>
          Actions &amp; forms
        </h3>
        <p>
          Inspect the labels, destinations, and form questions recorded for a
          collected page.
        </p>
      </header>
      {page ? (
        <>
          <div className={styles.pageBar}>
            <div className={styles.pageIdentity}>
              <span className={styles.pageIcon}>
                <Icon name="globe" width="19" height="19" />
              </span>
              <div>
                <span>Collected page</span>
                <p>{page}</p>
              </div>
            </div>
            {pages.length > 1 && (
              <label className={styles.field}>
                Page to inspect
                <select
                  value={page}
                  onChange={(event) => {
                    onPageChange(event.target.value);
                    setExpandedPage("");
                  }}
                >
                  {pages.map((item) => (
                    <option key={item} value={item}>
                      {conversionPageLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className={styles.sourceActions}>
              <ReviewSourceLink url={page} label="Open audited page" />
              <button
                type="button"
                className={layout.button}
                onClick={() => onFindings(page)}
              >
                View findings for this page
              </button>
            </div>
          </div>
          <div className={styles.inspectorNote} role="status">
            <Icon name="info" width="16" height="16" />
            <p>
              {actions.length} selected{" "}
              {actions.length === 1 ? "action" : "actions"} · {forms.length}{" "}
              observed {forms.length === 1 ? "form" : "forms"}. The audit did
              not click controls or submit forms.
              {analysis?.scope?.truncated && " Some observations were sampled."}
            </p>
          </div>
          <div className={styles.pathGrid}>
            <section
              className={styles.pathPanel}
              aria-labelledby={`${prefix}-selected-actions`}
            >
              <header className={styles.panelHeading}>
                <h4 id={`${prefix}-selected-actions`}>Selected actions</h4>
                <span>{actions.length}</span>
              </header>
              <p>A shortlist from the collected links, controls, and forms.</p>
              {actions.length ? (
                <>
                  <div
                    className={styles.actionList}
                    id={`${prefix}-action-list`}
                  >
                    {actions
                      .slice(0, showAll ? actions.length : 3)
                      .map((source) => {
                        const key = conversionSourceKey(source);
                        const name = conversionData(source).name;
                        const linkedForm = formKeys.has(key);
                        const rows = conversionObservationRows(source).filter(
                          ({ label }) =>
                            ![
                              "Label",
                              "Destination",
                              "Declared destination",
                              "Live destination",
                            ].includes(label),
                        );
                        return (
                          <article className={styles.observation} key={key}>
                            <div className={styles.actionTop}>
                              <span>
                                {source.kind === "link"
                                  ? "Link"
                                  : source.kind === "form"
                                    ? "Form"
                                    : "Control"}
                              </span>
                              <span>Not clicked</span>
                            </div>
                            <h5>
                              {typeof name === "string" && name.trim()
                                ? name
                                : "No name recorded in HTML"}
                            </h5>
                            <p>{source.location}</p>
                            <ObservationRows
                              rows={[
                                {
                                  label: "Recorded destination",
                                  value: conversionDestination(source),
                                },
                              ]}
                            />
                            {linkedForm ? (
                              <button
                                type="button"
                                className={layout.textButton}
                                onClick={() => openForm(key)}
                              >
                                View matching form details{" "}
                                <Icon name="arrow" width="14" height="14" />
                              </button>
                            ) : (
                              !!rows.length && (
                                <details className={styles.recordDetails}>
                                  <summary>Collected control details</summary>
                                  <ObservationRows rows={rows} />
                                </details>
                              )
                            )}
                          </article>
                        );
                      })}
                  </div>
                  {actions.length > 3 && (
                    <button
                      type="button"
                      className={layout.button}
                      aria-expanded={showAll}
                      aria-controls={`${prefix}-action-list`}
                      onClick={() => setExpandedPage(showAll ? "" : page)}
                    >
                      {showAll
                        ? "Show fewer actions"
                        : `Show ${actions.length - 3} more ${actions.length === 4 ? "action" : "actions"}`}
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.emptyObservation}>
                  No action was selected for review on this page.
                </p>
              )}
            </section>
            <section
              className={styles.pathPanel}
              aria-labelledby={`${prefix}-observed-forms`}
            >
              <header className={styles.panelHeading}>
                <h4 id={`${prefix}-observed-forms`}>Observed forms</h4>
                <span>{forms.length}</span>
              </header>
              <p>Recorded names and questions from the collected HTML.</p>
              {forms.length ? (
                <div className={styles.actionList}>
                  {forms.map((source) => {
                    const data = conversionData(source);
                    const key = conversionSourceKey(source);
                    const associated =
                      typeof data.form === "string" && data.form
                        ? fields.filter(
                            (field) => conversionData(field).form === data.form,
                          )
                        : [];
                    const rows = conversionObservationRows(source).filter(
                      ({ label }) =>
                        ![
                          "Form name",
                          "Editable questions",
                          "Required questions",
                        ].includes(label),
                    );
                    return (
                      <article className={styles.observation} key={key}>
                        <h5>
                          {typeof data.name === "string" && data.name.trim()
                            ? data.name
                            : "No explicit form name"}
                        </h5>
                        <p>{source.location}</p>
                        <dl className={styles.formStats}>
                          <div>
                            <dt>Editable questions</dt>
                            <dd>{formCount(data.editableQuestions)}</dd>
                          </div>
                          <div>
                            <dt>Marked required</dt>
                            <dd>{formCount(data.requiredQuestions)}</dd>
                          </div>
                        </dl>
                        <details
                          className={styles.recordDetails}
                          ref={(element) => {
                            if (element) formDetails.current.set(key, element);
                            else formDetails.current.delete(key);
                          }}
                        >
                          <summary>Form details</summary>
                          <ObservationRows rows={rows} />
                          {typeof data.fields === "number" &&
                            Array.isArray(data.fieldLabels) &&
                            data.fields > data.fieldLabels.length && (
                              <p>Field labels show a sample from this form.</p>
                            )}
                          {!!associated.length && (
                            <div className={styles.fieldObservations}>
                              <strong>Associated field observations</strong>
                              {associated.map((field) => (
                                <div key={conversionSourceKey(field)}>
                                  <p>{field.location}</p>
                                  <ObservationRows
                                    rows={conversionObservationRows(field)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </details>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.emptyObservation}>
                  No form was recorded in this page sample.
                </p>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className={layout.empty}>
          <Icon name="link" width="22" height="22" />
          <h4>No collected page to inspect</h4>
          <p>
            This report has no recorded page inventory for the inspector.
            Available finding evidence remains in the Findings view.
          </p>
        </div>
      )}
    </div>
  );
}
