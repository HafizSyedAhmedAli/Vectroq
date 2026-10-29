import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { platformBrand } from "@/lib/brand";

const push = vi.fn();
const refresh = vi.fn();
const nav = vi.hoisted(() => ({ pathname: "/office/dashboard" }));
const params = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => params,
}));

import { OfficeShell } from "./OfficeShell";

const fetchMock = vi.fn();

function setup(over: Partial<React.ComponentProps<typeof OfficeShell>> = {}) {
  return render(
    <OfficeShell
      brand={platformBrand}
      orgSlug="acme"
      role="OWNER"
      userName="Test User"
      userEmail="t@x.co"
      emailVerified
      {...over}
    >
      <p>page content</p>
    </OfficeShell>,
  );
}

beforeEach(() => {
  nav.pathname = "/office/dashboard";
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("OfficeShell", () => {
  it("renders children and the client-form link", () => {
    setup();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Client Form" })).toHaveAttribute(
      "href",
      "/c/acme",
    );
  });

  it("shows owner-only links to owners", () => {
    setup();
    for (const l of [
      "Team",
      "Business Rules",
      "Settings",
      "Billing",
      "Audit log",
    ])
      expect(screen.getByRole("link", { name: l })).toBeInTheDocument();
  });

  it.each(["ESTIMATOR", "VIEWER"] as const)(
    "hides owner-only links from %s",
    (role) => {
      setup({ role });
      for (const l of [
        "Team",
        "Business Rules",
        "Settings",
        "Billing",
        "Audit log",
      ])
        expect(screen.queryByRole("link", { name: l })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Rates" })).toBeInTheDocument();
    },
  );

  it("marks the current static page active, but not Projects", () => {
    nav.pathname = "/office/rates";
    setup();
    expect(screen.getByRole("link", { name: "Rates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("treats /office/<id> as the Projects page", () => {
    nav.pathname = "/office/abc123";
    setup();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("searches, trimming and encoding the query", async () => {
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search projects"), "  ali & co ");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/office/search?q=ali%20%26%20co");
  });

  it("an empty search goes back to the project list", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Search projects"));
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/office");
  });

  it("logs out from the user menu", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /test user/i }));
    await user.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(push).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalled();
  });

  it("only offers company settings in the menu to owners", async () => {
    setup({ role: "VIEWER" });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /test user/i }));
    expect(
      screen.getByRole("menuitem", { name: /account and password/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /company settings/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the verify-email banner only when unverified", () => {
    const { unmount } = setup({ emailVerified: false });
    expect(screen.getByRole("status")).toHaveTextContent("t@x.co");
    unmount();
    setup();
    expect(
      screen.queryByText(/confirm your email address/i),
    ).not.toBeInTheDocument();
  });

  it("shows the demo banner with the expiry", () => {
    setup({ demoExpiresLabel: "27 Oct 2026, 10:00" });
    expect(screen.getByText(/demo company/i)).toBeInTheDocument();
    expect(screen.getByText(/27 Oct 2026, 10:00/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create your real account/i }),
    ).toHaveAttribute("href", "/signup");
  });

  it("collapses the sidebar and remembers it", async () => {
    setup();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem("vq_sidebar_collapsed")).toBe("1");
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });

  it("restores a saved collapsed state", async () => {
    localStorage.setItem("vq_sidebar_collapsed", "1");
    setup();
    expect(
      await screen.findByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });

  it("opens and closes the mobile drawer", async () => {
    setup();
    const user = userEvent.setup();
    const aside = document.querySelector("aside")!;
    expect(aside.className).toContain("-translate-x-full");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(aside.className).toContain("translate-x-0");
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(aside.className).toContain("-translate-x-full");
  });
});
