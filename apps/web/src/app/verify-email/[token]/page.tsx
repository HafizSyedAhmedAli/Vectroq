import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@vectroq/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailButton } from "@/components/VerifyEmailButton";
import { sha256 } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

// The token is in the URL: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: "Confirm email · Vectroq",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const linkCls =
  "font-semibold text-brand dark:text-blue-400 dark:hover:text-blue-300";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await prisma.emailVerification.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  const valid = !!row && !row.usedAt && row.expiresAt > new Date();

  if (!valid) {
    return (
      <AuthShell
        themeToggle
        title="Link expired"
        subtitle="This confirmation link is invalid, already used, or older than 24 hours."
        footer={
          <Link href="/login" className={linkCls}>
            Log in
          </Link>
        }
      >
        <p className="text-sm leading-relaxed text-stone-600 dark:text-slate-300">
          Log in and use <b>Resend email</b> in the banner at the top of your
          dashboard to get a new link.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      themeToggle
      title="Confirm your email"
      subtitle={`Confirm ${row.user.email} to finish setting up your account.`}
      footer={
        <Link href="/login" className={linkCls}>
          Back to log in
        </Link>
      }
    >
      <VerifyEmailButton token={token} />
    </AuthShell>
  );
}
