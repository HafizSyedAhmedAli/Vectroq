import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={
        <Link
          href="/login"
          className="font-semibold text-brand hover:text-brand-dark"
        >
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm initialEmail={(email ?? "").slice(0, 254)} />
    </AuthShell>
  );
}
