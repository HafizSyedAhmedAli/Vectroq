import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { appUrl } from "@/lib/app-url";

export async function POST(req: NextRequest) {
  const g = await guard("VIEWER");
  if (!g.ok) return g.res;
  const { user } = g.auth;

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  try {
    const result = await sendVerificationEmail(user, appUrl(req));
    if (result === "cooldown") {
      return NextResponse.json(
        { error: "Please wait a minute before requesting another email." },
        { status: 429 },
      );
    }
    return NextResponse.json({ ok: true, emailed: result === "sent" });
  } catch (err) {
    console.error("Verification email failed", err);
    return NextResponse.json(
      { error: "We couldn't send the email. Try again shortly." },
      { status: 502 },
    );
  }
}
