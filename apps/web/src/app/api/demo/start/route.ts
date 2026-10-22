import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@vectroq/db";
import { createSession } from "@/lib/auth/session";
import { cleanupExpiredDemos, DEMO_HOURS, MAX_ACTIVE_DEMOS } from "@/lib/demo";
import { createSampleProject } from "@/lib/sample-project";
import { appUrl } from "@/lib/app-url";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  await cleanupExpiredDemos().catch((e) =>
    console.error("Demo cleanup failed", e),
  );

  const active = await prisma.organization.count({ where: { isDemo: true } });
  if (active >= MAX_ACTIVE_DEMOS) {
    return NextResponse.json(
      {
        error: "The demo is busy right now. Please try again in a few minutes.",
      },
      { status: 503 },
    );
  }

  const id = randomBytes(4).toString("hex");
  const { user, org } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `demo-${id}@demo.invalid`,
        name: "Demo User",
        passwordHash: "demo-login-disabled", // never verifies
        emailVerifiedAt: new Date(),
      },
    });
    const org = await tx.organization.create({
      data: {
        slug: `demo-${id}`,
        name: "Demo Builders",
        tagline: "Priced estimates in minutes",
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + DEMO_HOURS * 3_600_000),
      },
    });
    await tx.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
    return { user, org };
  });

  await createSession(user.id, org.id, false);

  try {
    await createSampleProject(org, appUrl(req));
  } catch (err) {
    console.error("Demo sample project failed", err); // demo still usable
  }
  return NextResponse.json({ ok: true });
}
