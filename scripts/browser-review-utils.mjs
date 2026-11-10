export function workspaceTextContrast() {
  const root = [...document.querySelectorAll("[data-review-workspace]")].find(
    (element) => element.getClientRects().length,
  );
  const rgba = (value) => {
    const numbers = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
    return [...numbers.slice(0, 3), numbers[3] ?? 1];
  };
  const blend = (front, back) =>
    front
      .slice(0, 3)
      .map((value, index) => value * front[3] + back[index] * (1 - front[3]));
  const luminance = (color) =>
    color
      .slice(0, 3)
      .map((value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
    failures = [];
  let node,
    min = 21;
  while ((node = walker.nextNode())) {
    const element = node.parentElement;
    if (
      !node.textContent.trim() ||
      !element?.getClientRects().length ||
      element.closest("svg")
    )
      continue;
    const layers = [];
    for (let parent = element; parent; parent = parent.parentElement) {
      const layer = rgba(getComputedStyle(parent).backgroundColor);
      layers.push(layer);
      if (layer[3] === 1) break;
    }
    let background = [255, 255, 255];
    for (const layer of layers.reverse()) background = blend(layer, background);
    const foreground = blend(rgba(getComputedStyle(element).color), background),
      a = luminance(foreground),
      b = luminance(background),
      ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    min = Math.min(min, ratio);
    if (ratio < 4.5)
      failures.push({
        text: node.textContent.trim().slice(0, 70),
        ratio: Number(ratio.toFixed(2)),
      });
  }
  return { minimum: Number(min.toFixed(2)), failures };
}
