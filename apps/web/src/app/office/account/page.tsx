import { BadgeCheck, MailWarning, UserCog } from "lucide-react";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ResendVerificationButton } from "@/components/ResendVerificationButton";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

const card =
  "rounded-2xl border border-stone-200/70 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.10)]";

export default async function AccountPage() {
  const { user, org, role } = await requirePage();

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-blue-50/40 to-white pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <UserCog className="size-6" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black">
              Account
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Your sign-in details for {org.name}.
            </p>
          </div>
        </div>

        <section className={`${card} mt-8 p-5 sm:p-7`}>
          <h2 className="text-lg font-bold text-brand-black">Profile</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-stone-400">Name</dt>
              <dd className="font-semibold text-brand-black">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-400">Email</dt>
              <dd className="break-all font-semibold text-brand-black">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-400">Role</dt>
              <dd className="font-semibold text-brand-black">
                {ROLE_LABEL[role]}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <BadgeCheck className="size-3.5" /> Email confirmed
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <MailWarning className="size-4 shrink-0" />
                <span className="flex-1">
                  Your email isn&apos;t confirmed yet.
                </span>
                <ResendVerificationButton />
              </div>
            )}
          </div>
        </section>

        <section className={`${card} mt-6 p-5 sm:p-7`}>
          <h2 className="text-lg font-bold text-brand-black">
            Change password
          </h2>
          <p className="mb-6 mt-1 text-sm text-stone-500">
            You&apos;ll stay signed in here. Every other device is signed out.
          </p>
          <ChangePasswordForm />
        </section>
      </div>
    </main>
  );
}
