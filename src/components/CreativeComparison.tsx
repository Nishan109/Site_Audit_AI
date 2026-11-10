"use client";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Image from "next/image";
import Icon from "./Icon";
import AdMockup, { CreativeMedia } from "./AdMockup";
import {
  CREATIVE_FORMATS,
  imageFileError,
  type CreativeRatio,
  type MetaPlacement,
} from "@/lib/ad-studio";
import { readCreativeImage } from "@/lib/client-image";
import {
  comparisonCopy,
  comparisonReady,
  isComparisonResult,
  REVIEW_FOCUSES,
  REVIEW_CRITERIA,
  COMPARISON_TIE_THRESHOLD,
  reviewText,
  type ComparisonCreative,
  type CreativeVariant,
  type CreativeReview,
  type ReviewFocus,
} from "@/lib/creative-comparison";
import styles from "./CreativeComparison.module.css";

const emptyCreative = (): ComparisonCreative => ({
  headline: "",
  copy: "",
  fit: "contain",
  position: "center",
});
export default function CreativeComparison({ url }: { url: string }) {
  const [creatives, setCreatives] = useState<
    Record<CreativeVariant, ComparisonCreative>
  >({ A: emptyCreative(), B: emptyCreative() });
  const [uploading, setUploading] = useState({ A: false, B: false }),
    [uploadErrors, setUploadErrors] = useState({ A: "", B: "" }),
    [dragging, setDragging] = useState<CreativeVariant | null>(null);
  const [mode, setMode] = useState<"artwork" | MetaPlacement>("artwork"),
    [frame, setFrame] = useState<CreativeRatio>("1:1"),
    [cta, setCta] = useState("Learn more");
  const [audience, setAudience] = useState(""),
    [focus, setFocus] = useState<ReviewFocus>("Overall clarity"),
    [revision, setRevision] = useState(0);
  const [review, setReview] = useState<CreativeReview | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<CreativeVariant>("A");
  const inputs = useRef<
      Partial<Record<CreativeVariant, HTMLInputElement | null>>
    >({}),
    uploads = useRef({ A: 0, B: 0 }),
    revisionRef = useRef(0),
    request = useRef<AbortController | null>(null),
    copyVersion = useRef(0),
    dialog = useRef<HTMLDialogElement>(null),
    resultsRef = useRef<HTMLElement | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      uploads.current.A++;
      uploads.current.B++;
      copyVersion.current++;
    },
    [],
  );
  useEffect(() => {
    if (review)
      resultsRef.current?.scrollIntoView?.({
        block: "start",
        behavior: "auto",
      });
  }, [review]);
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const uploaded = Number(!!creatives.A.asset) + Number(!!creatives.B.asset),
    busyUploads = uploading.A || uploading.B;
  const ready = comparisonReady(creatives, loading, busyUploads),
    current = !!review && review.revision === revision,
    canExport = current && !loading && !busyUploads;
  const ratio = mode === "stories" || mode === "reels" ? "9:16" : frame;
  const invalidate = () => {
    revisionRef.current++;
    setRevision(revisionRef.current);
    request.current?.abort();
    request.current = null;
    setLoading(false);
    copyVersion.current++;
    setCopied(false);
    setNotice("");
    setError("");
  };
  const updateContent = (
    variant: CreativeVariant,
    key: "headline" | "copy",
    value: string,
  ) => {
    invalidate();
    setCreatives((previous) => ({
      ...previous,
      [variant]: { ...previous[variant], [key]: value },
    }));
  };
  const updateView = (
    variant: CreativeVariant,
    key: "fit" | "position",
    value: string,
  ) =>
    setCreatives((previous) => ({
      ...previous,
      [variant]: { ...previous[variant], [key]: value },
    }));
  const upload = async (variant: CreativeVariant, file?: File) => {
    if (!file) return;
    const invalid = imageFileError(file);
    if (invalid) {
      setUploadErrors((previous) => ({ ...previous, [variant]: invalid }));
      return;
    }
    const version = ++uploads.current[variant];
    setUploading((previous) => ({ ...previous, [variant]: true }));
    setUploadErrors((previous) => ({ ...previous, [variant]: "" }));
    try {
      const asset = await readCreativeImage(file);
      if (version !== uploads.current[variant]) return;
      invalidate();
      setCreatives((previous) => ({
        ...previous,
        [variant]: { ...previous[variant], asset },
      }));
    } catch (error) {
      if (version === uploads.current[variant])
        setUploadErrors((previous) => ({
          ...previous,
          [variant]:
            error instanceof Error
              ? error.message
              : "This image couldn’t be read.",
        }));
    } finally {
      if (version === uploads.current[variant])
        setUploading((previous) => ({ ...previous, [variant]: false }));
    }
  };
  const fileChange = (
    variant: CreativeVariant,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void upload(variant, file);
  };
  const drop = (variant: CreativeVariant, event: DragEvent) => {
    event.preventDefault();
    setDragging(null);
    void upload(variant, event.dataTransfer.files?.[0]);
  };
  const remove = (variant: CreativeVariant) => {
    uploads.current[variant]++;
    setUploading((previous) => ({ ...previous, [variant]: false }));
    setUploadErrors((previous) => ({ ...previous, [variant]: "" }));
    invalidate();
    setCreatives((previous) => ({
      ...previous,
      [variant]: { ...previous[variant], asset: undefined },
    }));
  };
  const swap = () => {
    if (uploaded !== 2 || busyUploads) return;
    invalidate();
    setCreatives((previous) => ({ A: previous.B, B: previous.A }));
    setUploadErrors({ A: "", B: "" });
  };
  const compare = async () => {
    if (!ready) return;
    const controller = new AbortController();
    request.current = controller;
    const version = revisionRef.current;
    setLoading(true);
    setError("");
    setNotice("");
    copyVersion.current++;
    setCopied(false);
    try {
      const response = await fetch("/api/analyze-creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(90_000),
        ]),
        body: JSON.stringify({
          url,
          imageA: creatives.A.asset!.src,
          imageB: creatives.B.asset!.src,
          textA: comparisonCopy(creatives.A),
          textB: comparisonCopy(creatives.B),
          focus,
          audience,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "The comparison couldn’t be completed. Please try again.",
        );
      if (
        !isComparisonResult(data) ||
        !("dataSource" in data) ||
        data.dataSource !== "live"
      )
        throw new Error(
          "The AI returned an incomplete comparison. Please try again.",
        );
      if (controller.signal.aborted || version !== revisionRef.current) return;
      setReview({
        result: data,
        revision: version,
        reviewedAt: new Date().toISOString(),
        model:
          "modelUsed" in data && typeof data.modelUsed === "string"
            ? data.modelUsed
            : "Gemini",
        focus,
        audience,
        names: { A: creatives.A.asset!.name, B: creatives.B.asset!.name },
      });
      setNotice(
        "Your review is ready. Explore the reasoning and next-version suggestions below.",
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error && error.name === "TimeoutError"
            ? "The review took longer than expected. Your creatives are still here; please try again."
            : error instanceof Error
              ? error.message
              : "The comparison couldn’t be completed.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  };
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setNotice("Review cancelled. Your images and copy are still here.");
  };
  const copyReview = async () => {
    if (!canExport || !review) return;
    const version = ++copyVersion.current;
    try {
      await navigator.clipboard.writeText(reviewText(review, url));
      if (version !== copyVersion.current) return;
      setCopied(true);
      setNotice("Review copied to your clipboard.");
    } catch {
      if (version !== copyVersion.current) return;
      setCopied(false);
      setNotice(
        "Copying isn’t available. Use Download review to keep a text copy.",
      );
    }
  };
  const download = () => {
    if (!canExport || !review) return;
    const link = document.createElement("a"),
      objectUrl = URL.createObjectURL(
        new Blob([reviewText(review, url)], {
          type: "text/plain;charset=utf-8",
        }),
      );
    link.href = objectUrl;
    link.download = `${domain}-creative-review.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setNotice(
      "Review downloaded as text. The original image files are not included.",
    );
  };
  const renderPreview = (variant: CreativeVariant) => {
    const creative = creatives[variant];
    return mode === "artwork" ? (
      <div
        className={`${styles.artworkFrame} ${ratio === "9:16" ? styles.portraitArtwork : ""}`}
      >
        <CreativeMedia
          asset={creative.asset}
          ratio={ratio}
          fit={creative.fit}
          position={creative.position}
        />
      </div>
    ) : (
      <AdMockup
        channel="meta"
        url={url}
        placement={mode}
        ratio={ratio}
        asset={creative.asset}
        fit={creative.fit}
        position={creative.position}
        cta={cta}
        meta={{
          primaryText: creative.copy,
          headline: creative.headline,
          description: "",
        }}
      />
    );
  };
  return (
    <section
      className={styles.workspace}
      aria-label="Creative comparison workspace"
    >
      <div className={styles.intro}>
        <div>
          <span className={styles.introIcon}>
            <Icon name="compare" width="20" height="20" />
          </span>
          <div>
            <h3>Two directions. A clearer next step.</h3>
            <p>
              Bring your ideas together, preview them in context, and get a
              thoughtful AI review.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={!canExport}
          onClick={download}
        >
          <Icon name="download" width="15" height="15" />
          Download review
        </button>
      </div>
      <section
        className={styles.setupCard}
        aria-labelledby="comparison-setup-title"
      >
        <div className={styles.sectionHeader}>
          <span className={styles.step}>01</span>
          <div>
            <h3 id="comparison-setup-title">Bring in your two directions</h3>
            <p>
              Upload each image once. Preview formats won’t replace your files.
            </p>
          </div>
          <span
            className={`${styles.readiness} ${uploaded === 2 ? styles.isReady : ""}`}
          >
            <span />
            {uploaded} of 2 added
          </span>
        </div>
        <div className={styles.setupFields}>
          <div className={styles.field}>
            <label htmlFor="comparison-focus">What matters most?</label>
            <select
              id="comparison-focus"
              value={focus}
              onChange={(event) => {
                invalidate();
                setFocus(event.target.value as ReviewFocus);
              }}
            >
              {REVIEW_FOCUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="comparison-audience">
              Who is this for?<span>Optional</span>
            </label>
            <input
              id="comparison-audience"
              value={audience}
              maxLength={180}
              onChange={(event) => {
                invalidate();
                setAudience(event.target.value);
              }}
              placeholder="e.g. hiring managers, small business owners"
            />
          </div>
        </div>
      </section>
      <div className={styles.uploadGrid}>
        {(["A", "B"] as const).map((variant) => {
          const creative = creatives[variant];
          return (
            <section
              key={variant}
              className={`${styles.creativeCard} ${variant === "B" ? styles.creativeB : ""}`}
              aria-labelledby={`comparison-${variant}-title`}
            >
              <div className={styles.creativeHeader}>
                <span className={styles.variantBadge}>{variant}</span>
                <div>
                  <h4 id={`comparison-${variant}-title`}>Creative {variant}</h4>
                  <p>
                    {variant === "A"
                      ? "Your first direction"
                      : "Your alternative direction"}
                  </p>
                </div>
                {creative.asset && (
                  <span className={styles.addedBadge}>
                    <Icon name="check" width="12" height="12" />
                    Added
                  </span>
                )}
              </div>
              <input
                ref={(element) => {
                  inputs.current[variant] = element;
                }}
                type="file"
                tabIndex={-1}
                className="sr-only"
                accept="image/png,image/jpeg,image/webp"
                aria-label={`Choose Creative ${variant} file`}
                onChange={(event) => fileChange(variant, event)}
              />
              <div
                className={`${styles.dropzone} ${dragging === variant ? styles.isDragging : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(variant);
                }}
                onDragLeave={() => setDragging(null)}
                onDrop={(event) => drop(variant, event)}
              >
                {creative.asset ? (
                  <>
                    <div className={styles.uploadImage}>
                      <Image
                        src={creative.asset.src}
                        alt={`Original Creative ${variant}: ${creative.asset.name}`}
                        fill
                        unoptimized
                        sizes="(max-width: 700px) 90vw, 450px"
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                    <div className={styles.fileInfo}>
                      <strong title={creative.asset.name}>
                        {creative.asset.name}
                      </strong>
                      <span>
                        {creative.asset.width} × {creative.asset.height} px
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={styles.uploadEmpty}>
                    <span>
                      <Icon name="image" width="27" height="27" />
                    </span>
                    <h5>Start with a visual</h5>
                    <p>Drop your image here, or choose a file.</p>
                  </div>
                )}
                <div className={styles.uploadActions}>
                  <button
                    type="button"
                    className={`button ${creative.asset ? "button-secondary" : "button-action"}`}
                    disabled={uploading[variant]}
                    onClick={() => inputs.current[variant]?.click()}
                    aria-label={`${creative.asset ? "Replace" : "Upload"} Creative ${variant} image`}
                  >
                    <Icon
                      name={uploading[variant] ? "loader" : "upload"}
                      className={uploading[variant] ? "spin" : ""}
                      width="14"
                      height="14"
                    />
                    {uploading[variant]
                      ? "Preparing image…"
                      : creative.asset
                        ? "Replace image"
                        : "Choose image"}
                  </button>
                  {creative.asset && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => remove(variant)}
                      aria-label={`Remove Creative ${variant} image`}
                    >
                      <Icon name="close" width="13" height="13" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {uploadErrors[variant] && (
                <p className={styles.inlineError} role="alert">
                  {uploadErrors[variant]}
                </p>
              )}
              <details className={styles.copyDetails}>
                <summary>
                  <Icon name="pen" width="14" height="14" />
                  Add optional ad copy
                  <span>
                    {creative.headline || creative.copy ? "Added" : "Optional"}
                  </span>
                  <Icon name="down" width="13" height="13" />
                </summary>
                <div className={styles.copyFields}>
                  <p>
                    Use the copy you plan to pair with this image. It also
                    appears in the placement mockup.
                  </p>
                  <div className={styles.field}>
                    <label htmlFor={`comparison-headline-${variant}`}>
                      Creative {variant} headline
                      <span>{creative.headline.length}/120</span>
                    </label>
                    <input
                      id={`comparison-headline-${variant}`}
                      maxLength={120}
                      value={creative.headline}
                      onChange={(event) =>
                        updateContent(variant, "headline", event.target.value)
                      }
                      placeholder="A clear, specific headline"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`comparison-copy-${variant}`}>
                      Creative {variant} primary text
                      <span>{creative.copy.length}/3000</span>
                    </label>
                    <textarea
                      id={`comparison-copy-${variant}`}
                      maxLength={3000}
                      rows={3}
                      value={creative.copy}
                      onChange={(event) =>
                        updateContent(variant, "copy", event.target.value)
                      }
                      placeholder="The message your audience will read…"
                    />
                  </div>
                </div>
              </details>
            </section>
          );
        })}
      </div>
      <div className={styles.comparisonBar}>
        <div>
          <Icon name="shield" width="16" height="16" />
          <p>
            PNG, JPG, or WebP · Up to 5 MB each.
            <span>
              Images are sent to Gemini only when you request an AI review.
            </span>
          </p>
        </div>
        <div>
          <button
            type="button"
            className="button button-secondary"
            onClick={swap}
            disabled={uploaded !== 2 || busyUploads || loading}
          >
            <Icon name="compare" width="15" height="15" />
            Swap A & B
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void compare()}
            disabled={!ready}
          >
            <Icon
              name={loading ? "loader" : "sparkle"}
              className={loading ? "spin" : ""}
              width="16"
              height="16"
            />
            {loading
              ? "Reviewing your creatives…"
              : review
                ? "Compare again"
                : "Compare creatives"}
          </button>
        </div>
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">
          <Icon name="info" width="17" height="17" />
          <p>{error}</p>
        </div>
      )}
      <p role="status" className={styles.notice}>
        {notice}
      </p>
      <section
        className={styles.previewSection}
        aria-labelledby="comparison-preview-title"
      >
        <div className={styles.sectionHeader}>
          <span className={styles.step}>02</span>
          <div>
            <h3 id="comparison-preview-title">
              See both ideas in the same context
            </h3>
            <p>
              Keep the entire image visible, or choose a crop for each creative.
            </p>
          </div>
        </div>
        <div className={styles.previewToolbar}>
          <div
            className={styles.modeTabs}
            role="group"
            aria-label="Comparison preview placement"
          >
            {(["artwork", "feed", "stories", "reels"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
              >
                {item === "artwork"
                  ? "Original artwork"
                  : item === "feed"
                    ? "Feed"
                    : item === "stories"
                      ? "Stories"
                      : "Reels"}
              </button>
            ))}
          </div>
          <div className={styles.frameControls}>
            {mode === "artwork" || mode === "feed" ? (
              <label>
                Frame
                <select
                  value={frame}
                  aria-label="Comparison preview frame"
                  onChange={(event) =>
                    setFrame(event.target.value as CreativeRatio)
                  }
                >
                  {CREATIVE_FORMATS.map((format) => (
                    <option key={format.ratio} value={format.ratio}>
                      {format.ratio} · {format.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>9:16 · Vertical frame</span>
            )}
            {mode !== "artwork" && (
              <label>
                Call to action
                <select
                  value={cta}
                  aria-label="Comparison preview call to action"
                  onChange={(event) => setCta(event.target.value)}
                >
                  <option>Learn more</option>
                  <option>Contact us</option>
                  <option>Get a quote</option>
                  <option>Sign up</option>
                  <option>Shop now</option>
                </select>
              </label>
            )}
          </div>
        </div>
        {uploaded === 0 ? (
          <div className={styles.previewEmpty}>
            <span>
              <Icon name="layers" width="24" height="24" />
            </span>
            <div>
              <h4>Your ideas, ready for a little perspective.</h4>
              <p>
                Add an image above, then explore the artwork, feed, story, and
                reel previews here.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.previewGrid}>
            {(["A", "B"] as const).map((variant) => (
              <article
                className={styles.previewCard}
                key={variant}
                aria-label={`Creative ${variant} placement preview`}
              >
                <div className={styles.previewCardHeader}>
                  <span
                    className={`${styles.variantBadge} ${variant === "B" ? styles.badgeB : ""}`}
                  >
                    {variant}
                  </span>
                  <div>
                    <strong>Creative {variant}</strong>
                    <span>
                      {creatives[variant].asset?.name || "No image added yet"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={!creatives[variant].asset}
                    onClick={() => {
                      setExpanded(variant);
                      dialog.current?.showModal();
                    }}
                    aria-label={`Expand Creative ${variant} preview`}
                    title="Expand preview"
                  >
                    <Icon name="external" width="16" height="16" />
                  </button>
                </div>
                <div className={styles.previewCanvas}>
                  {renderPreview(variant)}
                </div>
                {creatives[variant].asset && (
                  <div className={styles.fitRow}>
                    <label>
                      Image fit
                      <select
                        value={creatives[variant].fit}
                        aria-label={`Creative ${variant} image fit`}
                        onChange={(event) =>
                          updateView(variant, "fit", event.target.value)
                        }
                      >
                        <option value="contain">Fit entire image</option>
                        <option value="cover">Fill frame · crops edges</option>
                      </select>
                    </label>
                    {creatives[variant].fit === "cover" && (
                      <label>
                        Crop focus
                        <select
                          value={creatives[variant].position}
                          aria-label={`Creative ${variant} crop focus`}
                          onChange={(event) =>
                            updateView(variant, "position", event.target.value)
                          }
                        >
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <p className={styles.scopeNote}>
          <Icon name="eye" width="14" height="14" />
          Illustrative mockups. AI reviews the uploaded originals and supplied
          copy; preview crops do not change the files sent for review.
        </p>
      </section>
      {loading && (
        <section
          className={styles.loadingReview}
          aria-live="polite"
          aria-busy="true"
        >
          <span>
            <Icon name="loader" width="27" height="27" className="spin" />
          </span>
          <div>
            <h3>Taking a closer look at both directions.</h3>
            <p>
              Reviewing visual hierarchy, readability, message clarity, and
              calls to action.
            </p>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={cancel}
          >
            Cancel review
          </button>
        </section>
      )}
      {review && !current && !loading && (
        <div className={styles.staleNotice} role="status">
          <Icon name="info" width="17" height="17" />
          <div>
            <strong>Your creatives have changed.</strong>
            <p>
              Run the comparison again to get advice for the current images and
              copy.
            </p>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void compare()}
            disabled={!ready}
          >
            Update review
            <Icon name="arrow" width="14" height="14" />
          </button>
        </div>
      )}
      {review && current && !loading && (
        <section
          className={styles.results}
          ref={resultsRef}
          aria-labelledby="comparison-result-title"
        >
          <div className={styles.sectionHeader}>
            <span className={styles.step}>03</span>
            <div>
              <h3 id="comparison-result-title">
                A considered perspective on your next move
              </h3>
              <p>AI creative assessment · {review.focus}</p>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void copyReview()}
              disabled={!canExport}
            >
              <Icon name={copied ? "check" : "copy"} width="14" height="14" />
              {copied ? "Copied" : "Copy review"}
            </button>
          </div>
          <div className={styles.verdict}>
            <span>
              <Icon
                name={review.result.winner === "Tie" ? "compare" : "sparkle"}
                width="24"
                height="24"
              />
            </span>
            <div>
              <span className={styles.eyebrow}>
                AI preference · qualitative review
              </span>
              <h4>
                {review.result.winner === "Tie"
                  ? "No clear preference between these creatives."
                  : `${review.result.winner} is the stronger starting point.`}
              </h4>
              <p>{review.result.rationale}</p>
            </div>
          </div>
          <div className={styles.assessmentGrid}>
            {(["A", "B"] as const).map((variant) => {
              const assessment =
                variant === "A"
                  ? review.result.creativeA
                  : review.result.creativeB;
              return (
                <article className={styles.assessment} key={variant}>
                  <div className={styles.assessmentHeader}>
                    <span
                      className={`${styles.variantBadge} ${variant === "B" ? styles.badgeB : ""}`}
                    >
                      {variant}
                    </span>
                    <div>
                      <h4>Creative {variant}</h4>
                      <span>AI design assessment</span>
                    </div>
                    <div className={styles.score}>
                      <strong>{assessment.score}</strong>
                      <span>/100</span>
                    </div>
                  </div>
                  <div
                    className={styles.scoreTrack}
                    role="meter"
                    aria-label={`Creative ${variant} AI assessment`}
                    aria-valuenow={assessment.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${assessment.score}%` }} />
                  </div>
                  <h5>
                    <Icon name="check" width="14" height="14" />
                    What’s working
                  </h5>
                  <ul>
                    {assessment.strengths.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                  <h5>
                    <Icon name="pen" width="14" height="14" />
                    What to improve
                  </h5>
                  {assessment.weaknesses.length ? (
                    <ul>
                      {assessment.weaknesses.map((text, index) => (
                        <li key={index}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.noWeaknesses}>
                      No specific weaknesses were returned. Human review is
                      still useful.
                    </p>
                  )}
                  {assessment.criteria && (
                    <details className={styles.criteriaDetails}>
                      <summary>Score breakdown</summary>
                      <dl>
                        {REVIEW_CRITERIA.map(({ key, label }) => (
                          <div key={key}>
                            <dt>
                              {label}
                              <span>{assessment.criteria![key].score}/100</span>
                            </dt>
                            <dd>{assessment.criteria![key].evidence}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
          <div className={styles.recommendations}>
            <h4>
              <Icon name="bolt" width="18" height="18" />
              Make the next version stronger
            </h4>
            <ol>
              {review.result.recommendations.map((text, index) => (
                <li key={index}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
          <details className={styles.reviewDetails}>
            <summary>
              Review details
              <Icon name="down" width="13" height="13" />
            </summary>
            <p>
              Reviewed {new Date(review.reviewedAt).toLocaleString()} ·{" "}
              {review.model}
            </p>
            <p>
              A: {review.names.A}
              <br />
              B: {review.names.B}
            </p>
            {review.audience && <p>Intended audience: {review.audience}</p>}
            {review.result.reviewMethod === "independent-rubric-v1" && (
              <p>
                Each creative is assessed separately without an A/B label, using
                the same rubric and model settings. Your review focus determines
                the weighting. Scores within {COMPARISON_TIE_THRESHOLD} points
                receive no clear preference.
                {review.result.identicalInputs &&
                  " The image and supplied copy are identical, so one assessment applies equally to both."}
              </p>
            )}
          </details>
          <p className={styles.resultNote}>
            <Icon name="info" width="15" height="15" />
            This is a design review, not an A/B experiment. Click-through and
            conversion performance have not been measured.
          </p>
        </section>
      )}
      <dialog
        className={styles.previewDialog}
        ref={dialog}
        aria-labelledby="comparison-expanded-title"
      >
        <div className={styles.dialogHeader}>
          <div>
            <span className={styles.eyebrow}>Placement preview</span>
            <h3 id="comparison-expanded-title">
              Creative {expanded} ·{" "}
              {mode === "artwork" ? "Original artwork" : mode}
            </h3>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => dialog.current?.close()}
            aria-label="Close creative preview"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.dialogCanvas}>{renderPreview(expanded)}</div>
        <p className={styles.scopeNote}>
          Illustrative preview. The original image stays unchanged.
        </p>
      </dialog>
    </section>
  );
}
