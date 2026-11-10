import { AuditError } from "./errors";
import { z } from "zod";
import { REVIEW_FOCUSES } from "../creative-comparison";

const comparisonOptionsSchema = z.object({
  textA: z.string().max(4000).default(""),
  textB: z.string().max(4000).default(""),
  focus: z.enum(REVIEW_FOCUSES).default("Overall clarity"),
  audience: z.string().max(180).trim().default(""),
});
export function parseComparisonOptions(body: Record<string, unknown>) {
  const parsed = comparisonOptionsSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === "focus"
        ? "Choose a supported review focus."
        : field === "audience"
          ? "Audience must be text under 180 characters."
          : `Creative ${field === "textB" ? "B" : "A"} copy must be text under 4,000 characters.`;
    throw new AuditError(message, 400, "INVALID_COMPARISON_INPUT");
  }
  return parsed.data;
}

export function parseCreativeImage(value: unknown) {
  if (typeof value !== "string")
    throw new AuditError(
      "Upload an image for each creative.",
      400,
      "INVALID_IMAGE",
    );
  const match = value.match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match || match[2].length > 7_000_000)
    throw new AuditError(
      "Use PNG, JPEG or WebP images smaller than 5 MB.",
      400,
      "INVALID_IMAGE",
    );
  const bytes = Buffer.from(match[2], "base64");
  const valid =
    match[1] === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid || bytes.length > 5_000_000)
    throw new AuditError(
      "The image data does not match a supported image format.",
      400,
      "INVALID_IMAGE",
    );
  return { inlineData: { mimeType: match[1], data: match[2] } };
}
