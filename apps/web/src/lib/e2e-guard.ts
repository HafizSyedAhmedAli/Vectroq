// Safety checks for the E2E-only code paths (test database, test DXF storage).
// Pure and dependency-free so both the app and the Playwright harness can use it.
//
// Rule: nothing E2E-specific may switch on unless BOTH an explicit E2E flag is
// set AND the process is demonstrably pointed at a local `*_test` database and
// is not running on Vercel. A production deployment fails both.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Why `url` is NOT a verified test database, or null when it is one. */
export function testDatabaseProblem(url: string | null | undefined): string | null {
  if (!url) return "no database URL is set";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "the database URL is not a valid URL";
  }
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:")
    return `unsupported protocol "${u.protocol}"`;
  if (!LOCAL_HOSTS.has(u.hostname))
    return `host "${u.hostname}" is not local (only localhost / 127.0.0.1 / ::1 are allowed)`;
  const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!/_test$/.test(name))
    return `database "${name}" does not end in "_test"`;
  return null;
}

export function assertTestDatabaseUrl(
  url: string | null | undefined,
  label = "database",
): void {
  const problem = testDatabaseProblem(url);
  if (problem)
    throw new Error(
      `Refusing to continue: the ${label} is not a verified test database: ${problem}.`,
    );
}

type Env = Record<string, string | undefined>;

/** Why E2E mode must not be enabled in this environment, or null when it is safe. */
export function e2eModeProblem(env: Env = process.env): string | null {
  if (env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL)
    return "this looks like a Vercel deployment";
  const db = testDatabaseProblem(env.DATABASE_URL);
  if (db) return `DATABASE_URL: ${db}`;
  if (env.DIRECT_URL) {
    const direct = testDatabaseProblem(env.DIRECT_URL);
    if (direct) return `DIRECT_URL: ${direct}`;
  }
  return null;
}

/** Throws (fails closed) unless E2E mode is explicitly requested and safe. */
export function assertE2EMode(env: Env = process.env): void {
  if (env.VECTROQ_E2E !== "1")
    throw new Error(
      "E2E-only behaviour was requested but VECTROQ_E2E=1 is not set.",
    );
  const problem = e2eModeProblem(env);
  if (problem) throw new Error(`E2E mode refused: ${problem}.`);
}
