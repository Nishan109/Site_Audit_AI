import type { AIVisibilityPage, AIVisibilitySource } from "../ai-visibility";
import type { PageEvidence } from "./evidence";

export function aiVisibilityEvidence(pages: PageEvidence[]) {
  const catalog: AIVisibilitySource[] = [];
  const inventory: AIVisibilityPage[] = [];
  pages.forEach((page, pageIndex) => {
    const prefix = `AI${pageIndex + 1}`;
    const blocks = (page.messagingCopy?.blocks || []).filter(
      (block) =>
        ["main", "body"].includes(block.region) &&
        !["link", "button", "label"].includes(block.kind),
    );
    // Preserve introductory context and sample the rest of a long page evenly,
    // rather than treating its first product or section as the entire offering.
    const indexes =
      blocks.length <= 45
        ? blocks.map((_, index) => index)
        : [
            ...Array.from({ length: 15 }, (_, index) => index),
            ...Array.from(
              { length: 30 },
              (_, index) =>
                15 + Math.round((index * (blocks.length - 16)) / 29),
            ),
          ];
    const excerpts = indexes.map((index): AIVisibilitySource => {
      const block = blocks[index];
      return {
        id: `${prefix}-C${index + 1}`,
        pageUrl: page.url,
        kind: "copy",
        label: block.kind === "heading" ? "Page heading" : "Page excerpt",
        text: block.text.slice(0, 700),
        region: block.region,
        heading: block.heading,
        truncated: block.truncated || block.text.length > 700,
      };
    });
    catalog.push(...excerpts);
    const seo = page.seoSnapshot;
    const sampled =
      !!page.messagingCopy?.truncated ||
      blocks.length > 45 ||
      excerpts.some((source) => source.truncated) ||
      !!seo?.truncated;
    if (seo) {
      for (const item of [
        {
          suffix: "M",
          kind: "metadata" as const,
          label: "Collected page metadata",
          value: {
            titles: seo.titles,
            descriptions: seo.descriptions,
            language: seo.language,
          },
        },
        {
          suffix: "H",
          kind: "headings" as const,
          label: "Collected heading outline",
          value: { headings: seo.headings },
        },
        {
          suffix: "S",
          kind: "structured" as const,
          label: "Structured-data observations",
          value: seo.structured,
        },
      ])
        catalog.push({
          id: `${prefix}-${item.suffix}`,
          pageUrl: page.url,
          kind: item.kind,
          label: item.label,
          text: JSON.stringify(item.value),
        });
    }
    inventory.push({
      url: page.url,
      title: page.title,
      excerptIds: excerpts.map((source) => source.id),
      headings: seo?.headings || [],
      sampled,
      markup: {
        collected: !!seo,
        ...(seo?.structured || {
          jsonLdBlocks: 0,
          invalidJsonLd: 0,
          jsonLdTypes: [],
          microdataTypes: [],
          rdfaTypes: [],
        }),
      },
    });
  });
  return { catalog, inventory };
}
