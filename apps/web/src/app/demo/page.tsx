import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { DemoStartButton } from "@/components/DemoStartButton";

export const metadata: Metadata = { title: "Try the demo · Vectroq" };

export default function DemoPage() {
  return (
    <AuthShell
      themeToggle
      title="Try Vectroq"
      subtitle="No sign-up. You get your own private demo company with a sample plan and a priced BOQ. It is deleted after 24 hours."
      footer={
        <>
          Want to keep your work?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand dark:text-blue-400 dark:hover:text-blue-300"
          >
            Create your company
          </Link>
        </>
      }
    >
      <DemoStartButton />
    </AuthShell>
  );
}
