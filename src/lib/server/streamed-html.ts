import { parse, type Expression } from "acorn";
import { load } from "cheerio";
import type { AnyNode, Element } from "domhandler";

/** Read known React server-stream completion records as data, without running JS. */
export function loadPageHTML(html: string) {
  const $ = load(html);
  let boundaries = 0,
    segments = 0;
  if (!/\$(?:RC|RS)\s*\(/.test(html)) return { $, boundaries, segments };
  const elements = $("*")
    .toArray()
    .filter((node): node is Element =>
      ["tag", "script", "style"].includes(node.type),
    );
  const order = new Map(elements.map((element, index) => [element, index]));
  const ids = new Map<string, Element[]>();
  for (const element of elements) {
    const id = $(element).attr("id");
    if (id) ids.set(id, [...(ids.get(id) || []), element]);
  }
  const attached = (node: AnyNode) => {
    let current = node;
    while (current.parent) current = current.parent;
    return current.type === "root";
  };
  const unique = (id: string) => {
    const matches = ids.get(id);
    return matches?.length === 1 && attached(matches[0]) ? matches[0] : null;
  };
  const instructions: {
    name: "$RC" | "$RS";
    args: string[];
    script: Element;
  }[] = [];
  const add = (expression: Expression, script: Element) => {
    if (instructions.length >= 200) return;
    if (expression.type === "SequenceExpression") {
      expression.expressions.forEach((item) => add(item, script));
      return;
    }
    if (
      expression.type !== "CallExpression" ||
      expression.callee.type !== "Identifier" ||
      !["$RC", "$RS"].includes(expression.callee.name) ||
      expression.arguments.length !== 2
    )
      return;
    const args = expression.arguments.flatMap((argument) =>
      argument.type === "Literal" &&
      typeof argument.value === "string" &&
      argument.value.length <= 160
        ? [argument.value]
        : [],
    );
    if (args.length === 2)
      instructions.push({
        name: expression.callee.name as "$RC" | "$RS",
        args,
        script,
      });
  };
  for (const script of $("script:not([src])").toArray()) {
    if (instructions.length >= 200) break;
    const type = ($(script).attr("type") || "text/javascript")
      .trim()
      .toLowerCase();
    if (!["text/javascript", "application/javascript"].includes(type)) continue;
    const text = $(script).text();
    if (text.length > 100_000 || !/\$(?:RC|RS)\s*\(/.test(text)) continue;
    try {
      const program = parse(text, {
        ecmaVersion: "latest",
        sourceType: "script",
      });
      // Ignore calls inside functions, conditions, strings, comments or data scripts.
      for (const statement of program.body)
        if (statement.type === "ExpressionStatement")
          add(statement.expression, script);
    } catch {
      /* Unknown scripts are not evaluated or used to expose hidden text. */
    }
  }
  for (const instruction of instructions) {
    const [first, second] = instruction.args;
    const boundary = instruction.name === "$RC";
    const targetId = boundary ? first : second,
      sourceId = boundary ? second : first;
    const match = targetId.match(
      boundary ? /^([\w.:-]*)B:([a-z0-9]+)$/i : /^([\w.:-]*)P:([a-z0-9]+)$/i,
    );
    if (!match || sourceId !== `${match[1]}S:${match[2]}`) continue;
    const target = unique(targetId),
      source = unique(sourceId);
    if (
      !target ||
      !source ||
      target.tagName !== "template" ||
      source.tagName !== "div" ||
      $(source).attr("hidden") === undefined ||
      Object.keys(source.attribs).some((key) => !["id", "hidden"].includes(key))
    )
      continue;
    if (
      (order.get(target) ?? Infinity) >=
        (order.get(instruction.script) ?? -1) ||
      (order.get(source) ?? Infinity) >= (order.get(instruction.script) ?? -1)
    )
      continue;
    if ($(target).parents().toArray().includes(source)) continue;
    if (!boundary) {
      $(target).before($(source).contents());
      $(target).remove();
      $(source).remove();
      segments++;
      continue;
    }
    const start = target.prev;
    if (start?.type !== "comment" || !["$?", "$~"].includes(start.data))
      continue;
    const fallback: AnyNode[] = [];
    let current: AnyNode | null = target,
      depth = 0,
      end: AnyNode | null = null;
    while (current) {
      if (current.type === "comment") {
        if (["/$", "/&"].includes(current.data)) {
          if (depth === 0) {
            end = current;
            break;
          }
          depth--;
        } else if (["$", "$?", "$~", "$!", "&"].includes(current.data)) depth++;
      }
      fallback.push(current);
      current = current.next;
    }
    if (!end || fallback.includes(source)) continue;
    $(target).before($(source).contents());
    for (const node of fallback) $(node).remove();
    $(source).remove();
    start.data = "$";
    boundaries++;
  }
  return { $, boundaries, segments };
}
