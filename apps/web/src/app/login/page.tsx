import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/LoginForm";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in · Vectroq" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/office/dashboard";

  if (await getAuth()) redirect(safeNext);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Vectroq account to continue."
      footer={
        <>
          New here?{" "}
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-dark"
          >
            Create your company <ArrowRight className="size-3.5" />
          </Link>
        </>
      }
    >
      {reset === "1" && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          Password updated. Log in with your new password.
        </p>
      )}
      <LoginForm next={safeNext} />
    </AuthShell>
  );
}
