import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { LoginForm } from "./LoginForm";

const fetchMock = vi.fn();

function ok(body: unknown = {}, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const email = () => screen.getByLabelText("Email");
const pw = () => screen.getByLabelText("Password");
const submit = () => screen.getByRole("button", { name: /log in/i });

describe("LoginForm", () => {
  it("validates empty fields without calling the API", async () => {
    render(<LoginForm next="/office" />);
    const user = userEvent.setup();
    await user.click(submit());
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(email()).toHaveFocus();
  });

  it("rejects an invalid email", async () => {
    render(<LoginForm next="/office" />);
    const user = userEvent.setup();
    await user.type(email(), "nope");
    await user.type(pw(), "secret");
    await user.click(submit());
    expect(screen.getByText(/doesn't look like a valid email/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for a password when only that is missing and focuses it", async () => {
    render(<LoginForm next="/office" />);
    const user = userEvent.setup();
    await user.type(email(), "a@b.com");
    await user.click(submit());
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(pw()).toHaveFocus();
  });

  it("clears a field error when the user types", async () => {
    render(<LoginForm next="/office" />);
    const user = userEvent.setup();
    await user.click(submit());
    await user.type(email(), "a");
    expect(screen.queryByText("Enter your email address.")).not.toBeInTheDocument();
  });

  it("logs in, remembers the email and navigates", async () => {
    fetchMock.mockReturnValue(ok());
    render(<LoginForm next="/office/dashboard" />);
    const user = userEvent.setup();
    await user.type(email(), "  a@b.com ");
    await user.type(pw(), "secret123");
    await user.click(submit());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office/dashboard"));
    expect(refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "secret123", remember: true });
    expect(localStorage.getItem("vq_remember_email")).toBe("a@b.com");
  });

  it("forgets the email when Remember me is unchecked", async () => {
    localStorage.setItem("vq_remember_email", "old@x.com");
    fetchMock.mockReturnValue(ok());
    render(<LoginForm next="/o" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /remember me/i }));
    await user.type(pw(), "pw");
    await user.click(submit());
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(localStorage.getItem("vq_remember_email")).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).remember).toBe(false);
  });

  it("prefills the saved email", async () => {
    localStorage.setItem("vq_remember_email", "saved@x.com");
    render(<LoginForm next="/o" />);
    await waitFor(() => expect(email()).toHaveValue("saved@x.com"));
  });

  it("shows the server error, clears the password and refocuses it", async () => {
    fetchMock.mockReturnValue(ok({ error: "Wrong email or password." }, 401));
    render(<LoginForm next="/o" />);
    const user = userEvent.setup();
    await user.type(email(), "a@b.com");
    await user.type(pw(), "bad");
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
    expect(pw()).toHaveValue("");
    expect(pw()).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it("falls back to a generic error when the body has none", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<LoginForm next="/o" />);
    const user = userEvent.setup();
    await user.type(email(), "a@b.com");
    await user.type(pw(), "x");
    await user.click(submit());
    expect(await screen.findByText("Could not log in.")).toBeInTheDocument();
  });

  it("reports network failure", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<LoginForm next="/o" />);
    const user = userEvent.setup();
    await user.type(email(), "a@b.com");
    await user.type(pw(), "x");
    await user.click(submit());
    expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it("toggles password visibility", async () => {
    render(<LoginForm next="/o" />);
    const user = userEvent.setup();
    expect(pw()).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(pw()).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(pw()).toHaveAttribute("type", "password");
  });

  it("shows a Caps Lock hint and hides it on blur", () => {
    render(<LoginForm next="/o" />);
    fireEvent.keyUp(pw(), { key: "a", modifierCapsLock: true });
    expect(screen.getByText("Caps Lock is on")).toBeInTheDocument();
    fireEvent.blur(pw());
    expect(screen.queryByText("Caps Lock is on")).not.toBeInTheDocument();
  });

  it("passes the typed email to the forgot-password link", async () => {
    render(<LoginForm next="/o" />);
    const link = screen.getByRole("link", { name: /forgot your password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
    await userEvent.setup().type(email(), "a@b.com");
    expect(link).toHaveAttribute("href", "/forgot-password?email=a%40b.com");
  });

  it("still works when localStorage throws", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    fetchMock.mockReturnValue(ok());
    render(<LoginForm next="/o" />);
    const user = userEvent.setup();
    await user.type(email(), "a@b.com");
    await user.type(pw(), "x");
    await user.click(submit());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/o"));
    spy.mockRestore();
    set.mockRestore();
  });
});
