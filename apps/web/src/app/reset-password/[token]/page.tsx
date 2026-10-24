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

const footerLink = (
  <Link
    href="/login"
    className="font-semibold text-brand dark:text-blue-400 dark:hover:text-blue-300"
  >
    Back to log in
  </Link>
);

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
        themeToggle
        title="Link expired"
        subtitle="This reset link is invalid, already used, or older than 1 hour."
        footer={footerLink}
      >
        <Link
          href="/forgot-password"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-white hover:bg-brand-dark"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      themeToggle
      title="Choose a new password"
      subtitle="You'll be signed out of all devices once it's changed."
      footer={footerLink}
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
