import { MailWarning } from "lucide-react";
import { ResendVerificationButton } from "./ResendVerificationButton";

export function VerifyEmailBanner({ email }: { email: string }) {
  return (
    <div
      role="status"
      className="print:hidden flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-brand/20 bg-brand/10 px-4 py-3 text-sm text-brand-black sm:px-6"
    >
      <MailWarning className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Confirm your email address. We sent a link to <b>{email}</b>.
      </span>
      <ResendVerificationButton />
    </div>
  );
}
