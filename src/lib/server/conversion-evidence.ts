import type { ConversionSource } from "../conversion";
import type { PageEvidence } from "./evidence";

export function conversionCatalog(pages: PageEvidence[]): ConversionSource[] {
  return pages.flatMap((page, pageIndex) => {
    const observations = (page.uxSnapshot?.sources || []).filter((source) =>
      ["page", "link", "button", "form", "field"].includes(source.kind),
    );
    const copy = (page.messagingCopy?.blocks || [])
      .slice(0, 55)
      .map((block) => ({
        kind: "copy" as const,
        location: `${block.region} · ${block.heading || block.kind}`,
        observation: JSON.stringify({
          text: block.text,
          kind: block.kind,
          region: block.region,
          heading: block.heading,
          destination: block.destination,
          renderingNote: block.renderingNote,
        }),
      }));
    return [...observations, ...copy].map((source, index) => ({
      ...source,
      kind: source.kind as ConversionSource["kind"],
      pageUrl: page.url,
      id: `C${pageIndex + 1}-E${index + 1}`,
    }));
  });
}
