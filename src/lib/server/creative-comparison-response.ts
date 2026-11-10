import { NextResponse } from "next/server";
import { normalizeUrl } from "@/lib/server/url";
import { compareCreativeImages } from "@/lib/server/creative-comparison";
import { errorResponse, readBody } from "@/lib/server/errors";
import {
  parseCreativeImage,
  parseComparisonOptions,
} from "@/lib/server/creative";
export async function creativeComparisonResponse(request: Request) {
  try {
    const body = await readBody(request);
    const url = normalizeUrl(body.url);
    const imageA = parseCreativeImage(body.imageA);
    const imageB = parseCreativeImage(body.imageB);
    const { textA, textB, focus, audience } = parseComparisonOptions(body);
    const result = await compareCreativeImages(
      { url, imageA, imageB, textA, textB, focus, audience },
      AbortSignal.any([request.signal, AbortSignal.timeout(80_000)]),
    );
    return NextResponse.json(
      {
        ...result.data,
        creativeA: {
          ...result.data.creativeA,
          predictedCtr: "Not measured",
          predictedCvr: "Not measured",
        },
        creativeB: {
          ...result.data.creativeB,
          predictedCtr: "Not measured",
          predictedCvr: "Not measured",
        },
        modelUsed: result.modelUsed,
        dataSource: "live",
        analyzedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
