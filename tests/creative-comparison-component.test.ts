import { window as testWindow } from "./component-environment";
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import {
  render,
  cleanup,
  fireEvent,
  waitFor,
  within,
  type RenderResult,
} from "@testing-library/react";

let Comparison: typeof import("../src/components/CreativeComparison").default;
before(async () => {
  Comparison = (await import("../src/components/CreativeComparison")).default;
});
const OriginalImage = testWindow.Image;
beforeEach(() => {
  class DecodedImage {
    naturalWidth = 1080;
    naturalHeight = 1080;
    onload: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  Object.defineProperty(testWindow, "Image", {
    configurable: true,
    writable: true,
    value: DecodedImage,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => {} },
  });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(testWindow, "Image", {
    configurable: true,
    writable: true,
    value: OriginalImage,
  });
});
const fixture = {
  dataSource: "live",
  modelUsed: "test-model",
  winner: "Creative A",
  rationale:
    "Creative A uses a clear headline and a more visible call to action than Creative B.",
  creativeA: {
    score: 84,
    strengths: ["Readable headline"],
    weaknesses: ["Simplify the secondary text"],
  },
  creativeB: {
    score: 65,
    strengths: ["Strong imagery"],
    weaknesses: ["Improve contrast"],
  },
  recommendations: ["Refine the secondary text in the next version."],
};
const mount = () =>
  render(createElement(Comparison, { url: "https://example.com/" }));
