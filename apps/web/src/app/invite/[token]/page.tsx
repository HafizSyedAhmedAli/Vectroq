import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@vectroq/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";
import { ROLE_LABEL, isRole } from "@/lib/auth/roles";
import { sha256 } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

// The invite token is in the URL: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: "Join your team · Vectroq",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const linkCls =
  "font-semibold text-brand hover:text-brand-dark dark:text-blue-400 dark:hover:text-blue-300";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { organization: true },
  });

  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return (
      <AuthShell
        themeToggle
        title="Invitation not valid"
        subtitle="This link has expired or was already used."
        footer={
          <Link href="/login" className={linkCls}>
            Back to log in
          </Link>
        }
      >
        <p className="text-sm leading-relaxed text-stone-600 dark:text-slate-300">
          Ask the owner of the company account to send you a new invitation.
        </p>
      </AuthShell>
    );
  }

  const hasAccount = !!(await prisma.user.findUnique({
    where: { email: inv.email },
  }));
  const roleLabel = isRole(inv.role) ? ROLE_LABEL[inv.role] : inv.role;

  return (
    <AuthShell
      themeToggle
      title={`Join ${inv.organization.name}`}
      subtitle={`You've been invited as ${roleLabel} (${inv.email}).`}
      footer={
        <>
          Not you?{" "}
          <Link href="/login" className={linkCls}>
            Log in
          </Link>
        </>
      }
    >
      <AcceptInviteForm token={token} hasAccount={hasAccount} />
    </AuthShell>
  );
}
