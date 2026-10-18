import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { isEmail, normalizeEmail } from "@/lib/auth/credentials";
import { isRole } from "@/lib/auth/roles";
import { newToken, sha256 } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { inviteEmail } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";

const INVITE_DAYS = 7;

export async function POST(req: NextRequest) {
  const g = await guard("OWNER");
  if (!g.ok) return g.res;
  const org = g.auth.org;

  if (!g.auth.user.emailVerified) {
    return NextResponse.json(
      { error: "Confirm your email address before inviting teammates." },
      { status: 403 },
    );
  }

  const b = await req.json().catch(() => null);
  const email = normalizeEmail(b?.email);
  if (!isEmail(email))
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  if (!isRole(b?.role))
    return NextResponse.json({ error: "Choose a role." }, { status: 400 });

  const member = await prisma.membership.findFirst({
    where: { organizationId: org.id, user: { email } },
  });
  if (member)
    return NextResponse.json(
      { error: "That person is already on your team." },
      { status: 409 },
    );

  const token = newToken();
  await prisma.$transaction([
    prisma.invitation.deleteMany({
      where: { organizationId: org.id, email, acceptedAt: null },
    }),
    prisma.invitation.create({
      data: {
        organizationId: org.id,
        email,
        role: b.role,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      },
    }),
  ]);

  const link = `${appUrl(req)}/invite/${token}`;
  let emailed = false;
  try {
    emailed = await sendEmail({
      to: email,
      ...inviteEmail({
        orgName: org.name,
        inviterName: g.auth.user.name,
        role: b.role,
        link,
      }),
    });
  } catch (err) {
    console.error("Invite email failed", err);
  }

  // the link is still returned so the owner can copy it if email isn't delivered
  return NextResponse.json({ link, emailed }, { status: 201 });
}
