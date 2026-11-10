import "./component-environment";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import AuditHistory from "../src/components/AuditHistory";
import WorkspaceHome from "../src/components/WorkspaceHome";
import WorkspaceShell from "../src/components/WorkspaceShell";

afterEach(cleanup);

const reports = [
  {
    id: "92893258-eebc-42ae-a893-05120bbb25ce",
    hostname: "example.com",
    audited_url: "https://example.com/pricing",
    analyzed_at: "2026-11-10T10:00:00.000Z",
  },
  {
    id: "10293258-eebc-42ae-a893-05120bbb25ce",
    hostname: "another.example",
    audited_url: "https://another.example/about",
    analyzed_at: "2026-11-09T09:00:00.000Z",
  },
];

test("the empty workspace provides one clear review form and an honest history count", () => {
  const addresses: string[] = [];
  const view = render(
    createElement(WorkspaceHome, {
      url: "https://example.com/pricing",
      onUrlChange: () => {},
      onSubmit: (url) => addresses.push(url),
      ready: true,
      history: createElement(AuditHistory, {
        reports: [],
        count: 0,
        query: "",
        failed: false,
      }),
    }),
  );
  fireEvent.submit(view.getByRole("form", { name: "Start a website review" }));
  assert.deepEqual(addresses, ["https://example.com/pricing"]);
  assert.ok(view.getByLabelText("0 saved reviews"));
  assert.ok(view.getByRole("button", { name: "Start your first review" }));
  assert.equal(view.queryByRole("table"), null);
});

test("history deletion changes the real total only after success and retains accessible confirmation", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ deleted: true }),
  );
  const view = render(
    createElement(AuditHistory, {
      reports,
      count: 8,
      query: "",
      failed: false,
    }),
  );
  assert.ok(view.getByLabelText("8 saved reviews"));
  fireEvent.click(
    view.getByRole("button", { name: "Delete report for example.com" }),
  );
  assert.ok(view.getByRole("dialog", { name: "Delete this saved report?" }));
  fireEvent.click(view.getByRole("button", { name: "Keep report" }));
  assert.equal(
    document.activeElement?.getAttribute("aria-label"),
    "Delete report for example.com",
  );
  fireEvent.click(
    view.getByRole("button", { name: "Delete report for example.com" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Delete report" }));
  await waitFor(() => assert.ok(view.getByLabelText("7 saved reviews")));
  assert.equal(view.queryByRole("link", { name: "example.com" }), null);
  assert.ok(view.getByRole("link", { name: "another.example" }));
  assert.equal(document.activeElement?.id, "history-title");
});

test("filtered, failed, and older-page empty states remain distinct from a first review", () => {
  const filtered = render(
    createElement(AuditHistory, {
      reports: [],
      count: 0,
      query: "missing",
      failed: false,
    }),
  );
  assert.ok(
    filtered.getByRole("heading", { name: "No reviews match your search" }),
  );
  assert.ok(filtered.getByRole("link", { name: "Clear search" }));
  assert.equal(
    filtered.queryByRole("button", { name: "Start your first review" }),
    null,
  );
  filtered.unmount();
  const failed = render(
    createElement(AuditHistory, { reports: [], query: "", failed: true }),
  );
  assert.ok(failed.getByRole("alert"));
  assert.equal(failed.queryByLabelText("0 saved reviews"), null);
  failed.unmount();
  const older = render(
    createElement(AuditHistory, {
      reports: [],
      query: "",
      failed: false,
      olderPage: true,
    }),
  );
  assert.ok(
    older.getByRole("heading", { name: "You’ve reached the end of this page" }),
  );
});

test("workspace navigation focuses history and the account disclosure closes with Escape", () => {
  const view = render(
    createElement(
      WorkspaceShell,
      {
        account: { id: "fixture-owner", email: "fixture@example.com" },
      },
      createElement(
        "h2",
        { id: "history-title", tabIndex: -1 },
        "Saved reports",
      ),
    ),
  );
  const heading = view.getByRole("heading", { name: "Saved reports" });
  Object.defineProperty(heading, "scrollIntoView", { value: () => {} });
  fireEvent.click(view.getByRole("button", { name: "Audit history" }));
  assert.equal(document.activeElement, heading);
  const summary = within(view.getByRole("complementary")).getByLabelText(
    "Account menu",
  );
  fireEvent.click(summary);
  const details = summary.closest("details")!;
  assert.equal(details.open, true);
  fireEvent.keyDown(summary, { key: "Escape" });
  assert.equal(details.open, false);
});
