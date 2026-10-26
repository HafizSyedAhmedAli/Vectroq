import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const send = () => screen.getByRole("button", { name: /send reset link/i });

describe("ForgotPasswordForm", () => {
  it("prefills the initial email", () => {
    render(<ForgotPasswordForm initialEmail="a@b.com" />);
    expect(screen.getByLabelText("Email")).toHaveValue("a@b.com");
  });

  it("validates the email before calling the API", async () => {
    render(<ForgotPasswordForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "bad");
    await user.click(send());
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Email"), "x");
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("sends the trimmed email and shows the confirmation", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<ForgotPasswordForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), " a@b.com ");
    await user.click(send());
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/forgot");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com" });
  });

  it("lets the user go back to use a different email", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<ForgotPasswordForm initialEmail="a@b.com" />);
    const user = userEvent.setup();
    await user.click(send());
    await user.click(await screen.findByRole("button", { name: /use a different email/i }));
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows a server error", async () => {
    fetchMock.mockReturnValue(res({ error: "Too many requests." }, 429));
    render(<ForgotPasswordForm initialEmail="a@b.com" />);
    await userEvent.setup().click(send());
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests.");
    expect(send()).toBeEnabled();
  });

  it("falls back to a generic error", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<ForgotPasswordForm initialEmail="a@b.com" />);
    await userEvent.setup().click(send());
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("reports network failure", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    render(<ForgotPasswordForm initialEmail="a@b.com" />);
    await userEvent.setup().click(send());
    expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
  });
});
