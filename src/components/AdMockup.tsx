"use client";
import { useState } from "react";
import Image from "next/image";
import Icon from "./Icon";
import type {
  CreativeAsset,
  CreativeRatio,
  GoogleDraft,
  MetaDraft,
  MetaPlacement,
} from "@/lib/ad-studio";
import styles from "./AdCreativeStudio.module.css";

export function CreativeMedia({
  asset,
  ratio,
  fit,
  position,
  onUpload,
}: {
  asset?: CreativeAsset;
  ratio: CreativeRatio;
  fit: "cover" | "contain";
  position: string;
  onUpload?: () => void;
}) {
  return (
    <div
      className={`${styles.media} ${!asset ? styles.mediaEmpty : ""}`}
      style={{ aspectRatio: ratio.replace(":", "/") }}
    >
      {asset ? (
        <Image
          src={asset.src}
          alt={`Uploaded creative: ${asset.name}`}
          fill
          unoptimized
          sizes="(max-width: 640px) 90vw, 440px"
          style={{ objectFit: fit, objectPosition: position }}
        />
      ) : (
        <div className={styles.mediaPlaceholder}>
          <span>
            <Icon name="image" width="29" height="29" />
          </span>
          <strong>Your visual goes here</strong>
          <p>{ratio} creative preview</p>
          {onUpload && (
            <button type="button" onClick={onUpload}>
              <Icon name="plus" width="14" height="14" />
              Add an image
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export default function AdMockup({
  channel,
  google,
  meta,
  url,
  placement,
  ratio,
  asset,
  fit,
  position,
  cta,
  onUpload,
}: {
  channel: "google" | "meta";
  google?: Pick<GoogleDraft, "headline" | "description">;
  meta?: Pick<MetaDraft, "primaryText" | "headline" | "description">;
  url: string;
  placement: MetaPlacement;
  ratio: CreativeRatio;
  asset?: CreativeAsset;
  fit: "cover" | "contain";
  position: string;
  cta: string;
  onUpload?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const account = (
    <div className={styles.account}>
      <span className={styles.accountAvatar}>
        {domain.charAt(0).toUpperCase()}
      </span>
      <div>
        <strong>{domain}</strong>
        <span>
          Sponsored · <Icon name="globe" width="10" height="10" />
        </span>
      </div>
      <Icon name="more" width="20" height="20" />
    </div>
  );
  if (channel === "google")
    return (
      <div className={styles.googleMockup} aria-label="Google Search ad mockup">
        <div className={styles.googleWordmark} aria-hidden="true">
          <span>G</span>
          <span>o</span>
          <span>o</span>
          <span>g</span>
          <span>l</span>
          <span>e</span>
          <small>Search</small>
        </div>
        <div className={styles.searchAd}>
          <span className={styles.sponsored}>Sponsored</span>
          <div className={styles.searchIdentity}>
            <span className={styles.searchAvatar}>
              {domain.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{domain}</strong>
              <span>{url.replace(/\/$/, "")}</span>
            </div>
            <Icon name="more" width="16" height="16" />
          </div>
          {google ? (
            <>
              <h3>{google.headline}</h3>
              <p>{google.description}</p>
            </>
          ) : (
            <div className={styles.copyPlaceholder}>
              <span />
              <span />
              <p>Generate drafts to preview your search ad.</p>
            </div>
          )}
        </div>
        <div className={styles.searchContext} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (placement !== "feed")
    return (
      <div
        className={`${styles.verticalMockup} ${placement === "reels" ? styles.reelMockup : ""}`}
        aria-label={`Meta ${placement} ad mockup`}
      >
        <CreativeMedia
          asset={asset}
          ratio="9:16"
          fit={fit}
          position={position}
          onUpload={onUpload}
        />
        <div className={styles.verticalShade} />
        <div className={styles.verticalHeader}>
          {placement === "stories" && (
            <div className={styles.storyProgress}>
              <span />
              <span />
              <span />
            </div>
          )}
          {account}
        </div>
        {placement === "reels" && (
          <div className={styles.reelActions} aria-hidden="true">
            <Icon name="heart" />
            <Icon name="message" />
            <Icon name="arrow" />
            <Icon name="more" />
          </div>
        )}
        <div className={styles.verticalCopy}>
          {meta ? (
            <>
              <h3>{meta.headline}</h3>
              <p>{meta.primaryText}</p>
            </>
          ) : (
            <p>Your ad copy will appear here.</p>
          )}
          <span className={styles.verticalCta}>
            {cta}
            <Icon name="chevron" width="16" height="16" />
          </span>
          <span className={styles.verticalDomain}>{domain}</span>
        </div>
      </div>
    );
  return (
    <div className={styles.feedMockup} aria-label="Meta feed ad mockup">
      {account}
      <div className={styles.feedCopy}>
        {meta ? (
          <>
            <p className={expanded ? "" : styles.clampedCopy}>
              {meta.primaryText}
            </p>
            {meta.primaryText.length > 150 && (
              <button type="button" onClick={() => setExpanded(!expanded)}>
                {expanded ? "See less" : "See more"}
              </button>
            )}
          </>
        ) : (
          <p className={styles.placeholderText}>
            Your primary ad copy will appear here.
          </p>
        )}
      </div>
      <CreativeMedia
        asset={asset}
        ratio={ratio}
        fit={fit}
        position={position}
        onUpload={onUpload}
      />
      <div className={styles.feedLink}>
        <div>
          <span>{domain}</span>
          <h3>{meta?.headline || "Your headline will appear here"}</h3>
          {meta?.description && <p>{meta.description}</p>}
        </div>
        <span className={styles.feedCta}>{cta}</span>
      </div>
      <div className={styles.feedEngagement} aria-hidden="true">
        <span>
          <Icon name="thumb" width="15" height="15" />
          Like
        </span>
        <span>
          <Icon name="message" width="15" height="15" />
          Comment
        </span>
        <span>
          <Icon name="arrow" width="15" height="15" />
          Share
        </span>
      </div>
    </div>
  );
}
