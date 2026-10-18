import { prisma } from "@vectroq/db";
import { hashPassword } from "../src/lib/auth/credentials";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg("org");
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name") ?? "Owner";
  const password = arg("password");
  if (!slug || !email || !password || password.length < 8) {
    console.error(
      'Usage: create-owner.ts --org <slug> --email <e> --name "<n>" --password <min 8 chars>',
    );
    process.exit(1);
  }
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    console.error(`Organization "${slug}" not found.`);
    process.exit(1);
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash: await hashPassword(password) },
  });
  await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: org.id },
    },
    update: { role: "OWNER" },
    create: { userId: user.id, organizationId: org.id, role: "OWNER" },
  });
  console.log(`${email} is now an owner of ${slug}`);
}

main().finally(() => prisma.$disconnect());
