import { prisma } from "@vectroq/db";
import { sendEmail } from "@/lib/email";
import { verifyEmail } from "@/lib/email-templates";
import { newToken, sha256 } from "./tokens";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const COOLDOWN_MS = 60 * 1000; // one email per account per minute

/** "sent" = delivered, "logged" = dev without a Resend key, "cooldown" = too soon. */
export async function sendVerificationEmail(
  user: { id: string; email: string },
  baseUrl: string,
): Promise<"sent" | "logged" | "cooldown"> {
  const recent = await prisma.emailVerification.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) },
    },
  });
  if (recent) return "cooldown";

  const token = newToken();
  await prisma.$transaction([
    prisma.emailVerification.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    }),
  ]);

  const delivered = await sendEmail({
    to: user.email,
    ...verifyEmail(`${baseUrl}/verify-email/${token}`),
  });
  return delivered ? "sent" : "logged";
}
