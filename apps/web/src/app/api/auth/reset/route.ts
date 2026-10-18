import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { hashPassword, validatePassword } from "@/lib/auth/credentials";
import { sha256 } from "@/lib/auth/tokens";

const invalid = () =>
    NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 410 },
    );

export async function POST(req: NextRequest) {
    const b = await req.json().catch(() => null);
    const token = typeof b?.token === "string" ? b.token : "";
    const pwError = validatePassword(b?.password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    const row = token
        ? await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } })
        : null;
    if (!row || row.usedAt || row.expiresAt < new Date()) return invalid();

    const passwordHash = await hashPassword(b.password);

    let claimed = false;
    await prisma.$transaction(async (tx) => {
        // Atomic claim: if two requests race, only one gets count === 1.
        const res = await tx.passwordReset.updateMany({
            where: { id: row.id, usedAt: null },
            data: { usedAt: new Date() },
        });
        if (res.count !== 1) return;
        claimed = true;
        await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
        await tx.session.deleteMany({ where: { userId: row.userId } }); // sign out everywhere
        await tx.passwordReset.deleteMany({
            where: { userId: row.userId, id: { not: row.id } },
        });
    });

    return claimed ? NextResponse.json({ ok: true }) : invalid();
}