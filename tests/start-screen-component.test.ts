import "./component-environment";
import { afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { REPORT_NAV, type ReportSection } from "../src/components/navigation";

let Hero: typeof import("../src/components/HeroSection").default;
let Shell: typeof import("../src/components/AppShell").default;
let Loading: typeof import("../src/components/LoadingState").default;
before(async () => {
  Hero = (await import("../src/components/HeroSection")).default;
  Shell = (await import("../src/components/AppShell")).default;
  Loading = (await import("../src/components/LoadingState")).default;
});
afterEach(cleanup);

test("the form is labeled and the local sample opens without submitting a live review", (t) => {
  const submitted: string[] = [];
  const network = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("The sample must stay local");
  });
  const view = render(
    createElement(Hero, {
      isLoading: false,
      onSubmit: (url) => submitted.push(url),
    }),
  );
  const field = view.getByRole("textbox", {
    name: "Your website address",
  }) as HTMLInputElement;
  const form = view.getByRole("form", { name: "Start a website review" });
  const submit = within(form).getByRole("button", {
    name: "Review my website",
  }) as HTMLButtonElement;
  assert.equal(submit.disabled, true);
  assert.equal(field.getAttribute("aria-describedby"), "url-helper");
  const trigger = view.getByRole("button", {
    name: "Explore an example report",
  });
  fireEvent.click(trigger);
  const dialog = view.getByRole("dialog", {
    name: "Explore the example report",
  });
  assert.ok(within(dialog).getByText("Illustrative example"));
  assert.ok(
    within(dialog).getByText(
      "Fictional content to demonstrate the report. No live audit.",
    ),
  );
  assert.ok(within(dialog).getByText("“Learn more”"));
  assert.deepEqual(submitted, []);
  assert.equal(network.mock.callCount(), 0);
  assert.equal(field.value, "");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Close example report" }),
  );
  fireEvent(dialog, new Event("close"));
  assert.equal(view.queryByRole("dialog"), null);
  assert.equal(document.activeElement, trigger);
});

test("sample report tabs support arrow, Home and End keys and expose the matching panel", () => {
  const view = render(
    createElement(Hero, { isLoading: false, onSubmit: () => {} }),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Explore an example report" }),
  );
  const sample = within(view.getByRole("dialog"));
  const messaging = sample.getByRole("tab", { name: "Messaging & copy" });
  assert.equal(messaging.getAttribute("aria-selected"), "true");
  fireEvent.keyDown(messaging, { key: "ArrowRight" });
  const quick = sample.getByRole("tab", { name: "Quick wins" });
  assert.equal(document.activeElement, quick);
  assert.ok(
    within(sample.getByRole("tabpanel", { name: "Quick wins" })).getByText(
      "Check the experience",
    ),
  );
  fireEvent.keyDown(quick, { key: "Home" });
  const overview = sample.getByRole("tab", { name: "Overview" });
  assert.equal(document.activeElement, overview);
  fireEvent.click(sample.getByRole("button", { name: "Explore the finding" }));
  assert.ok(sample.getByRole("tabpanel", { name: "Messaging & copy" }));
  fireEvent.keyDown(messaging, { key: "End" });
  assert.equal(quick.getAttribute("aria-selected"), "true");
  fireEvent.keyDown(quick, { key: "ArrowRight" });
  assert.equal(overview.getAttribute("aria-selected"), "true");
});

test("valid domain and page addresses submit once with surrounding whitespace removed", () => {
  const submitted: string[] = [];
  const view = render(
    createElement(Hero, {
      isLoading: false,
      onSubmit: (url) => submitted.push(url),
    }),
  );
  const field = view.getByRole("textbox", { name: "Your website address" });
  for (const url of [
    "example.com",
    "  https://example.com/products?item=1  ",
  ]) {
    fireEvent.change(field, { target: { value: url } });
    fireEvent.submit(field.closest("form")!);
  }
  assert.deepEqual(submitted, [
    "example.com",
    "https://example.com/products?item=1",
  ]);
  assert.equal(view.queryByRole("alert"), null);
});

test("invalid or non-web addresses stay local and focus an associated error", () => {
  const submitted: string[] = [];
  const view = render(
    createElement(Hero, {
      isLoading: false,
      onSubmit: (url) => submitted.push(url),
    }),
  );
  const field = view.getByRole("textbox", { name: "Your website address" });
  for (const value of [
    "not a website",
    "ftp://example.com",
    "https://user:password@example.com",
    "javascript:alert(1)",
    "https://",
  ]) {
    fireEvent.change(field, { target: { value } });
    fireEvent.submit(field.closest("form")!);
    assert.ok(view.getByRole("alert"));
    assert.equal(field.getAttribute("aria-invalid"), "true");
    assert.match(field.getAttribute("aria-describedby")!, /url-error/);
    assert.equal(document.activeElement, field);
  }
  assert.deepEqual(submitted, []);
  fireEvent.change(field, { target: { value: "example.com" } });
  assert.equal(view.queryByRole("alert"), null);
  assert.equal(field.getAttribute("aria-invalid"), "false");
});

