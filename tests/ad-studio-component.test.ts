import { window as testWindow } from "./component-environment";
import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement, act } from "react";
import {
  render,
  cleanup,
  fireEvent,
  waitFor,
  within,
  type RenderResult,
} from "@testing-library/react";

let Studio: typeof import("../src/components/AdCreativeStudio").default;
before(async () => {
  Studio = (await import("../src/components/AdCreativeStudio")).default;
});
beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => {} },
  });
});
afterEach(() => {
  cleanup();
});

const fixture = {
  dataSource: "live",
  googleAds: [
    {
      headline: "Explore the first direction",
      description: "Read the offering and decide whether it fits your needs.",
      score: 83,
      tag: "First angle",
      reason: "Original wording assessment.",
    },
    {
      headline: "Try another clear direction",
      description: "Compare a second direction for this website.",
      score: 81,
      tag: "Second angle",
      reason: "Second wording assessment.",
    },
  ],
  facebookAds: [
    {
      headline: "A considered next step",
      description: "Explore the website.",
      primaryText:
        "Learn about the actual offering and decide what works for you.",
      score: 82,
      tag: "Explore",
      reason: "Original copy review.",
    },
    {
      headline: "A different point of view",
      description: "Find out more online.",
      primaryText: "Take a closer look at what the website offers.",
      score: 80,
      tag: "Consider",
      reason: "Second copy review.",
    },
  ],
};
const response = () => Response.json(fixture);
function mount() {
  return render(createElement(Studio, { url: "https://example.com/" }));
}
function field(view: RenderResult, name: string) {
  return view.getByLabelText(new RegExp(`^${name}`)) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
}
function mockup(view: RenderResult, name: string) {
  return view.container.querySelector(`[aria-label="${name}"]`)!;
}
function regenerate(view: RenderResult) {
  return Array.from(view.container.querySelectorAll("button")).find(
    (button) =>
      button.textContent?.includes("Regenerate drafts") &&
      !button.closest("form"),
  )!;
}
async function generate(view: RenderResult) {
  fireEvent.submit(view.container.querySelector("form")!);
  await waitFor(() =>
    assert.equal(field(view, "Headline").value, fixture.googleAds[0].headline),
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("the brief submits every control and generation enables editing and export", async (t) => {
  let body: Record<string, string> = {};
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return response();
    },
  );
  const view = mount();
  assert.equal(
    (view.getByRole("button", { name: "Download drafts" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.change(field(view, "Who are you speaking to"), {
    target: { value: "Hiring managers" },
  });
  fireEvent.change(field(view, "Campaign goal"), {
    target: { value: "Qualified enquiries" },
  });
  fireEvent.change(field(view, "Tone of voice"), {
    target: { value: "Confident & direct" },
  });
  fireEvent.change(field(view, "Anything we should keep in mind"), {
    target: { value: "Use the skills already on the page." },
  });
  await generate(view);
  for (const value of [
    "Hiring managers",
    "Qualified enquiries",
    "Confident & direct",
    "skills already on the page",
  ])
    assert.ok(body.customInstructions.includes(value));
  assert.equal(body.url, "https://example.com/");
  assert.equal(
    (view.getByRole("button", { name: "Download drafts" }) as HTMLButtonElement)
      .disabled,
    false,
  );
  assert.equal(view.container.querySelector("details")?.open, false);
  assert.ok(
    mockup(view, "Google Search ad mockup").textContent?.includes(
      fixture.googleAds[0].headline,
    ),
  );
});

test("edits update the mockup, remain attached to their draft, and can be restored", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response());
  const view = mount();
  await generate(view);
  fireEvent.change(field(view, "Headline"), {
    target: { value: "A revised first headline" },
  });
  assert.ok(
    mockup(view, "Google Search ad mockup").textContent?.includes(
      "A revised first headline",
    ),
  );
  assert.ok(view.getByText("Edited by you"));
  assert.equal(view.queryByText(/AI copy score/), null);
  fireEvent.click(view.getByRole("button", { name: /Draft 2$/ }));
  assert.equal(field(view, "Headline").value, fixture.googleAds[1].headline);
  fireEvent.click(view.getByRole("button", { name: /Draft 1$/ }));
  assert.equal(field(view, "Headline").value, "A revised first headline");
  fireEvent.click(view.getByRole("button", { name: "Restore original" }));
  assert.equal(field(view, "Headline").value, fixture.googleAds[0].headline);
  assert.ok(view.getByText(/AI copy score/));
});

test("a failed regeneration preserves existing edited copy", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () =>
    ++requests === 1
      ? response()
      : Response.json(
          { error: "AI models are temporarily busy." },
          { status: 503 },
        ),
  );
  const view = mount();
  await generate(view);
  fireEvent.change(field(view, "Headline"), {
    target: { value: "Keep this edited draft" },
  });
  fireEvent.click(regenerate(view));
  await waitFor(() =>
    assert.ok(
      view.getByRole("alert").textContent?.includes("temporarily busy"),
    ),
  );
  assert.equal(field(view, "Headline").value, "Keep this edited draft");
});

test("cancelled requests cannot overwrite a newer successful generation", async (t) => {
  const late = deferred<Response>();
  let calls = 0;
  let firstSignal: AbortSignal | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        firstSignal = init?.signal || undefined;
        return late.promise;
      }
      return response();
    },
  );
  const view = mount();
  fireEvent.submit(view.container.querySelector("form")!);
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  assert.equal(firstSignal?.aborted, true);
  await generate(view);
  await act(async () => {
    late.resolve(
      Response.json({
        ...fixture,
        googleAds: [
          { ...fixture.googleAds[0], headline: "Stale cancelled text" },
        ],
      }),
    );
  });
  assert.equal(field(view, "Headline").value, fixture.googleAds[0].headline);
});

