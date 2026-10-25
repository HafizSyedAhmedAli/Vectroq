import { describe, it, expect } from "vitest";
import { resetEmail, inviteEmail, verifyEmail, passwordChangedEmail } from "./email-templates";

const link = "https://app.test/x?a=1&b=2";

describe("email templates", () => {
  it.each([
    ["reset", resetEmail(link), "Reset your Vectroq password", "Reset password"],
    ["verify", verifyEmail(link), "Confirm your Vectroq email", "Confirm email"],
    ["changed", passwordChangedEmail(link), "Your Vectroq password was changed", "Reset password"],
  ])("%s email has subject, CTA label, escaped link in html and raw link in text", (_n, m, subject, label) => {
    expect(m.subject).toBe(subject);
    expect(m.html).toContain(label);
    expect(m.html).toContain("https://app.test/x?a=1&amp;b=2");
    expect(m.html).not.toContain("a=1&b=2");
    expect(m.text).toContain(link);
    expect(m.html.startsWith("<!doctype html>")).toBe(true);
  });

  it("states expiry windows", () => {
    expect(resetEmail(link).text).toContain("1 hour");
    expect(verifyEmail(link).text).toContain("24 hours");
  });

  it("invite email uses role label and 7-day validity", () => {
    const m = inviteEmail({ orgName: "Acme", inviterName: "Sara", role: "ESTIMATOR", link });
    expect(m.subject).toBe("Sara invited you to Acme on Vectroq");
    expect(m.html).toContain("Estimator");
    expect(m.text).toContain("as Estimator");
    expect(m.text).toContain("7 days");
    expect(m.html).toContain("Accept invitation");
  });

  it("invite email escapes HTML in names (html) but not in plain text", () => {
    const m = inviteEmail({ orgName: "A<b>&Co", inviterName: '"Eve"', role: "VIEWER", link });
    expect(m.html).toContain("A&lt;b&gt;&amp;Co");
    expect(m.html).toContain("&quot;Eve&quot;");
    expect(m.html).not.toContain("<b>&Co");
    expect(m.text).toContain("A<b>&Co");
  });

  it("escapes a malicious link in html", () => {
    const m = resetEmail('"><script>x</script>');
    expect(m.html).not.toContain("<script>");
  });
});
