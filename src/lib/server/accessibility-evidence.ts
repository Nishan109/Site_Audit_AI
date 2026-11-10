import type { AnyNode, Element } from "domhandler";
import { loadPageHTML } from "./streamed-html";
import {
  ACCESSIBILITY_GUIDANCE,
  type AccessibilityCheck,
  type AccessibilitySnapshot,
} from "../accessibility";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
type Name = { name: string; source: string };
export function extractAccessibilityEvidence(
  html: string,
): AccessibilitySnapshot {
  const { $ } = loadPageHTML(html);
  let sampled = false;
  const bounded = (value: string, max = 500) => {
    if (value.length > max) sampled = true;
    return value.slice(0, max);
  };
  const hiddenSelf = (element: Element) => {
    const node = $(element);
    return (
      node.is(
        "script,style,template,noscript,[hidden],[inert],[aria-hidden='true'],input[type='hidden']",
      ) ||
      /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(
        node.attr("style") || "",
      )
    );
  };
  const included = (element: Element) =>
    !hiddenSelf(element) && !$(element).parents().toArray().some(hiddenSelf);
  const select = (selector: string) =>
    $(selector)
      .toArray()
      .filter((node): node is Element => "tagName" in node && included(node));
  const byId = new Map<string, Element[]>();
  $("[id]").each((_, node) => {
    const id = $(node).attr("id")!;
    if (id) byId.set(id, [...(byId.get(id) || []), node]);
  });
  const labels = $("label").toArray();
  const locator = (element: Element) => {
    const path: string[] = [];
    let current: Element | undefined = element;
    for (let depth = 0; current && depth < 5; depth++) {
      const id = $(current).attr("id");
      if (id) {
        path.unshift(`${current.tagName}[id=${JSON.stringify(id)}]`);
        break;
      }
      const position = $(current).prevAll(current.tagName).length + 1;
      path.unshift(`${current.tagName}:nth-of-type(${position})`);
      const parent: AnyNode | null = current.parent;
      current = parent && "tagName" in parent ? parent : undefined;
    }
    return bounded(path.join(" > "), 240);
  };
  function text(node: AnyNode, allowHidden = false): string {
    if (node.type === "text") return node.data;
    if (!("tagName" in node)) return "";
    if (
      ["script", "style", "template", "noscript"].includes(node.tagName) ||
      (!allowHidden && hiddenSelf(node))
    )
      return "";
    if (node.tagName === "img")
      return $(node).attr("aria-label") || $(node).attr("alt") || "";
    if (node.tagName === "svg" && $(node).attr("aria-label"))
      return $(node).attr("aria-label")!;
    if ($(node).attr("role") === "img" && $(node).attr("aria-label"))
      return $(node).attr("aria-label")!;
    if (["input", "textarea", "select"].includes(node.tagName)) return ""; // Never collect entered/default field values.
    if (node.tagName === "br") return " ";
    return node.children.map((child) => text(child, allowHidden)).join(" ");
  }
  function name(element: Element, seen = new Set<Element>()): Name {
    const node = $(element);
    if (seen.has(element))
      return {
        name: clean(node.attr("aria-label") || text(element, true)),
        source: "referenced content",
      };
    const visited = new Set(seen).add(element);
    const targets = (node.attr("aria-labelledby") || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((id) => byId.get(id)?.slice(0, 1) || []);
    if (targets.length)
      return {
        name: clean(
          targets
            .map((target) => name(target, visited).name || text(target, true))
            .join(" "),
        ),
        source: "aria-labelledby",
      };
    const aria = clean(node.attr("aria-label") || "");
    if (aria) return { name: aria, source: "aria-label" };
    const id = node.attr("id");
    const nativeLabels = labels.filter((label) => {
      const target = $(label).attr("for");
      if (target !== undefined)
        return !!id && target === id && byId.get(id)?.[0] === element;
      return (
        $(label)
          .find(
            "input:not([type='hidden']),select,textarea,button,meter,progress,output",
          )
          .first()
          .get(0) === element
      );
    });
    if (
      nativeLabels.length &&
      node.is("input,select,textarea,button,meter,progress,output")
    ) {
      const label = clean(
        nativeLabels.map((label) => text(label, true)).join(" "),
      );
      if (label) return { name: label, source: "native label" };
    }
    if (element.tagName === "input") {
      const type = (node.attr("type") || "text").toLowerCase();
      if (["submit", "reset", "button"].includes(type)) {
        const value = node.attr("value");
        if (value !== undefined)
          return { name: clean(value), source: "button value" };
        if (type !== "button")
          return {
            name: `Native ${type} label (browser localized)`,
            source: "native browser default",
          };
      }
      if (type === "image" && node.attr("alt"))
        return { name: clean(node.attr("alt")!), source: "image button alt" };
    }
    if (
      element.tagName === "img" &&
      node.attr("alt") !== undefined &&
      (node.attr("alt")!.trim() || node.attr("role") !== "img")
    )
      return { name: clean(node.attr("alt")!), source: "alt attribute" };
    const role = (node.attr("role") || "").split(/\s+/)[0];
    if (
      node.is("a,button,summary,h1,h2,h3,h4,h5,h6,svg,title") ||
      [
        "button",
        "link",
        "heading",
        "checkbox",
        "radio",
        "switch",
        "tab",
        "menuitem",
        "option",
        "treeitem",
      ].includes(role)
    ) {
      const content = clean(text(element, targets.length > 0));
      if (content) return { name: content, source: "element content" };
    }
    const title = clean(node.attr("title") || "");
    return title
      ? { name: title, source: "title attribute fallback" }
      : {
          name: "",
          source: node.attr("placeholder")
            ? "placeholder only; no persistent label detected"
            : "none detected in HTML",
        };
  }
  const checks: AccessibilitySnapshot["checks"] = [];
  const add = (
    key: AccessibilityCheck["key"],
    area: AccessibilityCheck["area"],
    title: string,
    status: AccessibilityCheck["status"],
    detail: string,
    context: string,
    observations: AccessibilityCheck["observations"],
    action?: [string, string][],
    priority?: AccessibilityCheck["priority"],
  ) => {
    if (observations.length > 40) sampled = true;
    checks.push({
      key,
      area,
      title,
      status,
      detail,
      context,
      observations: observations.slice(0, 40).map((row) => ({
        label: bounded(row.label, 180),
        value: bounded(row.value),
      })),
      steps: (action || []).map(([title, description]) => ({
        title,
        description,
      })),
      priority,
      reference: ACCESSIBILITY_GUIDANCE[key],
    });
  };
  const language = $("html").attr("lang");
  const xmlLanguage = $("html").attr("xml:lang");
  add(
    "language",
    "content",
    "Document language",
    language?.trim() ? "observed" : "review",
    language?.trim()
      ? `The document declares lang="${bounded(language)}".`
      : xmlLanguage
        ? "Only xml:lang was collected; confirm the document format and language declaration."
        : "No non-empty HTML lang declaration was collected.",
    "Presence does not establish a valid language tag or a match to the content. Language changes within passages require a separate review.",
    [
      { label: "HTML language", value: language ?? "Not declared" },
      ...(xmlLanguage ? [{ label: "xml:lang", value: xmlLanguage }] : []),
    ],
    !language?.trim()
      ? [
          [
            "Confirm the page language",
            "Identify the primary language and the document's served format.",
          ],
          [
            "Declare and verify the language",
            "Set an appropriate language declaration and verify pronunciation with a screen reader. Mark language changes in passages when needed.",
          ],
        ]
      : undefined,
    !language?.trim() ? "Medium" : undefined,
  );
  const titles = $("head title")
    .toArray()
    .map((node) => clean($(node).text()));
  const titleOK = titles.length === 1 && !!titles[0];
  add(
    "title",
    "content",
    "Page title",
    titleOK ? "observed" : "review",
    titleOK
      ? "One non-empty page title was collected."
      : "A single non-empty page title was not established in the collected HTML.",
    "A title's presence does not establish that it accurately describes this page. Check uniqueness, meaning and browser presentation in context.",
    titles.length
      ? titles.map((value, index) => ({
          label: `Title ${index + 1}`,
          value: value || "Empty title",
        }))
      : [{ label: "Page title", value: "Not collected" }],
    !titleOK
      ? [
          [
            "Identify this page's purpose",
            "Choose concise, specific wording that identifies the actual page and site.",
          ],
          [
            "Verify the document title",
            "Publish one meaningful title and verify it in the browser tab and assistive technology.",
          ],
        ]
      : undefined,
    !titleOK ? "Medium" : undefined,
  );
  const headings = select("h1,h2,h3,h4,h5,h6,[role='heading']");
  let previous = 0,
    skipped = 0,
    empty = 0,
    invalidLevel = 0;
  const headingRows = headings.map((element) => {
    const levelText =
      $(element).attr("aria-level") ??
      (/^h[1-6]$/.test(element.tagName) ? element.tagName.slice(1) : "");
    const level = /^[1-9]\d*$/.test(levelText) ? Number(levelText) : 0;
    if (!level) invalidLevel++;
    if (previous && level > previous + 1) skipped++;
    if (level) previous = level;
    const result = name(element);
    if (!result.name) empty++;
    return {
      label: `${locator(element)} · ${level ? `H${level}` : "level not established"}`,
      value: result.name || "No heading text/name detected",
    };
  });
  const headingReview = skipped + empty + invalidLevel > 0;
  add(
    "headings",
    "navigation",
    "Heading structure",
    !headings.length ? "not-observed" : headingReview ? "review" : "observed",
    `${headings.length} heading declaration(s); ${skipped} upward level skip(s), ${empty} without detected text/name, ${invalidLevel} without an established level.`,
    "These are HTML observations, not automatic WCAG failures. Multiple H1s or a first H2 alone are not treated as failures. CSS, client content and the actual reading outline require browser review.",
    headingRows.length
      ? headingRows
      : [{ label: "Heading declarations", value: "None collected" }],
    headingReview
      ? [
          [
            "Review the affected outline",
            "Use the evidence to check heading names and levels in the browser accessibility tree, including client-rendered content.",
          ],
          [
            "Clarify names and hierarchy in context",
            "Use meaningful headings and appropriate levels for the actual sections. Do not change levels solely to change visual size.",
          ],
        ]
      : undefined,
    headingReview ? "Low" : undefined,
  );
  const images = select("img");
  const needsAlt = images.filter((image) => {
    const node = $(image),
      role = node.attr("role");
    if (
      ["none", "presentation"].includes(role || "") &&
      !node.attr("aria-label") &&
      !node.attr("aria-labelledby") &&
      !node.attr("tabindex")
    )
      return false;
    return (
      !name(image).name && (node.attr("alt") === undefined || role === "img")
    );
  });
  const emptyAlt = images.filter(
    (image) =>
      $(image).attr("alt") !== undefined && !$(image).attr("alt")!.trim(),
  ).length;
  add(
    "images",
    "content",
    "Image alternatives",
    !images.length ? "not-observed" : needsAlt.length ? "review" : "observed",
    `${images.length} img element(s); ${needsAlt.length} without a detected alternative in this HTML review; ${emptyAlt} with empty alt.`,
    "Empty alt can be correct for decorative or redundant images. An ARIA name can supply an alternative. Alternative quality and purpose require human review; image-only link/button names are checked separately. CSS backgrounds and rendered image meaning were not tested.",
    (needsAlt.length ? needsAlt : images)
      .map((image) => ({
        label: locator(image),
        value: `alt: ${$(image).attr("alt") === undefined ? "not declared" : JSON.stringify($(image).attr("alt"))}; name: ${name(image).name || "none detected"}; source: ${name(image).source}`,
      }))
      .concat(
        images.length
          ? []
          : [{ label: "Image elements", value: "No img elements collected" }],
      ),
    needsAlt.length
      ? [
          [
            "Determine each image's purpose",
            "Check whether each flagged image conveys information, performs a function or is decorative. Verify any existing ARIA alternative in the browser.",
          ],
          [
            "Provide a fitting alternative",
            "Use an accurate text alternative for informative images and empty alt for decorative images. Verify the name of any surrounding link or button.",
          ],
        ]
      : undefined,
    needsAlt.length ? "Medium" : undefined,
  );
  const fields = select("input,select,textarea").filter(
    (field) =>
      field.tagName !== "input" ||
      !["submit", "reset", "button", "image", "hidden"].includes(
        ($(field).attr("type") || "text").toLowerCase(),
      ),
  );
  const controls = select(
    "button,summary,input[type='submit'],input[type='reset'],input[type='button'],input[type='image'],[role='button'],[role='checkbox'],[role='radio'],[role='switch'],[role='combobox'],[role='textbox'],[role='slider'],[role='spinbutton'],[role='listbox'],[role='tab'],[role='menuitem']",
  ).filter((element) => !fields.includes(element));
  const links = select("a[href],[role='link']");
  for (const [key, elements, area, title] of [
    ["fields", fields, "forms", "Form field labels"],
    ["controls", controls, "navigation", "Button & control names"],
    ["links", links, "navigation", "Link names"],
  ] as const) {
    const unnamed = elements.filter((element) => !name(element).name);
    const rows = (unnamed.length ? unnamed : elements).map((element) => {
      const result = name(element);
      return {
        label: locator(element),
        value: `Name candidate: ${bounded(result.name) || "none detected"}; source: ${result.source}${$(element).attr("disabled") !== undefined ? "; disabled in HTML" : ""}`,
      };
    });
    add(
      key,
      area,
      title,
      !elements.length
        ? "not-observed"
        : unnamed.length
          ? "review"
          : "observed",
      `${elements.length} element(s) inspected; ${unnamed.length} without a detected ${key === "fields" ? "persistent label" : "name candidate"}.`,
      "This is a bounded HTML name-candidate review, not a complete Accessible Name computation or a screen-reader test. Native labels, ARIA references, image alternatives, native button defaults and title fallbacks are considered. Placeholder-only fields are not treated as persistently labeled. CSS-hidden variants and client changes require browser confirmation.",
      rows.length
        ? rows
        : [
            {
              label: "Inspected elements",
              value: "None collected for this category",
            },
          ],
      unnamed.length
        ? [
            [
              "Inspect the named element in context",
              "Use the element evidence to locate the control in the rendered page and inspect its computed accessible name. Confirm whether it is actually exposed.",
            ],
            [
              "Provide an appropriate persistent name",
              key === "fields"
                ? "Associate a meaningful native label or appropriate ARIA label with the field. Do not rely on a placeholder alone. Test using assistive technology."
                : "Prefer meaningful native content or an appropriate accessible label. For image-only controls, verify that the image alternative conveys the action or destination.",
            ],
          ]
        : undefined,
      unnamed.length ? "High" : undefined,
    );
  }
  const references = select(
    "[aria-labelledby],[aria-describedby],label[for]",
  ).flatMap((element) => {
    const attributes = [
      "aria-labelledby",
      "aria-describedby",
      ...(element.tagName === "label" ? ["for"] : []),
    ];
    return attributes.flatMap((attribute) =>
      ($(element).attr(attribute) || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => ({
          element,
          attribute,
          id,
          targets: byId.get(id)?.length || 0,
        })),
    );
  });
  const broken = references.filter((reference) => reference.targets !== 1);
  const duplicateIds = [...byId.values()].filter(
    (elements) => elements.length > 1,
  ).length;
  add(
    "references",
    "semantics",
    "Label & description references",
    broken.length
      ? "review"
      : references.length || duplicateIds
        ? "observed"
        : "not-observed",
    `${references.length} naming/description or native label reference(s); ${broken.length} unresolved or ambiguous target(s). ${duplicateIds} duplicated ID value(s) observed.`,
    "Unreferenced duplicate IDs alone are not reported as a WCAG 2.2 parsing failure. Missing targets can be inserted by JavaScript; verify the rendered DOM. Dynamic aria-controls and aria-activedescendant targets are not judged by this static naming check.",
    (broken.length ? broken : references)
      .map((item) => ({
        label: `${locator(item.element)} · ${item.attribute}`,
        value: `${bounded(item.id, 100)}: ${item.targets === 0 ? "target not collected" : `${item.targets} matching target(s)`}`,
      }))
      .concat(
        references.length
          ? []
          : [
              {
                label: "Reference inventory",
                value: `${duplicateIds} duplicated ID value(s); no naming/description references collected.`,
              },
            ],
      ),
    broken.length
      ? [
          [
            "Verify the rendered relationship",
            "Inspect each listed ID reference after the relevant interaction. Confirm whether its target exists and is uniquely identified.",
          ],
          [
            "Correct confirmed reference problems",
            "Update confirmed broken or ambiguous label/description relationships and test the resulting name or description with assistive technology.",
          ],
        ]
      : undefined,
    broken.length ? "Medium" : undefined,
  );
  const mains = select("main,[role='main']"),
    navs = select("nav,[role='navigation']");
  add(
    "regions",
    "semantics",
    "Page region declarations",
    mains.length || navs.length ? "observed" : "not-observed",
    `${mains.length} main and ${navs.length} navigation declaration(s) were collected.`,
    "These are declaration counts, not a validated landmark tree. Absence of a main landmark alone is not an automatic failure: headings, skip links and other bypass methods may apply. Check responsive variants and landmark names in a browser.",
    [
      { label: "Main regions", value: String(mains.length) },
      { label: "Navigation regions", value: String(navs.length) },
    ],
  );
  return {
    checks,
    sampled,
    counts: {
      images: images.length,
      fields: fields.length,
      controls: controls.length,
      links: links.length,
      headings: headings.length,
    },
  };
}
