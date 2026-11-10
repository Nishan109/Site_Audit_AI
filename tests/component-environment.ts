import { JSDOM } from "jsdom";
import { createRequire } from "node:module";

process.env.DEBUG_PRINT_LIMIT = "1200";

// Node-only component tests. No real browser, page scripts, network resources,
// system clipboard, file chooser or OS downloads are controlled by this setup.
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:3000/",
  pretendToBeVisual: true,
});
const window = dom.window;
for (const [name, value] of Object.entries({
  window,
  document: window.document,
  navigator: window.navigator,
  self: window,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  HTMLAnchorElement: window.HTMLAnchorElement,
  HTMLDialogElement: window.HTMLDialogElement,
  File: window.File,
  FileReader: window.FileReader,
  Event: window.Event,
  MouseEvent: window.MouseEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
}))
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });

// CSS geometry is checked separately in browser testing. Keep stable class
// names here so the actual client component can be tested with node:test.
const localRequire = createRequire(__filename);
localRequire.extensions[".css"] = (module) => {
  module.exports = new Proxy(
    {},
    { get: (_target, name) => (name === "__esModule" ? false : String(name)) },
  );
};

Object.defineProperty(window.HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  writable: true,
  value: function (this: HTMLDialogElement) {
    this.open = true;
  },
});
Object.defineProperty(window.HTMLDialogElement.prototype, "close", {
  configurable: true,
  writable: true,
  value: function (this: HTMLDialogElement) {
    this.open = false;
  },
});
export { window };