test("the form cannot submit duplicate requests while a review is running", () => {
  let calls = 0;
  const view = render(
    createElement(Hero, {
      isLoading: true,
      initialUrl: "example.com",
      onSubmit: () => calls++,
    }),
  );
  const field = view.getByRole("textbox", {
    name: "Your website address",
  }) as HTMLInputElement;
  assert.equal(field.disabled, true);
  assert.equal(
    (view.getByRole("button", { name: "Reviewing…" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.submit(field.closest("form")!);
  assert.equal(calls, 0);
});

test("landing navigation and the final action focus the existing review field", () => {
  const view = render(
    createElement(
      Shell,
      {
        hasResult: false,
        isLoading: false,
        section: "overview",
        onSectionChange: () => {},
        onNewAudit: () => {},
      },
      createElement(Hero, { isLoading: false, onSubmit: () => {} }),
    ),
  );
  assert.equal(
    view.queryByRole("navigation", { name: "Report navigation" }),
    null,
  );
  assert.equal(view.queryByRole("button", { name: "Open navigation" }), null);
  const nav = within(
    view.getByRole("navigation", { name: "Landing page navigation" }),
  );
  for (const [name, target] of [
    ["What you get", "what-you-get"],
    ["How it works", "how-it-works"],
    ["FAQ", "faq"],
  ]) {
    assert.equal(
      nav.getByRole("link", { name }).getAttribute("href"),
      `#${target}`,
    );
    assert.ok(view.container.querySelector(`#${target}`));
  }
  const field = view.getByRole("textbox", {
    name: "Your website address",
  }) as HTMLInputElement;
  let scrolls = 0;
  field.scrollIntoView = () => {
    scrolls++;
  };
  fireEvent.click(
    within(view.getByRole("banner")).getByRole("button", {
      name: "Review my website",
    }),
  );
  assert.equal(document.activeElement, field);
  const final = view.getByRole("region", {
    name: "Your next improvement starts with a URL.",
  });
  fireEvent.click(
    within(final).getByRole("button", { name: "Review my website" }),
  );
  assert.equal(document.activeElement, field);
  assert.equal(scrolls, 2);
});

test("a running review retains the help dialog without exposing landing actions", () => {
  const view = render(
    createElement(
      Shell,
      {
        hasResult: false,
        isLoading: true,
        section: "overview",
        onSectionChange: () => {},
        onNewAudit: () => {},
      },
      createElement(Loading, {
        url: "example.com",
        progress: {
          startedAt: performance.now(),
          serverElapsedMs: 0,
          stages: {},
        },
        onCancel: () => {},
      }),
    ),
  );
  assert.equal(view.queryByRole("navigation"), null);
  fireEvent.click(view.getByRole("button", { name: "How it works" }));
  const help = view.getByRole("dialog", { name: "How to review a website" });
  assert.ok(within(help).getByRole("heading", { name: "Read your report" }));
  fireEvent.click(within(help).getByRole("button", { name: "Got it" }));
  assert.equal(view.queryByRole("dialog"), null);
});

test("report groups retain every section and open the group containing the active review", (t) => {
  t.mock.method(window, "scrollTo", () => {});
  const selected: ReportSection[] = [];
  let reset = 0;
  const props = {
    hasResult: true,
    isLoading: false,
    section: "overview" as ReportSection,
    onSectionChange: (section: ReportSection) => selected.push(section),
    onNewAudit: () => reset++,
    domain: "example.com",
    children: createElement("p", null, "Report content"),
  };
  const view = render(createElement(Shell, props));
  const sidebar = view.getByRole("complementary");
  const groups = sidebar.querySelectorAll("details");
  assert.equal(groups.length, 2);
  assert.equal(groups[0].open, false);
  assert.equal(groups[1].open, false);
  for (const item of REPORT_NAV)
    assert.ok(
      within(sidebar).getByRole("button", { name: item.label, hidden: true }),
    );
  fireEvent.click(within(sidebar).getByRole("button", { name: "Quick wins" }));
  assert.deepEqual(selected, ["quickwins"]);
  view.rerender(createElement(Shell, { ...props, section: "security" }));
  assert.equal(groups[0].open, true);
  assert.equal(
    within(sidebar)
      .getByRole("button", { name: "Security checks" })
      .getAttribute("aria-current"),
    "page",
  );
  view.rerender(createElement(Shell, { ...props, section: "adgenerator" }));
  assert.equal(groups[1].open, true);
  fireEvent.click(within(sidebar).getByRole("button", { name: "New review" }));
  assert.equal(reset, 1);
});

test("the mobile navigation opens and closes after choosing a report section", (t) => {
  t.mock.method(window, "scrollTo", () => {});
  const selected: ReportSection[] = [];
  const view = render(
    createElement(
      Shell,
      {
        hasResult: true,
        isLoading: false,
        section: "overview",
        onSectionChange: (value) => selected.push(value),
        onNewAudit: () => {},
      },
      "Report",
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Open navigation" }));
  const drawer = view.getByRole("dialog", { name: "Report navigation" });
  fireEvent.click(
    within(drawer).getByRole("button", { name: "Messaging & copy" }),
  );
  assert.deepEqual(selected, ["messaging"]);
  assert.equal(view.queryByRole("dialog", { name: "Report navigation" }), null);
});

test("the loading state describes a running review and lets the user cancel", () => {
  let cancelled = false;
  const view = render(
    createElement(Loading, {
      url: "https://example.com/page",
      progress: {
        startedAt: performance.now(),
        serverElapsedMs: 0,
        stages: {},
      },
      onCancel: () => {
        cancelled = true;
      },
    }),
  );
  assert.ok(view.getByRole("heading", { name: "Reviewing your website" }));
  assert.equal(
    view.getByText("example.com").parentElement?.textContent,
    "example.com/page",
  );
  assert.equal(view.getByRole("status").textContent, "Connecting");
  assert.ok(view.getByRole("heading", { name: "Time elapsed" }));
  assert.equal(
    view.container.querySelector("[data-review-elapsed]")?.textContent,
    "00:00",
  );
  fireEvent.click(view.getByRole("button", { name: "Cancel review" }));
  assert.equal(cancelled, true);
});
