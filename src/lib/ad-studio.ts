import type { z } from "zod";
import type { adsSchema } from "./server/schemas";

export type AdDrafts = z.infer<typeof adsSchema>;
export type GoogleDraft = AdDrafts["googleAds"][number];
export type MetaDraft = AdDrafts["facebookAds"][number];
export type CreativeRatio = "1:1" | "16:9" | "9:16";
export type MetaPlacement = "feed" | "stories" | "reels";
export interface CreativeAsset {
  src: string;
  name: string;
  width: number;
  height: number;
}
export type CreativeAssets = Partial<Record<CreativeRatio, CreativeAsset>>;
export const CREATIVE_FORMATS: Array<{
  ratio: CreativeRatio;
  label: string;
  description: string;
}> = [
  { ratio: "1:1", label: "Square", description: "1:1" },
  { ratio: "16:9", label: "Landscape", description: "16:9" },
  { ratio: "9:16", label: "Vertical", description: "9:16" },
];
export function previewRatio(
  placement: MetaPlacement,
  feedRatio: CreativeRatio,
): CreativeRatio {
  return placement === "feed" ? feedRatio : "9:16";
}
export function selectCreativeAsset(
  assets: CreativeAssets,
  ratio: CreativeRatio,
) {
  const order: CreativeRatio[] = [
    ratio,
    ...CREATIVE_FORMATS.map((format) => format.ratio).filter(
      (item) => item !== ratio,
    ),
  ];
  for (const sourceRatio of order) {
    const asset = assets[sourceRatio];
    if (asset) return { asset, sourceRatio, reused: sourceRatio !== ratio };
  }
  return null;
}
export function imageFileError(file: {
  type: string;
  size: number;
}): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return "Choose a PNG, JPG, or WebP image.";
  if (file.size > 5_000_000)
    return "This image is too large. Choose a file smaller than 5 MB.";
  if (file.size === 0) return "This image file is empty. Choose another image.";
  return null;
}
export function campaignInstructions(brief: {
  audience: string;
  goal: string;
  tone: string;
  direction: string;
}) {
  return [
    `Campaign goal: ${brief.goal}.`,
    `Preferred tone: ${brief.tone}.`,
    brief.audience.trim() ? `Intended audience: ${brief.audience.trim()}.` : "",
    brief.direction.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}
export function draftEdited(
  draft: GoogleDraft | MetaDraft,
  original: GoogleDraft | MetaDraft,
) {
  return (
    draft.headline !== original.headline ||
    draft.description !== original.description ||
    ("primaryText" in draft &&
      "primaryText" in original &&
      draft.primaryText !== original.primaryText)
  );
}
export function draftText(draft: GoogleDraft | MetaDraft, url: string) {
  return [
    "primaryText" in draft ? draft.primaryText : null,
    draft.headline,
    draft.description,
    url,
  ]
    .filter(Boolean)
    .join("\n\n");
}
export function exportDrafts(drafts: AdDrafts, url: string, cta: string) {
  return [
    "SITEAUDIT AI · AD COPY DRAFTS",
    `Website: ${url}`,
    "Review all copy before publishing. These drafts are not published ads.",
    "",
    ...drafts.googleAds.flatMap((draft, index) => [
      `GOOGLE SEARCH · DRAFT ${index + 1}`,
      draftText(draft, url),
      "",
    ]),
    ...drafts.facebookAds.flatMap((draft, index) => [
      `META · DRAFT ${index + 1}`,
      draftText(draft, url),
      `Preview call to action: ${cta}`,
      "",
    ]),
  ].join("\n");
}
