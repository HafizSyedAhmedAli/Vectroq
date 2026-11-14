import { describe, it, expect } from "vitest";
import {
  assertE2EMode,
  assertTestDatabaseUrl,
  e2eModeProblem,
  testDatabaseProblem,
} from "./e2e-guard";

const OK = "postgresql://postgres:test@localhost:54330/vectroq_test";

describe("testDatabaseProblem", () => {
  it("accepts a local *_test database", () => {
    expect(testDatabaseProblem(OK)).toBeNull();
    expect(testDatabaseProblem("postgres://u:p@127.0.0.1:5432/x_test?schema=public")).toBeNull();
  });
  it("rejects non-test names, remote hosts and junk", () => {
    expect(testDatabaseProblem("postgresql://u:p@localhost:5432/vectroq")).toMatch(/_test/);
    expect(testDatabaseProblem("postgresql://u:p@localhost:5432/vectroq_test_backup")).toMatch(/_test/);
    expect(testDatabaseProblem("postgresql://u:p@db.example.com:5432/vectroq_test")).toMatch(/not local/);
    expect(testDatabaseProblem("postgresql://u:p@localhost.evil.com/vectroq_test")).toMatch(/not local/);
    expect(testDatabaseProblem("mysql://u:p@localhost/vectroq_test")).toMatch(/protocol/);
    expect(testDatabaseProblem("not a url")).toMatch(/valid/);
    expect(testDatabaseProblem(undefined)).toMatch(/no database URL/);
  });
  it("assert throws for a non-test database", () => {
    expect(() => assertTestDatabaseUrl("postgresql://u:p@localhost/prod", "x")).toThrow(/verified test database/);
    expect(() => assertTestDatabaseUrl(OK)).not.toThrow();
  });
});

describe("E2E mode", () => {
  const safe = { VECTROQ_E2E: "1", DATABASE_URL: OK, DIRECT_URL: OK };
  it("is allowed only with the flag and a local test database", () => {
    expect(() => assertE2EMode(safe)).not.toThrow();
    expect(() => assertE2EMode({ ...safe, VECTROQ_E2E: undefined })).toThrow(/VECTROQ_E2E=1/);
    expect(() => assertE2EMode({ ...safe, VECTROQ_E2E: "true" })).toThrow(/VECTROQ_E2E=1/);
  });
  it("is refused on Vercel or against a non-test database", () => {
    expect(e2eModeProblem({ ...safe, VERCEL: "1" })).toMatch(/Vercel/);
    expect(e2eModeProblem({ ...safe, VERCEL_ENV: "production" })).toMatch(/Vercel/);
    expect(e2eModeProblem({ ...safe, DATABASE_URL: "postgresql://u:p@h.neon.tech/neondb" })).toMatch(/DATABASE_URL/);
    expect(e2eModeProblem({ ...safe, DIRECT_URL: "postgresql://u:p@localhost/vectroq" })).toMatch(/DIRECT_URL/);
    expect(() => assertE2EMode({ ...safe, DATABASE_URL: undefined })).toThrow(/refused/);
  });
});
