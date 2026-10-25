import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  emailVerification: { findFirst: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@vectroq/db", () => ({ prisma }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendEmail: (a: unknown) => sendEmail(a) }));
vi.mock("@/lib/email-templates", () => ({
  verifyEmail: (url: string) => ({ subject: "Verify", html: url, text: url }),
}));

import { sendVerificationEmail } from "./email-verification";
import { sha256 } from "./tokens";

const user = { id: "u1", email: "a@b.c" };
beforeEach(() => vi.clearAllMocks());

describe("sendVerificationEmail", () => {
  it("returns cooldown when a recent token exists", async () => {
    prisma.emailVerification.findFirst.mockResolvedValue({ id: "x" });
    expect(await sendVerificationEmail(user, "https://x")).toBe("cooldown");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("creates hashed token, emails link, returns sent", async () => {
    prisma.emailVerification.findFirst.mockResolvedValue(null);
    sendEmail.mockResolvedValue(true);
    expect(await sendVerificationEmail(user, "https://app")).toBe("sent");
    const created = prisma.emailVerification.create.mock.calls[0][0].data;
    const mail = sendEmail.mock.calls[0][0];
    const token = mail.html.replace("https://app/verify-email/", "");
    expect(created.tokenHash).toBe(sha256(token));
    expect(mail.to).toBe("a@b.c");
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3600e3);
    expect(prisma.emailVerification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
    });
  });
  it("returns logged when email not delivered", async () => {
    prisma.emailVerification.findFirst.mockResolvedValue(null);
    sendEmail.mockResolvedValue(false);
    expect(await sendVerificationEmail(user, "https://app")).toBe("logged");
  });
});
