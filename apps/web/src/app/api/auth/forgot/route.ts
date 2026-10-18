import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@vectroq/db";
import { isEmail, normalizeEmail } from "@/lib/auth/credentials";
import { newToken, sha256 } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { resetEmail } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const COOLDOWN_MS = 60 * 1000; // one email per account per minute

export async function POST(req: NextRequest) {
    const b = await req.json().catch(() => null);
    const email = normalizeEmail(b?.email);
    if (!isEmail(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const base = appUrl(req);

    // Everything that could reveal whether the account exists runs after the
    // response, so the reply and its timing are identical either way.
    after(async () => {
        try {
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) return;

            const recent = await prisma.passwordReset.findFirst({
                where: { userId: user.id, createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) } },
            });
            if (recent) return;

            const token = newToken();
            await prisma.$transaction([
                prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
                prisma.passwordReset.create({
                    data: {
                        userId: user.id,
                        tokenHash: sha256(token),
                        expiresAt: new Date(Date.now() + TTL_MS),
                    },
                }),
            ]);
            await sendEmail({ to: user.email, ...resetEmail(`${base}/reset-password/${token}`) });
        } catch (err) {
            console.error("Password reset email failed", err);
        }
    });

    return NextResponse.json({ ok: true });
}