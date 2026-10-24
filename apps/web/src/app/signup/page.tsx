import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <AuthShell
      themeToggle
      title="Create your company"
      subtitle="Your own intake form, rates library and branding. Sample rates included."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand dark:text-blue-400 dark:hover:text-blue-300"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
