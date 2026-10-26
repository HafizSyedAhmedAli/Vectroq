import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { SignupForm } from "./SignupForm";

const fetchMock = vi.fn();
const res = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const company = () => screen.getByLabelText("Company name");
const slug = () => screen.getByLabelText("Your public form address");

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Your name"), "Eren");
  await user.type(screen.getByLabelText("Email"), "e@x.com");
  await user.type(screen.getByLabelText(/password/i), "password123");
  await user.type(company(), "TM Construction");
}

describe("SignupForm", () => {
  it("derives the slug from the company name", async () => {
    render(<SignupForm />);
    await userEvent.setup().type(company(), "TM Construction Co.");
    expect(slug()).toHaveValue("tm-construction-co");
  });

  it("stops auto-deriving once the slug is edited by hand", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.click(slug());
    await user.paste("My Slug");
    expect(slug()).toHaveValue("my-slug");
    await user.type(company(), "Other");
    expect(slug()).toHaveValue("my-slug");
  });

  it("strips a typed space or hyphen immediately (slugify runs per keystroke)", async () => {
    render(<SignupForm />);
    await userEvent.setup().type(slug(), "a b");
    expect(slug()).toHaveValue("ab");
  });

  it("submits the form and goes to settings", async () => {
    fetchMock.mockReturnValue(res({}));
    render(<SignupForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: /create my company/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/office/settings"));
    expect(refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse(init.body)).toEqual({
      name: "Eren",
      email: "e@x.com",
      password: "password123",
      company: "TM Construction",
      slug: "tm-construction",
    });
  });

  it("shows the server error and re-enables the button", async () => {
    fetchMock.mockReturnValue(res({ error: "Email already in use." }, 409));
    render(<SignupForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: /create my company/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use.");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /create my company/i })).toBeEnabled();
  });

  it("uses a generic message when the error body is unreadable", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) }));
    render(<SignupForm />);
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: /create my company/i }));
    expect(await screen.findByText("Could not create your account.")).toBeInTheDocument();
  });
});
