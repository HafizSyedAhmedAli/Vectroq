import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@vectroq/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { sha256 } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";
// the token is in the URL: never leak it through the Referer header
export const metadata: Metadata = {
    title: "Reset password · Vectroq",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
};

export default async function ResetPasswordPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const row = await prisma.passwordReset.findUnique({
        where: { tokenHash: sha256(token) },
    });
    const valid = !!row && !row.usedAt && row.expiresAt > new Date();

    if (!valid) {
        return (
            <AuthShell
                title="Link expired"
                subtitle="This reset link is invalid, already used, or older than 1 hour."
                footer={<Link href="/login" className="font-semibold text-brand">Back to log in</Link>}
            >
                <Link href="/forgot-password"
                    className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-white hover:bg-brand-dark">
                    Request a new link
                </Link>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Choose a new password"
            subtitle="You'll be signed out of all devices once it's changed."
            footer={<Link href="/login" className="font-semibold text-brand">Back to log in</Link>}
        >
            <ResetPasswordForm token={token} />
        </AuthShell>
    );
}