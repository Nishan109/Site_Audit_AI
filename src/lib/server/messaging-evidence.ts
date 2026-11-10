import { loadPageHTML } from "./streamed-html";
import type { CopySource } from "../messaging";
import type { PageEvidence } from "./evidence";

export interface CopyBlock {
  text: string;
  kind: string;
  region: "main" | "body" | "navigation" | "footer" | "aside";
  heading: string;
  truncated: boolean;
  destination?: string;
  renderingNote?: string;
}
export interface MessagingCopy {
  blocks: CopyBlock[];
  truncated: boolean;
}
interface TextNode {
  type: string;
  data?: string;
  name?: string;
  children?: TextNode[];
}
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const textOf = (node: TextNode): string =>
  node.type === "text"
    ? node.data || ""
    : node.name === "br" || node.name === "hr"
      ? " "
      : (node.children || []).map(textOf).join("");
const copySelector =
  "h1,h2,h3,h4,h5,h6,[role='heading'],p,li,a,button,label,blockquote,dt,dd,input[type='submit'],input[type='button']";
const blockSelector =
  "address,article,aside,blockquote,body,div,dl,dt,dd,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,td,th,tr,ul,[role='heading']";

export function extractMessagingCopy(html: string): MessagingCopy {
  const { $ } = loadPageHTML(html);
  $(
    "script,style,noscript,template,svg,[hidden],[inert],[aria-hidden='true']",
  ).remove();
  $("[style]").each((_, element) => {
    if (
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(
        $(element).attr("style") || "",
      )
    )
      $(element).remove();
  });
  const blocks: CopyBlock[] = [];
  const seen = new Set<string>();
  const grouped = new Set<unknown>();
  const headings: Record<CopyBlock["region"], string> = {
    main: "",
    body: "",
    navigation: "",
    footer: "",
    aside: "",
  };
  const regionOf = (element: Parameters<typeof $>[0]): CopyBlock["region"] => {
    const node = $(element);
    return node.closest("nav,[role='navigation']").length
      ? "navigation"
      : node.closest("footer,[role='contentinfo']").length
        ? "footer"
        : node.closest("aside,[role='complementary']").length
          ? "aside"
          : node.closest("main,[role='main'],article").length
            ? "main"
            : "body";
  };
  const add = (
    element: Parameters<typeof $>[0],
    text: string,
    kind: string,
  ) => {
    const region = regionOf(element);
    const node = $(element);
    text = clean(text);
    if (text.length < 2) return;
    const key = `${region}|${kind}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push({
      text: text.slice(0, 1200),
      kind,
      region,
      heading: headings[region],
      truncated: text.length > 1200,
      renderingNote: node
        .find("[class]")
        .addBack()
        .toArray()
        .some((element) =>
          /(?:^|\s)(?:sm|md|lg|xl|2xl):(?:hidden|block|inline|flex)/.test(
            $(element).attr("class") || "",
          ),
        )
        ? "Contains responsive display classes. Alternative text variants may be combined in this HTML extraction; do not infer a visible duplication or spacing defect."
        : undefined,
      destination: node.is("a")
        ? node.attr("href")?.slice(0, 1000)
        : node.is("button,input")
          ? (
              node.attr("formaction") || node.closest("form").attr("action")
            )?.slice(0, 1000)
          : undefined,
    });
  };
  $("body")
    .find("*")
    .addBack()
    .each((_, element) => {
      if (element.type !== "tag") return;
      const node = $(element);
      if (node.is(copySelector)) {
        const text = clean(textOf(element) || node.attr("value") || "");
        const isHeading =
          /^h[1-6]$/.test(element.tagName) || node.attr("role") === "heading";
        if (isHeading) headings[regionOf(element)] = text;
        const kind = isHeading
          ? "heading"
          : node.is("a")
            ? "link"
            : node.is("button,input")
              ? "button"
              : node.is("li")
                ? "list item"
                : "body copy";
        // Prefer the smallest meaningful block over a whole nested list.
        if (!node.is("li,blockquote") || !node.find("p,li").length)
          add(element, text, kind);
      } else if (
        !node.parents(copySelector).length &&
        !node
          .parents()
          .toArray()
          .some((parent) => grouped.has(parent))
      ) {
        // Preserve inline values with their sentence. Collecting direct text
        // alone can turn "donation in <span>US</span> is <span>$13</span>"
        // into an artificial "donation in is" copy defect.
        if (!node.find(blockSelector).length) {
          add(element, textOf(element), "body copy");
          grouped.add(element);
        } else {
          let run: string[] = [];
          const flush = () => {
            add(element, run.join(""), "body copy");
            run = [];
          };
          for (const child of node.contents().toArray()) {
            if (child.type === "text") run.push(textOf(child));
            else if (
              child.type === "tag" &&
              !$(child).is(blockSelector) &&
              !$(child).find(blockSelector).length
            ) {
              run.push(textOf(child));
              grouped.add(child);
            } else flush();
          }
          flush();
        }
      }
    });
  // Main copy must not disappear behind a large navigation menu or footer.
  const order = { main: 0, body: 1, navigation: 2, aside: 3, footer: 4 };
  const controlLabels = new Set(
    blocks
      .filter((block) => block.kind === "link" || block.kind === "button")
      .map((block) => `${block.region}|${block.text}`),
  );
  const prioritized = blocks
    .filter(
      (block) =>
        block.kind !== "body copy" ||
        !controlLabels.has(`${block.region}|${block.text}`),
    )
    .sort((a, b) => order[a.region] - order[b.region]);
  let characters = 0;
  const retained = prioritized.filter((block, index) => {
    if (index >= 160 || characters + block.text.length > 20_000) return false;
    characters += block.text.length;
    return true;
  });
  return {
    blocks: retained,
    truncated:
      retained.length < prioritized.length ||
      retained.some((block) => block.truncated),
  };
}

export function messagingCatalog(pages: PageEvidence[]) {
  return pages.flatMap((page, pageIndex) =>
    (page.messagingCopy?.blocks || []).map((block, index) => ({
      id: `M${pageIndex + 1}-C${index + 1}`,
      pageUrl: page.url,
      quote: block.text,
      kind: block.kind,
      region: block.region,
      heading: block.heading,
      truncated: block.truncated,
      destination: block.destination,
      renderingNote: block.renderingNote,
    })),
  );
}
export type MessagingSource = CopySource & {
  heading: string;
  truncated: boolean;
};