test("a delayed clipboard operation cannot mark a different draft as copied", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response());
  const copied = deferred<void>();
  t.mock.method(navigator.clipboard, "writeText", () => copied.promise);
  const view = mount();
  await generate(view);
  fireEvent.click(view.getByRole("button", { name: "Copy draft" }));
  fireEvent.click(view.getByRole("button", { name: /Draft 2$/ }));
  await act(async () => {
    copied.resolve();
  });
  assert.ok(view.getByRole("button", { name: "Copy draft" }));
  assert.equal(view.queryByRole("button", { name: "Copied" }), null);
});

test("copy and download handlers use the current edited wording", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response());
  let clipboard = "";
  let exported: Blob | undefined;
  let filename = "";
  t.mock.method(navigator.clipboard, "writeText", async (text: string) => {
    clipboard = text;
  });
  t.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    exported = blob as Blob;
    return "blob:component-test";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(
    testWindow.HTMLAnchorElement.prototype,
    "click",
    function (this: HTMLAnchorElement) {
      filename = this.download;
    },
  );
  const view = mount();
  await generate(view);
  fireEvent.change(field(view, "Headline"), {
    target: { value: "The current edited wording" },
  });
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy draft" }));
  });
  assert.ok(clipboard.includes("The current edited wording"));
  fireEvent.click(view.getByRole("button", { name: "Download drafts" }));
  assert.equal(filename, "example.com-ad-drafts.txt");
  assert.ok((await exported!.text()).includes("The current edited wording"));
});

test("clipboard denial gives an alternative without reporting a successful copy", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response());
  t.mock.method(navigator.clipboard, "writeText", async () => {
    throw new Error("Permission denied");
  });
  const view = mount();
  await generate(view);
  await act(async () => {
    fireEvent.click(view.getByRole("button", { name: "Copy draft" }));
  });
  assert.ok(
    view.getByRole("status").textContent?.includes("Copying isn’t available"),
  );
  assert.equal(view.queryByRole("button", { name: "Copied" }), null);
});

test("Meta edits, placement selection and CTA controls update the preview", async (t) => {
  t.mock.method(globalThis, "fetch", async () => response());
  const view = mount();
  await generate(view);
  fireEvent.click(
    within(view.getByRole("group", { name: "Ad channel" })).getByRole(
      "button",
      { name: /Meta ads/ },
    ),
  );
  fireEvent.change(field(view, "Primary text"), {
    target: { value: "Updated primary text for this draft." },
  });
  fireEvent.change(field(view, "Preview call to action"), {
    target: { value: "Contact us" },
  });
  assert.ok(
    mockup(view, "Meta feed ad mockup").textContent?.includes(
      "Updated primary text for this draft.",
    ),
  );
  assert.ok(
    mockup(view, "Meta feed ad mockup").textContent?.includes("Contact us"),
  );
  fireEvent.click(view.getByRole("button", { name: "Stories" }));
  assert.ok(
    mockup(view, "Meta stories ad mockup").querySelector(
      '[style*="aspect-ratio: 9/16"]',
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Reels" }));
  assert.ok(mockup(view, "Meta reels ad mockup"));
});

test("invalid image files show feedback instead of creating a broken preview", async () => {
  const view = mount();
  fireEvent.click(
    within(view.getByRole("group", { name: "Ad channel" })).getByRole(
      "button",
      { name: /Meta ads/ },
    ),
  );
  const file = new testWindow.File(["not an image"], "unsupported.svg", {
    type: "image/svg+xml",
  });
  fireEvent.change(
    view.getByLabelText("Upload creative image", { exact: true }),
    { target: { files: [file] } },
  );
  assert.ok(view.getByRole("alert").textContent?.includes("PNG, JPG, or WebP"));
  assert.equal(
    view.queryByRole("button", { name: "Remove square creative" }),
    null,
  );
});

test("square artwork is reused transparently in vertical previews with explicit fit controls", async (t) => {
  // Image decoding is a browser-only check. Supply dimensions after the actual
  // FileReader completes so this test focuses on state, placement and fit.
  const OriginalImage = testWindow.Image;
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
  t.after(() =>
    Object.defineProperty(testWindow, "Image", {
      configurable: true,
      writable: true,
      value: OriginalImage,
    }),
  );
  const view = mount();
  fireEvent.click(
    within(view.getByRole("group", { name: "Ad channel" })).getByRole(
      "button",
      { name: /Meta ads/ },
    ),
  );
  const file = new testWindow.File(["test-image-bytes"], "square.png", {
    type: "image/png",
  });
  fireEvent.change(
    view.getByLabelText("Upload creative image", { exact: true }),
    { target: { files: [file] } },
  );
  await waitFor(() =>
    assert.ok(view.getByRole("button", { name: "Remove square creative" })),
  );
  fireEvent.click(view.getByRole("button", { name: "Stories" }));
  assert.ok(view.getByText(/Using your square image in a 9:16 frame/));
  const preview = mockup(view, "Meta stories ad mockup");
  assert.equal(preview.querySelector("img")?.style.objectFit, "contain");
  fireEvent.change(field(view, "Image fit"), { target: { value: "cover" } });
  fireEvent.change(field(view, "Crop focus"), { target: { value: "top" } });
  assert.equal(preview.querySelector("img")?.style.objectFit, "cover");
  assert.equal(preview.querySelector("img")?.style.objectPosition, "top");
  fireEvent.click(view.getByRole("button", { name: "Remove square creative" }));
  assert.equal(preview.querySelector("img"), null);
});
