// Test-database lifecycle: verify identity, migrate, reset, seed.
// Every destructive step runs only after the database has been verified as a
// local *_test database, both by URL and by asking the server itself.
import { execFileSync } from "node:child_process";
import { REPO_ROOT, E2E_DATABASE_URL, assertSafeE2EDatabase } from "./env";
import { seedRateSets } from "./seed";

type Prisma = typeof import("../../../packages/db/src/index").prisma;

export async function openTestDb(): Promise<Prisma> {
  assertSafeE2EDatabase();
  // @vectroq/db builds its client from the environment, so point it at the
  // verified test database BEFORE importing it.
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DIRECT_URL = E2E_DATABASE_URL;
  const { prisma } = await import("../../../packages/db/src/index");
  // Ask the server who it is: the URL alone could be a tunnel or an alias.
  const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  const name = rows[0]?.db ?? "";
  if (!/_test$/.test(name)) {
    await prisma.$disconnect();
    throw new Error(
      `Refusing to reset: the connected server reports database "${name}", which does not end in "_test".`,
    );
  }
  return prisma;
}

/** Idempotent. Same command as the README. */
export function migrateTestDb(): void {
  assertSafeE2EDatabase();
  execFileSync("pnpm", ["--filter", "@vectroq/db", "exec", "prisma", "migrate", "deploy"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32", // pnpm is a .cmd shim on Windows
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL },
  });
}

/** Empties every application table (not Prisma's migration history). */
export async function resetTestDb(prisma: Prisma): Promise<number> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0)
    throw new Error("The test database has no tables: run the migrations first.");
  const list = tables.map((t) => `"public"."${t.tablename.replace(/"/g, '""')}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  return tables.length;
}

export async function prepareTestDb(): Promise<void> {
  assertSafeE2EDatabase();
  migrateTestDb();
  const prisma = await openTestDb();
  try {
    const n = await resetTestDb(prisma);
    await seedRateSets(prisma);
    console.log(`[e2e] test database reset (${n} tables) and seeded`);
  } finally {
    await prisma.$disconnect();
  }
}
