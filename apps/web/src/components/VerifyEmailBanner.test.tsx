// apps/web/src/components/VerifyEmailBanner.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./ResendVerificationButton", () => ({
  ResendVerificationButton: () => <button>resend</button>,
}));

import { VerifyEmailBanner } from "./VerifyEmailBanner";

describe("VerifyEmailBanner", () => {
  it("names the address and offers to resend", () => {
    render(<VerifyEmailBanner email="sara@x.co" />);
    expect(screen.getByRole("status")).toHaveTextContent("sara@x.co");
    expect(screen.getByRole("button", { name: "resend" })).toBeInTheDocument();
  });

  it("is hidden when printing", () => {
    render(<VerifyEmailBanner email="a@b.co" />);
    expect(screen.getByRole("status").className).toContain("print:hidden");
  });
});
