import { load } from "cheerio";
import { loadPageHTML } from "./streamed-html";
import type { UXCounts, UXSource } from "../ux";
import type { PageEvidence } from "./evidence";

type Source = Omit<UXSource, "id" | "pageUrl">;
export interface UXSnapshot {
  sources: Source[];
  counts: UXCounts;
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
    : node.name === "br"
      ? " "
      : (node.children || []).map(textOf).join("");

export function extractUXEvidence(html: string, pageUrl: string): UXSnapshot {
  const { $: original } = loadPageHTML(html);
  const $ = load(original.html());
  $(
    "script,style,noscript,template,[hidden],[inert],[aria-hidden='true'],input[type='hidden']",
  ).remove();
  $("[style]").each((_, element) => {
    if (
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(
        $(element).attr("style") || "",
      )
    )
      $(element).remove();
  });
  const originalById = new Map(
    original("[id]")
      .toArray()
      .map((node) => [original(node).attr("id")!, node]),
  );
  const region = (element: Parameters<typeof $>[0]) => {
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
  const htmlName = (element: Parameters<typeof $>[0]) => {
    const node = $(element);
    const labelled = clean(
      (node.attr("aria-labelledby") || "")
        .split(/\s+/)
        .flatMap((id) => {
          const target = originalById.get(id);
          return target ? [textOf(target)] : [];
        })
        .join(" "),
    );
    if (labelled)
      return { name: labelled.slice(0, 400), nameFrom: "aria-labelledby" };
    const aria = clean(node.attr("aria-label") || "");
    if (aria) return { name: aria.slice(0, 400), nameFrom: "aria-label" };
    const id = node.attr("id");
    const labels = clean(
      original("label")
        .toArray()
        .filter((label) => !!id && original(label).attr("for") === id)
        .map(textOf)
        .join(" ") || node.closest("label").toArray().map(textOf).join(" "),
    );
    if (labels)
      return { name: labels.slice(0, 400), nameFrom: "label element" };
    if (node.is("a,button,[role='button'],summary")) {
      const content = clean(
        node.toArray().map(textOf).join(" ") ||
          node
            .find("img[alt]")
            .toArray()
            .map((image) => $(image).attr("alt") || "")
            .join(" "),
      );
      if (content)
        return { name: content.slice(0, 400), nameFrom: "element content" };
    }
    if (
      node.is("input[type='submit'],input[type='button'],input[type='reset']")
    ) {
      const value = node.attr("value");
      if (value) return { name: value.slice(0, 400), nameFrom: "button value" };
      if (node.attr("type") === "submit")
        return {
          name: "Browser default submit label",
          nameFrom: "native default",
        };
      if (node.attr("type") === "reset")
        return {
          name: "Browser default reset label",
          nameFrom: "native default",
        };
    }
    if (node.is("input[type='image']") && node.attr("alt"))
      return { name: node.attr("alt")!.slice(0, 400), nameFrom: "image alt" };
    if (node.attr("title"))
      return {
        name: node.attr("title")!.slice(0, 400),
        nameFrom: "title attribute",
      };
    if (node.attr("placeholder"))
      return {
        name: node.attr("placeholder")!.slice(0, 400),
        nameFrom: "placeholder fallback",
      };
    return { name: "", nameFrom: "none detected in HTML" };
  };
  const disabled = (element: Parameters<typeof $>[0]) => {
    const node = $(element);
    if (node.attr("disabled") !== undefined) return true;
    return node
      .parents("fieldset[disabled]")
      .toArray()
      .some(
        (fieldset) =>
          !$(fieldset)
            .children("legend")
            .first()
            .find("*")
            .addBack()
            .toArray()
            .some((item) => item === element),
      );
  };
  const headings = $("h1,h2,h3,h4,h5,h6,[role='heading']").toArray();
  const navigation = $("nav,[role='navigation']").toArray();
  const links = $("a[href]").toArray();
  const buttons = $(
    "button,[role='button'],input[type='submit'],input[type='button'],input[type='reset'],input[type='image'],summary",
  ).toArray();
  const forms = $("form").toArray();
  const fields = $(
    "input:not([type='submit']):not([type='button']):not([type='reset']):not([type='image']),select,textarea",
  ).toArray();
  const counts = {
    navigation: navigation.length,
    headings: headings.length,
    links: links.length,
    buttons: buttons.length,
    forms: forms.length,
    fields: fields.length,
  };
  const sources: Source[] = [];
  let clipped = false;
  const add = (
    kind: Source["kind"],
    location: string,
    data: Record<string, unknown>,
  ) => {
    let shortened = false;
    const bounded = (value: unknown): unknown => {
      if (typeof value === "string") {
        if (value.length > 500) shortened = true;
        return value.slice(0, 500);
      }
      if (Array.isArray(value)) {
        if (value.length > 20) shortened = true;
        return value.slice(0, 20).map(bounded);
      }
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, bounded(entry)]),
        );
      return value;
    };
    const sampled = bounded(data) as Record<string, unknown>;
    if (shortened) {
      sampled.observationTruncated = true;
      clipped = true;
    }
    sources.push({ kind, location, observation: JSON.stringify(sampled) });
  };
  const owner = (element: Parameters<typeof $>[0]) => {
    const node = $(element),
      explicit = node.attr("form");
    return explicit
      ? forms.find((form) => $(form).attr("id") === explicit)
      : (node.closest("form").get(0) as (typeof forms)[number] | undefined);
  };
  const fieldData = (element: (typeof fields)[number]) => {
    const node = $(element),
      form = owner(element);
    const describedBy = (node.attr("aria-describedby") || "")
      .split(/\s+/)
      .flatMap((id) => {
        const target = originalById.get(id);
        return target ? [clean(textOf(target)).slice(0, 300)] : [];
      });
    return {
      tag: element.tagName,
      type:
        node.attr("type") ||
        (element.tagName === "input" ? "text" : element.tagName),
      id: node.attr("id") || "",
      fieldName: node.attr("name") || "",
      ...htmlName(element),
      required:
        node.attr("required") !== undefined ||
        node.attr("aria-required") === "true",
      disabled: disabled(element),
      readOnly: node.attr("readonly") !== undefined,
      placeholder: node.attr("placeholder")?.slice(0, 250) || "",
      autocomplete: node.attr("autocomplete") || "",
      group: clean(
        node.closest("fieldset").children("legend").first().text(),
      ).slice(0, 300),
      help: describedBy,
      form: form
        ? `form-${forms.indexOf(form) + 1}`
        : "no associated form in collected HTML",
    };
  };
  add("page", "Page structure", {
    scope: "Initial HTML only; CSS and JavaScript were not executed.",
    counts,
    mainLandmarks: $("main,[role='main']").length,
    pageTitle: clean($("title").first().text()).slice(0, 300),
  });
  navigation.forEach((element, i) =>
    add("navigation", `Navigation ${i + 1}`, {
      ...htmlName(element),
      linkCount: $(element).find("a[href]").length,
      labels: $(element)
        .find("a[href]")
        .toArray()
        .slice(0, 20)
        .map((link) => htmlName(link).name),
    }),
  );
  forms.forEach((form, i) => {
    const owned = fields.filter((field) => owner(field) === form);
    const data = owned.map(fieldData);
    const questions = new Map<string, boolean>();
    owned.forEach((field, index) => {
      const item = data[index];
      if (item.disabled || item.readOnly) return;
      const key =
        item.type === "radio" && item.fieldName
          ? `radio:${item.fieldName}`
          : `field:${index}`;
      questions.set(key, !!questions.get(key) || item.required);
    });
    add("form", `Form ${i + 1}`, {
      form: `form-${i + 1}`,
      ...htmlName(form),
      action: $(form).attr("action") || "current page or script-controlled",
      method: $(form).attr("method") || "get",
      fields: owned.length,
      editableQuestions: questions.size,
      requiredQuestions: [...questions.values()].filter(Boolean).length,
      fieldLabels: data.slice(0, 15).map((field) => ({
        name: field.name.slice(0, 160),
        nameFrom: field.nameFrom,
        type: field.type,
        required: field.required,
        disabled: field.disabled,
        readOnly: field.readOnly,
      })),
      submitControls: buttons
        .filter(
          (button) =>
            owner(button) === form &&
            (button.tagName === "button"
              ? !$(button).attr("type") || $(button).attr("type") === "submit"
              : $(button).is("input[type='submit'],input[type='image']")),
        )
        .slice(0, 5)
        .map(htmlName),
    });
  });
  fields.forEach((element, i) =>
    add("field", `${region(element)} · field ${i + 1}`, fieldData(element)),
  );
  headings.forEach((element, i) =>
    add("heading", `${region(element)} · heading ${i + 1}`, {
      level:
        element.tagName === "h1"
          ? 1
          : Number(element.tagName.slice(1)) ||
            $(element).attr("aria-level") ||
            "unspecified",
      text: clean(textOf(element)).slice(0, 500),
    }),
  );
  buttons.forEach((element, i) =>
    add("button", `${region(element)} · control ${i + 1}`, {
      tag: element.tagName,
      ...htmlName(element),
      type:
        $(element).attr("type") ||
        (element.tagName === "button"
          ? "submit (native default)"
          : element.tagName),
      disabled: disabled(element),
      ariaDisabled: $(element).attr("aria-disabled") || "",
      destination:
        $(element).attr("formaction") ||
        (owner(element)
          ? $(owner(element)!).attr("action") ||
            "current page or script-controlled"
          : "not established by initial HTML"),
      form: owner(element)
        ? `form-${forms.indexOf(owner(element)!) + 1}`
        : "no associated form",
      expanded: $(element).attr("aria-expanded") || "",
      controls: $(element).attr("aria-controls") || "",
    }),
  );
  links.forEach((element, i) => {
    const href = $(element).attr("href") || "";
    let destination = href,
      destinationKind = "not a fetched destination";
    try {
      const target = new URL(href, pageUrl);
      destination = target.href;
      destinationKind =
        target.origin === new URL(pageUrl).origin
          ? "same origin; destination not tested"
          : "external; destination not tested";
    } catch {
      /* Retain the literal attribute without treating it as broken. */
    }
    const anchor = href.startsWith("#") && href.length > 1 ? href.slice(1) : "";
    let anchorId = anchor;
    try {
      anchorId = decodeURIComponent(anchor);
    } catch {
      /* A malformed escape is not a browser interaction test. */
    }
    add("link", `${region(element)} · link ${i + 1}`, {
      ...htmlName(element),
      href: href.slice(0, 800),
      destination: destination.slice(0, 800),
      destinationKind,
      targetInInitialHTML: anchor
        ? originalById.has(anchorId) ||
          original("a[name]")
            .toArray()
            .some((target) => original(target).attr("name") === anchorId)
        : "not an on-page fragment",
      context: clean(
        $(element)
          .closest("p,li,section,article")
          .find("h1,h2,h3")
          .first()
          .text(),
      ).slice(0, 300),
    });
  });
  const priority = {
    page: 0,
    form: 2,
    field: 3,
    navigation: 1,
    heading: 4,
    button: 5,
    link: 6,
  };
  let characters = 0;
  const selected: Source[] = [];
  for (const source of sources.sort(
    (a, b) => priority[a.kind] - priority[b.kind],
  )) {
    if (
      selected.length >= 140 ||
      characters + source.observation.length > 32_000
    )
      continue;
    characters += source.observation.length;
    selected.push(source);
  }
  return {
    counts,
    sources: selected,
    truncated: clipped || selected.length < sources.length,
  };
}

export function uxCatalog(pages: PageEvidence[]): UXSource[] {
  return pages.flatMap((page, pageIndex) =>
    (page.uxSnapshot?.sources || []).map((source, index) => ({
      ...source,
      id: `U${pageIndex + 1}-E${index + 1}`,
      pageUrl: page.url,
    })),
  );
}
