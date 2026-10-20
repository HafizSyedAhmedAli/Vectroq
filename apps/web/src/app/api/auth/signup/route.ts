import { NextRequest, NextResponse, after } from "next/server";
import { Prisma, prisma } from "@vectroq/db";
import {
  hashPassword,
  isEmail,
  normalizeEmail,
  validatePassword,
} from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { slugify, validateSlug } from "@/lib/org-slug";
import { appUrl } from "@/lib/app-url";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const fail = (error: string, status = 400) =>
    NextResponse.json({ error }, { status });

  const name = typeof b?.name === "string" ? b.name.trim() : "";
  const company = typeof b?.company === "string" ? b.company.trim() : "";
  const email = normalizeEmail(b?.email);
  const slug = slugify(
    typeof b?.slug === "string" && b.slug ? b.slug : company,
  );

  if (!name || name.length > 100) return fail("Your name is required.");
  if (!company || company.length > 100)
    return fail("Company name is required (max 100 characters).");
  if (!isEmail(email)) return fail("Enter a valid email address.");
  const pwError = validatePassword(b?.password);
  if (pwError) return fail(pwError);
  const slugError = validateSlug(slug);
  if (slugError) return fail(slugError);

  const passwordHash = await hashPassword(b.password);
  const base = appUrl(req);

  try {
    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, passwordHash },
      });
      const org = await tx.organization.create({
        data: { slug, name: company },
      });
      await tx.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "OWNER" },
      });
      return { user, org };
    });
    await createSession(user.id, org.id);

    // After the response, so a slow or failing email never blocks signup.
    after(async () => {
      try {
        await sendVerificationEmail(user, base);
      } catch (err) {
        console.error("Verification email failed", err);
      }
    });

    return NextResponse.json({ slug: org.slug }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return String(err.meta?.target).includes("email")
        ? fail("An account with this email already exists.", 409)
        : fail("That address is already taken.", 409);
    }
    throw err;
  }
}
