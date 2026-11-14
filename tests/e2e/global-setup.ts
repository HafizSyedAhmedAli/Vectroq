import fs from "node:fs";
import path from "node:path";
import { prepareTestDb } from "./support/db";
import { AUTH_DIR, E2E_DXF_DIR, assertSafeE2EDatabase } from "./support/env";

const MARKER = ".vectroq-e2e-dxf-store";

// Runs once, before the app server starts being used by tests (webServer is up
// first, but nothing touches it until the projects start).
export default async function globalSetup() {
  assertSafeE2EDatabase();
  await prepareTestDb();

  // Clean the stand-in DXF store, but only a folder we created ourselves.
  if (fs.existsSync(E2E_DXF_DIR)) {
    const entries = fs.readdirSync(E2E_DXF_DIR);
    if (entries.length && !entries.includes(MARKER))
      throw new Error(
        `Refusing to empty ${E2E_DXF_DIR}: it is not an E2E DXF store (no ${MARKER} marker).`,
      );
    fs.rmSync(E2E_DXF_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(E2E_DXF_DIR, { recursive: true });

  // Old sessions died with the database reset.
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(path.join(AUTH_DIR, "x")), { recursive: true });
}
