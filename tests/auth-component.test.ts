import "./component-environment";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import AuthForm from "../src/components/AuthForm";

afterEach(cleanup);

test("signup clears the password and replaces account creation with a confirmation cooldown", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ confirmation: true, message: "Check your email to continue." }));
  const view = render(createElement(AuthForm, { mode: "signup", minLength: 6 }));
  fireEvent.change(view.getByLabelText("Email address"), { target: { value: "fixture@example.com" } });
  fireEvent.change(view.getByLabelText("Password"), { target: { value: "temporary-fixture-password" } });
  fireEvent.click(view.getByRole("button", { name: "Show password" }));
  assert.equal(view.getByLabelText("Password").getAttribute("type"), "text");
  fireEvent.submit(view.getByRole("button", { name: "Create account" }).closest("form")!);
  await waitFor(() => assert.ok(view.getByRole("status")));
  assert.equal(view.queryByLabelText("Password"), null);
  assert.equal(view.queryByRole("button", { name: "Create account" }), null);
  assert.ok((view.getByRole("button", { name: /Resend available/ }) as HTMLButtonElement).disabled);
});

test("an expired confirmation offers resend without asking for the old password", async (t) => {
  let action = "";
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    action = String(url);
    return Response.json({ message: "If confirmation is needed, check your email." });
  });
  const view = render(createElement(AuthForm, { mode: "login", minLength: 6, notice: "expired" }));
  fireEvent.change(view.getByLabelText("Email address"), { target: { value: "fixture@example.com" } });
  fireEvent.click(view.getByRole("button", { name: "Resend confirmation email" }));
  await waitFor(() => assert.equal(action, "/api/auth/resend"));
});
