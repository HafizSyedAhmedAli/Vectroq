// apps/web/src/app/office/layout.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/org", () => ({ requirePage: vi.fn() }));
vi.mock("@/components/OfficeShell", () => ({
  OfficeShell: ({ children, ...p }: any) => (
    <div data-testid="shell" data-props={JSON.stringify(p)}>
      {children}
    </div>
  ),
}));

import { requirePage } from "@/lib/org";
import OfficeLayout from "./layout";

const org = (o: Record<string, unknown> = {}) => ({
  slug: "acme",
  name: "Acme",
  tagline: null,
  logoUrl: null,
  primaryColor: "#2563EB",
  phone: null,
  email: null,
  website: null,
  offices: [],
  isDemo: false,
  demoExpiresAt: null,
  ...o,
});
const as = (o = {}, role = "OWNER", verified = true) =>
  (requirePage as any).mockResolvedValue({
    org: org(o),
    role,
    user: { name: "Sara", email: "s@x.co", emailVerified: verified },
  });
const shellProps = () => JSON.parse(screen.getByTestId("shell").dataset.props!);

beforeEach(() => {
  vi.clearAllMocks();
  as();
});

describe("Office layout", () => {
  it("requires a signed-in user and renders the children", async () => {
    render(await OfficeLayout({ children: <p>inner</p> }));
    expect(requirePage).toHaveBeenCalled();
    expect(screen.getByText("inner")).toBeInTheDocument();
  });

  it("passes user, role and company to the shell", async () => {
    render(await OfficeLayout({ children: null }));
    expect(shellProps()).toMatchObject({
      orgSlug: "acme",
      role: "OWNER",
      userName: "Sara",
      userEmail: "s@x.co",
      emailVerified: true,
      demoExpiresLabel: null,
    });
    expect(shellProps().brand.name).toBe("Acme");
  });

  it("passes the unverified flag through", async () => {
    as({}, "VIEWER", false);
    render(await OfficeLayout({ children: null }));
    expect(shellProps()).toMatchObject({
      role: "VIEWER",
      emailVerified: false,
    });
  });

  it("only gives a demo expiry label to demo companies", async () => {
    as({ isDemo: true, demoExpiresAt: new Date("2026-10-27T10:00:00Z") });
    render(await OfficeLayout({ children: null }));
    expect(typeof shellProps().demoExpiresLabel).toBe("string");
    expect(shellProps().demoExpiresLabel.length).toBeGreaterThan(0);
  });

  it("themes the wrapper with the company colour", async () => {
    as({ primaryColor: "#16A34A" });
    const { container } = render(await OfficeLayout({ children: null }));
    const wrap = container.querySelector(".vq-app") as HTMLElement;
    expect(wrap.style.getPropertyValue("--color-brand").toLowerCase()).toBe(
      "#16a34a",
    );
  });
});