const field = (view: RenderResult, label: string) =>
  view.getByLabelText(label) as
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
async function upload(
  view: RenderResult,
  variant: "A" | "B",
  name = `${variant}.png`,
) {
  const file = new testWindow.File([`${variant}-test-image`], name, {
    type: "image/png",
  });
  fireEvent.change(view.getByLabelText(`Choose Creative ${variant} file`), {
    target: { files: [file] },
  });
  await waitFor(() =>
    assert.ok(
      view.getByRole("button", { name: `Remove Creative ${variant} image` }),
    ),
  );
}
async function prepare(view: RenderResult) {
  await upload(view, "A");
  await upload(view, "B");
}
async function compare(view: RenderResult) {
  fireEvent.click(view.getByRole("button", { name: "Compare creatives" }));
  await waitFor(() =>
    assert.ok(view.getByText("Creative A is the stronger starting point.")),
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("comparison is disabled until both images are decoded", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(fixture),
  );
  const view = mount();
  assert.equal(
    (
      view.getByRole("button", {
        name: "Compare creatives",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  await upload(view, "A");
  assert.equal(
    (
      view.getByRole("button", {
        name: "Compare creatives",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  await upload(view, "B");
  assert.equal(
    (
      view.getByRole("button", {
        name: "Compare creatives",
      }) as HTMLButtonElement
    ).disabled,
    false,
  );
  assert.equal(fetch.mock.callCount(), 0);
});
test("review submits the actual two images, copy, audience and focus", async (t) => {
  let body: Record<string, string> = {};
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json(fixture);
    },
  );
  const view = mount();
  await prepare(view);
  fireEvent.change(field(view, "What matters most?"), {
    target: { value: "Visual hierarchy" },
  });
  fireEvent.change(field(view, "Who is this for?Optional"), {
    target: { value: "Hiring managers" },
  });
  fireEvent.change(view.container.querySelector("#comparison-headline-A")!, {
    target: { value: "A stronger message" },
  });
  await compare(view);
  assert.ok(body.imageA.startsWith("data:image/png;base64,"));
  assert.notEqual(body.imageA, body.imageB);
  assert.equal(body.focus, "Visual hierarchy");
  assert.equal(body.audience, "Hiring managers");
  assert.ok(body.textA.includes("A stronger message"));
  assert.equal(
    (view.getByRole("button", { name: "Download review" }) as HTMLButtonElement)
      .disabled,
    false,
  );
});

test("a B preference displays and exports B with its own score and evidence", async (t) => {
  const result = {
    ...fixture,
    winner: "Creative B",
    rationale:
      "Creative B's bolder headline has better contrast against the pale background.",
    creativeA: fixture.creativeB,
    creativeB: fixture.creativeA,
  };
  t.mock.method(globalThis, "fetch", async () => Response.json(result));
  let copied = "";
  t.mock.method(navigator.clipboard, "writeText", async (value: string) => {
    copied = value;
  });
  const view = mount();
  await prepare(view);
  fireEvent.click(view.getByRole("button", { name: "Compare creatives" }));
  await waitFor(() =>
    assert.ok(view.getByText("Creative B is the stronger starting point.")),
  );
  assert.equal(
    view
      .getByRole("meter", { name: "Creative A AI assessment" })
      .getAttribute("aria-valuenow"),
    "65",
  );
  assert.equal(
    view
      .getByRole("meter", { name: "Creative B AI assessment" })
      .getAttribute("aria-valuenow"),
    "84",
  );
  assert.equal(
    view.queryByText("Creative A is the stronger starting point."),
    null,
  );
  fireEvent.click(view.getByRole("button", { name: "Copy review" }));
  await waitFor(() => assert.ok(copied.includes("AI preference: Creative B")));
  assert.ok(copied.includes(result.rationale));
});

test("an identical-input tie displays a neutral verdict and both real score breakdowns", async (t) => {
  const criteria = Object.fromEntries(
    ["message", "hierarchy", "legibility", "action"].map((key) => [
      key,
      {
        score: 84,
        evidence: "The dark headline is readable against the pale background.",
      },
    ]),
  );
  const result = {
    ...fixture,
    winner: "Tie",
    reviewMethod: "independent-rubric-v1",
    identicalInputs: true,
    rationale:
      "The same image and supplied copy were uploaded, so the same assessment applies to both.",
    creativeA: { ...fixture.creativeA, criteria },
    creativeB: { ...fixture.creativeA, criteria },
  };
  t.mock.method(globalThis, "fetch", async () => Response.json(result));
  const view = mount();
  await prepare(view);
  fireEvent.click(view.getByRole("button", { name: "Compare creatives" }));
  await waitFor(() =>
    assert.ok(view.getByText("No clear preference between these creatives.")),
  );
  assert.equal(
    view.queryByText("Creative A is the stronger starting point."),
    null,
  );
  assert.equal(
    view.queryByText("Creative B is the stronger starting point."),
    null,
  );
  assert.equal(view.getAllByText("Score breakdown").length, 2);
  assert.ok(view.getByText(/one assessment applies equally to both/));
});
test("placement and frame changes retain both original images without repeating uploads", async () => {
  const view = mount();
  await prepare(view);
  const a = view.getByAltText("Original Creative A: A.png").getAttribute("src");
  const placement = within(
    view.getByRole("group", { name: "Comparison preview placement" }),
  );
  fireEvent.change(field(view, "Comparison preview frame"), {
    target: { value: "16:9" },
  });
  fireEvent.click(placement.getByRole("button", { name: "Feed" }));
  const preview = view.getByRole("article", {
    name: "Creative A placement preview",
  });
  assert.ok(preview.querySelector('[style*="aspect-ratio: 16/9"]'));
  fireEvent.click(placement.getByRole("button", { name: "Stories" }));
  assert.ok(preview.querySelector('[style*="aspect-ratio: 9/16"]'));
  fireEvent.change(field(view, "Creative A image fit"), {
    target: { value: "cover" },
  });
  fireEvent.change(field(view, "Creative A crop focus"), {
    target: { value: "top" },
  });
  assert.equal(preview.querySelector("img")?.style.objectFit, "cover");
  assert.equal(preview.querySelector("img")?.style.objectPosition, "top");
  assert.equal(
    view.getByAltText("Original Creative A: A.png").getAttribute("src"),
    a,
  );
  assert.ok(view.getByRole("button", { name: "Remove Creative B image" }));
});
test("changing copy makes the previous review stale and disables export", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(fixture));
  const view = mount();
  await prepare(view);
  await compare(view);
  fireEvent.change(view.container.querySelector("#comparison-copy-B")!, {
    target: { value: "New wording" },
  });
  assert.ok(view.getByText("Your creatives have changed."));
  assert.equal(
    view.queryByText("Creative A is the stronger starting point."),
    null,
  );
  assert.equal(
    (view.getByRole("button", { name: "Download review" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});
test("swapping carries images and copy together and invalidates old advice", async (t) => {
  let submitted: Record<string, string> = {};
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      submitted = JSON.parse(String(init?.body));
      return Response.json(fixture);
    },
  );
  const view = mount();
  await prepare(view);
  fireEvent.change(view.container.querySelector("#comparison-headline-A")!, {
    target: { value: "Direction one" },
  });
  await compare(view);
  fireEvent.click(view.getByRole("button", { name: "Swap A & B" }));
  assert.ok(view.getByText("Your creatives have changed."));
  assert.ok(view.getByAltText("Original Creative A: B.png"));
  fireEvent.click(view.getByRole("button", { name: "Update review" }));
  await waitFor(() => assert.ok(submitted.textB.includes("Direction one")));
});
test("editing during a review aborts it and ignores a late response", async (t) => {
  const pending = deferred<Response>();
  let signal: AbortSignal | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal || undefined;
      return pending.promise;
    },
  );
  const view = mount();
  await prepare(view);
  fireEvent.click(view.getByRole("button", { name: "Compare creatives" }));
  fireEvent.change(view.container.querySelector("#comparison-headline-A")!, {
    target: { value: "An updated idea" },
  });
  assert.equal(signal?.aborted, true);
  await act(async () => {
    pending.resolve(Response.json(fixture));
  });
  assert.equal(
    view.queryByText("Creative A is the stronger starting point."),
    null,
  );
});
test("unsupported uploads preserve the existing usable image and show feedback", async () => {
  const view = mount();
  await upload(view, "A");
  const bad = new testWindow.File(["bad-file"], "bad.svg", {
    type: "image/svg+xml",
  });
  fireEvent.change(view.getByLabelText("Choose Creative A file"), {
    target: { files: [bad] },
  });
  assert.ok(view.getByRole("alert").textContent?.includes("PNG, JPG, or WebP"));
  assert.ok(view.getByAltText("Original Creative A: A.png"));
});
test("an incomplete provider response is an error rather than a success result", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ ...fixture, creativeA: { score: 200 } }),
  );
  const view = mount();
  await prepare(view);
  fireEvent.click(view.getByRole("button", { name: "Compare creatives" }));
  await waitFor(() =>
    assert.ok(
      view.getByRole("alert").textContent?.includes("incomplete comparison"),
    ),
  );
  assert.equal(
    view.queryByText("Creative A is the stronger starting point."),
    null,
  );
});
test("a pending copy cannot report success for changed creative inputs", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(fixture));
  const pending = deferred<void>();
  t.mock.method(navigator.clipboard, "writeText", () => pending.promise);
  const view = mount();
  await prepare(view);
  await compare(view);
  fireEvent.click(view.getByRole("button", { name: "Copy review" }));
  fireEvent.change(view.container.querySelector("#comparison-headline-A")!, {
    target: { value: "A different message" },
  });
  await act(async () => {
    pending.resolve();
  });
  assert.equal(view.queryByRole("button", { name: "Copied" }), null);
  assert.ok(view.getByText("Your creatives have changed."));
});
test("review download contains the actual assessment and original filenames", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(fixture));
  let exported: Blob | undefined;
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    exported = blob as Blob;
    return "blob:test-review";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    testWindow.HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      assert.equal(this.download, "example.com-creative-review.txt");
    },
  );
  const view = mount();
  await prepare(view);
  await compare(view);
  fireEvent.click(view.getByRole("button", { name: "Download review" }));
  const text = await exported!.text();
  for (const value of [
    fixture.rationale,
    "A.png",
    "B.png",
    "84/100",
    "not an A/B experiment",
  ])
    assert.ok(text.includes(value));
});
