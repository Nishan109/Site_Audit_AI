"use client";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import Icon from "./Icon";
import AdMockup from "./AdMockup";
import { readCreativeImage } from "@/lib/client-image";
import {
  campaignInstructions,
  CREATIVE_FORMATS,
  draftEdited,
  draftText,
  exportDrafts,
  imageFileError,
  previewRatio,
  selectCreativeAsset,
  type AdDrafts,
  type CreativeAssets,
  type CreativeRatio,
  type GoogleDraft,
  type MetaDraft,
  type MetaPlacement,
} from "@/lib/ad-studio";
import styles from "./AdCreativeStudio.module.css";

function CopyField({
  label,
  value,
  onChange,
  maxLength,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        <span id={`${id}-count`}>
          {value.length}
          <span> / {maxLength}</span>
        </span>
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-count`}
      />
    </div>
  );
}
export default function AdCreativeStudio({ url }: { url: string }) {
  const [drafts, setDrafts] = useState<AdDrafts | null>(null),
    [originals, setOriginals] = useState<AdDrafts | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [briefOpen, setBriefOpen] = useState(true),
    [audience, setAudience] = useState(""),
    [goal, setGoal] = useState("Website visits"),
    [tone, setTone] = useState("Clear & professional"),
    [direction, setDirection] = useState("");
  const [channel, setChannel] = useState<"google" | "meta">("google"),
    [googleIndex, setGoogleIndex] = useState(0),
    [metaIndex, setMetaIndex] = useState(0);
  const [placement, setPlacement] = useState<MetaPlacement>("feed"),
    [feedRatio, setFeedRatio] = useState<CreativeRatio>("1:1"),
    [assets, setAssets] = useState<CreativeAssets>({});
  const [fit, setFit] = useState<"contain" | "cover">("contain"),
    [position, setPosition] = useState("center"),
    [cta, setCta] = useState("Learn more"),
    [mediaError, setMediaError] = useState(""),
    [uploading, setUploading] = useState(false),
    [copied, setCopied] = useState(false);
  const generation = useRef<AbortController | null>(null),
    uploadInput = useRef<HTMLInputElement>(null),
    uploadTarget = useRef<CreativeRatio>("1:1"),
    uploadVersion = useRef(0),
    copyVersion = useRef(0),
    previewDialog = useRef<HTMLDialogElement>(null);
  const uploadId = useId();
  useEffect(
    () => () => {
      generation.current?.abort();
      uploadVersion.current++;
      copyVersion.current++;
    },
    [],
  );
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const google = drafts?.googleAds[googleIndex],
    meta = drafts?.facebookAds[metaIndex];
  const current = channel === "google" ? google : meta;
  const original =
    channel === "google"
      ? originals?.googleAds[googleIndex]
      : originals?.facebookAds[metaIndex];
  const edited = !!current && !!original && draftEdited(current, original);
  const ratio = previewRatio(placement, feedRatio),
    selectedAsset = selectCreativeAsset(assets, ratio);
  const count =
    (drafts?.googleAds.length || 0) + (drafts?.facebookAds.length || 0);
  const activeIndex = channel === "google" ? googleIndex : metaIndex;
  const options =
    channel === "google" ? drafts?.googleAds : drafts?.facebookAds;
  const clearCopied = () => {
    copyVersion.current++;
    setCopied(false);
  };
  const chooseChannel = (next: "google" | "meta") => {
    setChannel(next);
    clearCopied();
  };
  const updateGoogle = (field: "headline" | "description", value: string) => {
    clearCopied();
    setDrafts((previous) =>
      previous
        ? {
            ...previous,
            googleAds: previous.googleAds.map((draft, index) =>
              index === googleIndex ? { ...draft, [field]: value } : draft,
            ),
          }
        : previous,
    );
  };
  const updateMeta = (
    field: "headline" | "description" | "primaryText",
    value: string,
  ) => {
    clearCopied();
    setDrafts((previous) =>
      previous
        ? {
            ...previous,
            facebookAds: previous.facebookAds.map((draft, index) =>
              index === metaIndex ? { ...draft, [field]: value } : draft,
            ),
          }
        : previous,
    );
  };
  const generate = async () => {
    if (loading) return;
    const controller = new AbortController();
    generation.current = controller;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/marketing-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(90_000),
        ]),
        body: JSON.stringify({
          url,
          customInstructions: campaignInstructions({
            audience,
            goal,
            tone,
            direction,
          }),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The drafts couldn’t be generated. Please try again.",
        );
      if (
        data.dataSource !== "live" ||
        !Array.isArray(data.googleAds) ||
        !data.googleAds.length ||
        !Array.isArray(data.facebookAds) ||
        !data.facebookAds.length ||
        data.facebookAds.some(
          (draft: { primaryText?: unknown }) =>
            typeof draft.primaryText !== "string",
        ) ||
        [...data.googleAds, ...data.facebookAds].some(
          (draft) =>
            typeof draft.headline !== "string" ||
            typeof draft.description !== "string",
        )
      )
        throw new Error("The AI returned incomplete drafts. Please try again.");
      if (controller.signal.aborted) return;
      setDrafts(data);
      setOriginals(data);
      setGoogleIndex(0);
      setMetaIndex(0);
      clearCopied();
      setBriefOpen(false);
      setNotice(
        "Your drafts are ready. Select an angle, refine the copy, and preview it.",
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error && error.name === "TimeoutError"
            ? "Writing the drafts took longer than expected. Try generating them again."
            : error instanceof Error
              ? error.message
              : "The drafts couldn’t be generated.",
        );
    } finally {
      if (generation.current === controller) {
        generation.current = null;
        setLoading(false);
      }
    }
  };
  const cancel = () => {
    generation.current?.abort();
    generation.current = null;
    setLoading(false);
    setNotice(
      drafts
        ? "Generation cancelled. Your existing drafts are still here."
        : "Generation cancelled. Update your brief and generate whenever you’re ready.",
    );
  };
  const upload = (target: CreativeRatio) => {
    uploadTarget.current = target;
    uploadInput.current?.click();
  };
  const onImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validation = imageFileError(file);
    if (validation) {
      setMediaError(validation);
      return;
    }
    const target = uploadTarget.current,
      version = ++uploadVersion.current;
    setUploading(true);
    setMediaError("");
    try {
      const asset = await readCreativeImage(file);
      if (version === uploadVersion.current)
        setAssets((previous) => ({ ...previous, [target]: asset }));
    } catch (error) {
      if (version === uploadVersion.current)
        setMediaError(
          error instanceof Error
            ? error.message
            : "The image couldn’t be read.",
        );
    } finally {
      if (version === uploadVersion.current) setUploading(false);
    }
  };
  const copy = async () => {
    if (!current) return;
    const version = ++copyVersion.current;
    try {
      await navigator.clipboard.writeText(draftText(current, url));
      if (version !== copyVersion.current) return;
      setCopied(true);
      setNotice("Draft copied to your clipboard.");
    } catch {
      if (version !== copyVersion.current) return;
      setCopied(false);
      setNotice(
        "Copying isn’t available. Select the text manually or use Download drafts.",
      );
    }
  };
  const download = () => {
    if (!drafts) return;
    const blob = new Blob([exportDrafts(drafts, url, cta)], {
      type: "text/plain;charset=utf-8",
    });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `${domain}-ad-drafts.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setNotice(
      "Draft copy downloaded. Uploaded images are kept in this preview only.",
    );
  };
  const resetDraft = () => {
    if (!original) return;
    if (channel === "google")
      setDrafts((previous) =>
        previous
          ? {
              ...previous,
              googleAds: previous.googleAds.map((draft, index) =>
                index === googleIndex
                  ? ({ ...original } as GoogleDraft)
                  : draft,
              ),
            }
          : previous,
      );
    else
      setDrafts((previous) =>
        previous
          ? {
              ...previous,
              facebookAds: previous.facebookAds.map((draft, index) =>
                index === metaIndex ? ({ ...original } as MetaDraft) : draft,
              ),
            }
          : previous,
      );
    clearCopied();
  };
  const mockup = (
    <AdMockup
      key={`${channel}-${activeIndex}-${placement}`}
      channel={channel}
      google={google}
      meta={meta}
      url={url}
      placement={placement}
      ratio={ratio}
      asset={selectedAsset?.asset}
      fit={fit}
      position={position}
      cta={cta}
      onUpload={() => {
        previewDialog.current?.close();
        upload(ratio);
      }}
    />
  );
  return (
    <section className={styles.studio} aria-label="Ad creative workspace">
      <div className={styles.studioToolbar}>
        <div>
          <span className={styles.studioMark}>
            <Icon name="pen" width="18" height="18" />
          </span>
          <div>
            <h3>A little direction. A stronger draft.</h3>
            <p>
              {drafts
                ? `${count} drafts to shape into your next campaign.`
                : "Start with your goal. We’ll bring your website context."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={!drafts}
          onClick={download}
        >
          <Icon name="download" width="15" height="15" />
          Download drafts
        </button>
      </div>
      <details
        className={styles.briefCard}
        open={briefOpen}
        onToggle={(event) => setBriefOpen(event.currentTarget.open)}
      >
        <summary>
          <span className={styles.step}>01</span>
          <span className={styles.cardTitle}>
            <strong>Set your creative direction</strong>
            <span>
              {briefOpen
                ? `Based on live content from ${domain}`
                : `${goal} · ${tone}`}
            </span>
          </span>
          <span className={styles.editBrief}>
            {briefOpen ? "Close brief" : "Edit brief"}
            <Icon name="down" width="14" height="14" />
          </span>
        </summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void generate();
          }}
          className={styles.briefBody}
        >
          <div className={styles.briefFields}>
            <div className={styles.field}>
              <label htmlFor="studio-audience">
                Who are you speaking to?<span>Optional</span>
              </label>
              <input
                id="studio-audience"
                value={audience}
                maxLength={180}
                disabled={loading}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="e.g. business owners, first-time customers"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="studio-goal">Campaign goal</label>
              <select
                id="studio-goal"
                value={goal}
                disabled={loading}
                onChange={(event) => setGoal(event.target.value)}
              >
                <option>Website visits</option>
                <option>Qualified enquiries</option>
                <option>Product interest</option>
                <option>Brand awareness</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="studio-tone">Tone of voice</label>
              <select
                id="studio-tone"
                value={tone}
                disabled={loading}
                onChange={(event) => setTone(event.target.value)}
              >
                <option>Clear & professional</option>
                <option>Warm & approachable</option>
                <option>Confident & direct</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="studio-direction">
              Anything we should keep in mind?
              <span>Optional · {direction.length}/1800</span>
            </label>
            <textarea
              id="studio-direction"
              rows={2}
              maxLength={1800}
              value={direction}
              disabled={loading}
              onChange={(event) => setDirection(event.target.value)}
              placeholder="A key benefit, your audience’s main concern, or an offer you can substantiate…"
            />
          </div>
          <div className={styles.briefFooter}>
            <p>
              <Icon name="link" width="14" height="14" />
              Uses your website’s content. No invented offers or results.
            </p>
            <div>
              {loading && (
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={cancel}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="button button-primary"
                disabled={loading}
              >
                <Icon
                  name={loading ? "loader" : "sparkle"}
                  className={loading ? "spin" : ""}
                  width="16"
                  height="16"
                />
                {loading
                  ? "Writing your drafts…"
                  : drafts
                    ? "Regenerate drafts"
                    : "Generate ad drafts"}
              </button>
            </div>
          </div>
          {drafts && (
            <p className={styles.replaceNote}>
              Regenerating replaces the current copy. Download any drafts you
              want to keep first.
            </p>
          )}
        </form>
      </details>
      {!briefOpen && (
        <div className={styles.generationBar}>
          <span>
            <Icon
              name={loading ? "loader" : "check"}
              className={loading ? "spin" : ""}
              width="14"
              height="14"
            />
            {loading
              ? "Reading your website and writing new drafts…"
              : "Your brief is ready. Refine the copy or try a fresh direction."}
          </span>
          <button
            type="button"
            onClick={loading ? cancel : () => void generate()}
          >
            {loading ? "Cancel generation" : "Regenerate drafts"}
            <Icon name={loading ? "close" : "refresh"} width="14" height="14" />
          </button>
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <Icon name="info" width="17" height="17" />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}
      <p className={styles.statusMessage} role="status">
        {notice}
      </p>
      <div className={styles.channelBar}>
        <div
          className={styles.channelTabs}
          role="group"
          aria-label="Ad channel"
        >
          <button
            type="button"
            aria-pressed={channel === "google"}
            onClick={() => chooseChannel("google")}
          >
            <span className={styles.googleSymbol}>G</span>Google Search
            {drafts && (
              <span className={styles.tabCount}>{drafts.googleAds.length}</span>
            )}
          </button>
          <button
            type="button"
            aria-pressed={channel === "meta"}
            onClick={() => chooseChannel("meta")}
          >
            <span className={styles.metaSymbol}>m</span>Meta ads
            {drafts && (
              <span className={styles.tabCount}>
                {drafts.facebookAds.length}
              </span>
            )}
          </button>
        </div>
        <span className={styles.draftContext}>
          <span />
          {drafts ? "Editable drafts" : "Draft workspace"}
        </span>
      </div>
      <div className={styles.columns}>
        <div className={styles.editorColumn}>
          <section
            className={styles.copyCard}
            aria-labelledby="studio-copy-title"
          >
            <div className={styles.cardHeader}>
              <span className={styles.step}>02</span>
              <span className={styles.cardTitle}>
                <strong id="studio-copy-title">Make the copy yours</strong>
                <span>Every change updates the preview.</span>
              </span>
              {current && (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => void copy()}
                  aria-label={copied ? "Draft copied" : "Copy current draft"}
                  title={copied ? "Copied" : "Copy current draft"}
                >
                  <Icon
                    name={copied ? "check" : "copy"}
                    width="17"
                    height="17"
                  />
                </button>
              )}
            </div>
            {options && current ? (
              <div className={styles.copyBody}>
                <div
                  className={styles.draftSelector}
                  role="group"
                  aria-label={`${channel === "google" ? "Google Search" : "Meta"} draft selection`}
                >
                  {options.map((draft, index) => (
                    <button
                      type="button"
                      key={index}
                      aria-pressed={activeIndex === index}
                      onClick={() => {
                        if (channel === "google") setGoogleIndex(index);
                        else setMetaIndex(index);
                        clearCopied();
                      }}
                      title={draft.tag || `Draft ${index + 1}`}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>Draft{" "}
                      {index + 1}
                    </button>
                  ))}
                </div>
                <div className={styles.draftMeta}>
                  <span className={styles.angle}>
                    {current.tag || "Website-based draft"}
                  </span>
                  {edited ? (
                    <span className={styles.editedBadge}>
                      <Icon name="pen" width="11" height="11" />
                      Edited by you
                    </span>
                  ) : (
                    <span
                      className={styles.scoreBadge}
                      title="AI assessment of the original copy, not measured ad performance"
                    >
                      AI copy score <strong>{current.score}/100</strong>
                    </span>
                  )}
                </div>
                {channel === "meta" && meta && (
                  <CopyField
                    label="Primary text"
                    value={meta.primaryText}
                    onChange={(value) => updateMeta("primaryText", value)}
                    maxLength={3000}
                    rows={5}
                  />
                )}
                <CopyField
                  label="Headline"
                  value={current.headline}
                  onChange={(value) =>
                    channel === "google"
                      ? updateGoogle("headline", value)
                      : updateMeta("headline", value)
                  }
                  maxLength={channel === "google" ? 30 : 120}
                />
                <CopyField
                  label="Description"
                  value={current.description}
                  onChange={(value) =>
                    channel === "google"
                      ? updateGoogle("description", value)
                      : updateMeta("description", value)
                  }
                  maxLength={channel === "google" ? 90 : 500}
                  rows={3}
                />
                {channel === "meta" && (
                  <div className={styles.field}>
                    <label htmlFor="studio-cta">Preview call to action</label>
                    <select
                      id="studio-cta"
                      value={cta}
                      onChange={(event) => setCta(event.target.value)}
                    >
                      <option>Learn more</option>
                      <option>Contact us</option>
                      <option>Get a quote</option>
                      <option>Sign up</option>
                      <option>Shop now</option>
                    </select>
                  </div>
                )}
                {current.reason && (
                  <details className={styles.reason}>
                    <summary>
                      <Icon name="sparkle" width="14" height="14" />
                      Why this angle?
                      <Icon name="down" width="13" height="13" />
                    </summary>
                    <p>{current.reason}</p>
                    {edited && (
                      <small>
                        This assessment refers to the original generated copy.
                      </small>
                    )}
                  </details>
                )}
                <div className={styles.copyFooter}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void copy()}
                  >
                    <Icon
                      name={copied ? "check" : "copy"}
                      width="14"
                      height="14"
                    />
                    {copied ? "Copied" : "Copy draft"}
                  </button>
                  {edited && (
                    <button type="button" onClick={resetDraft}>
                      <Icon name="refresh" width="13" height="13" />
                      Restore original
                    </button>
                  )}
                </div>
                <p className={styles.localNote}>
                  Edits stay in this report while you explore. Download to keep
                  them after reloading.
                </p>
              </div>
            ) : (
              <div className={styles.editorEmpty}>
                <span>
                  <Icon
                    name={loading ? "loader" : "pen"}
                    className={loading ? "spin" : ""}
                    width="26"
                    height="26"
                  />
                </span>
                <h4>
                  {loading
                    ? "Your ideas are taking shape."
                    : "A first draft is a great start."}
                </h4>
                <p>
                  {loading
                    ? "We’re using the live website content and your brief to write a few useful directions."
                    : "Generate your drafts above, then choose an angle and fine-tune every word here."}
                </p>
                <div className={styles.emptyChecks}>
                  <span>
                    <Icon name="check" width="13" height="13" />
                    Google Search copy
                  </span>
                  <span>
                    <Icon name="check" width="13" height="13" />
                    Meta ad copy
                  </span>
                </div>
              </div>
            )}
          </section>
          {channel === "meta" ? (
            <section
              className={styles.assetCard}
              aria-labelledby="studio-assets-title"
            >
              <div className={styles.assetHeader}>
                <span>
                  <Icon name="image" width="17" height="17" />
                </span>
                <div>
                  <h4 id="studio-assets-title">Give your copy a visual</h4>
                  <p>Add artwork for one or more formats.</p>
                </div>
                <span className={styles.optionalBadge}>Optional</span>
              </div>
              <input
                ref={uploadInput}
                id={uploadId}
                type="file"
                className="sr-only"
                tabIndex={-1}
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void onImage(event)}
                aria-label="Upload creative image"
              />
              <div className={styles.assetTiles}>
                {CREATIVE_FORMATS.map((format) => (
                  <div
                    className={`${styles.assetTile} ${ratio === format.ratio ? styles.assetActive : ""}`}
                    key={format.ratio}
                  >
                    <button
                      type="button"
                      onClick={() => upload(format.ratio)}
                      disabled={uploading}
                      aria-label={`${assets[format.ratio] ? "Replace" : "Upload"} ${format.label.toLowerCase()} creative`}
                    >
                      <span className={styles.assetThumbnail}>
                        {assets[format.ratio] ? (
                          <Image
                            src={assets[format.ratio]!.src}
                            alt={`${format.label} creative thumbnail`}
                            fill
                            unoptimized
                            sizes="120px"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <Icon name="plus" width="21" height="21" />
                        )}
                      </span>
                      <strong>{format.label}</strong>
                      <span>{format.description}</span>
                    </button>
                    {assets[format.ratio] && (
                      <button
                        type="button"
                        className={styles.removeAsset}
                        onClick={() => {
                          uploadVersion.current++;
                          setUploading(false);
                          setAssets((previous) => {
                            const next = { ...previous };
                            delete next[format.ratio];
                            return next;
                          });
                        }}
                        aria-label={`Remove ${format.label.toLowerCase()} creative`}
                        title="Remove image"
                      >
                        <Icon name="close" width="12" height="12" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className={styles.uploadHelp}>
                {uploading
                  ? "Preparing your image…"
                  : "PNG, JPG, or WebP · Up to 5 MB each. Images stay in your browser."}
              </p>
              {mediaError && (
                <p className={styles.mediaError} role="alert">
                  {mediaError}
                </p>
              )}
              {selectedAsset && (
                <>
                  <div className={styles.imageInfo}>
                    <Icon name="image" width="13" height="13" />
                    <span title={selectedAsset.asset.name}>
                      {selectedAsset.asset.name}
                    </span>
                    <small>
                      {selectedAsset.asset.width} × {selectedAsset.asset.height}
                    </small>
                  </div>
                  <div className={styles.fitControls}>
                    <div className={styles.field}>
                      <label htmlFor="studio-image-fit">Image fit</label>
                      <select
                        id="studio-image-fit"
                        value={fit}
                        onChange={(event) =>
                          setFit(event.target.value as "cover" | "contain")
                        }
                      >
                        <option value="contain">Fit entire image</option>
                        <option value="cover">Fill frame · crops edges</option>
                      </select>
                    </div>
                    {fit === "cover" && (
                      <div className={styles.field}>
                        <label htmlFor="studio-image-focus">Crop focus</label>
                        <select
                          id="studio-image-focus"
                          value={position}
                          onChange={(event) => setPosition(event.target.value)}
                        >
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          ) : (
            <div className={styles.searchNote}>
              <Icon name="info" width="16" height="16" />
              <p>
                Search ads are text-only in this preview. Choose{" "}
                <button type="button" onClick={() => chooseChannel("meta")}>
                  Meta ads
                </button>{" "}
                to add images and explore social placements.
              </p>
            </div>
          )}
        </div>
        <section
          className={styles.previewCard}
          aria-label="Ad placement preview"
        >
          <div className={styles.previewHeader}>
            <div>
              <span className={styles.step}>03</span>
              <span className={styles.cardTitle}>
                <strong>See it in context</strong>
                <span>
                  {channel === "google"
                    ? "Google Search"
                    : "Meta placement preview"}
                </span>
              </span>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => previewDialog.current?.showModal()}
              aria-label="Expand ad preview"
              title="Expand preview"
            >
              <Icon name="external" width="17" height="17" />
            </button>
          </div>
          {channel === "meta" && (
            <div className={styles.placementControls}>
              <div
                className={styles.placementTabs}
                role="group"
                aria-label="Meta placement"
              >
                {(["feed", "stories", "reels"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={placement === item}
                    onClick={() => setPlacement(item)}
                  >
                    {item === "feed"
                      ? "Feed"
                      : item === "stories"
                        ? "Stories"
                        : "Reels"}
                  </button>
                ))}
              </div>
              {placement === "feed" ? (
                <label className={styles.frameSelect}>
                  Frame
                  <select
                    value={feedRatio}
                    onChange={(event) =>
                      setFeedRatio(event.target.value as CreativeRatio)
                    }
                    aria-label="Feed preview aspect ratio"
                  >
                    {CREATIVE_FORMATS.map((format) => (
                      <option key={format.ratio} value={format.ratio}>
                        {format.description} · {format.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className={styles.frameLabel}>9:16 · Vertical</span>
              )}
            </div>
          )}
          <div
            className={`${styles.previewCanvas} ${channel === "meta" && placement !== "feed" ? styles.verticalCanvas : ""}`}
          >
            {mockup}
          </div>
          <div className={styles.previewFootnote}>
            <Icon name="eye" width="14" height="14" />
            <p>
              Illustrative placement preview. Actual ads may render differently.
            </p>
          </div>
          {channel === "meta" && selectedAsset?.reused && (
            <div className={styles.reuseNote}>
              <Icon name="info" width="14" height="14" />
              <p>
                Using your{" "}
                {CREATIVE_FORMATS.find(
                  (format) => format.ratio === selectedAsset.sourceRatio,
                )?.label.toLowerCase()}{" "}
                image in a {ratio} frame. Add a matching image or adjust Image
                fit.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className={styles.studioFootnote}>
        <Icon name="shield" width="15" height="15" />
        <p>
          AI drafts need your review. Copy scores assess the original wording;
          ad performance hasn’t been measured.
        </p>
      </div>
      <dialog
        ref={previewDialog}
        className={styles.previewDialog}
        aria-labelledby="studio-preview-title"
      >
        <div className={styles.dialogHeading}>
          <div>
            <span className="eyebrow">Placement preview</span>
            <h3 id="studio-preview-title">
              {channel === "google" ? "Google Search" : `Meta ${placement}`}
            </h3>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close ad preview"
            onClick={() => previewDialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div
          className={`${styles.dialogCanvas} ${channel === "meta" && placement !== "feed" ? styles.dialogVertical : ""}`}
        >
          {mockup}
        </div>
        <p className={styles.dialogNote}>
          This is an illustrative preview, not a published ad.
        </p>
      </dialog>
    </section>
  );
}
