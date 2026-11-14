// Helpers for the CAD specs. Each test builds its OWN company, user, lead and
// project, so no test can see or change another test's data.
//
// What is real and what is set-up:
//  - Real, under test: the upload, unit, geometry and finalize routes, the parser,
//    the E2E DXF store and the project page UI.
//  - Set-up only: the company/user (real signup route), the lead (inserted into the
//    verified test database, because the only other way in is the public form, which
//    needs the Turnstile widget and internet), and the project (real POST /api/projects).
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "../fixtures";
import { E2E_DXF_DIR, REPO_ROOT } from "./env";
import { openTestDb } from "./db";

/** Existing parser fixtures, used as-is. Properties verified against the parser:
 *
 *  sample-house.dxf (15 KB): header $INSUNITS=2 (feet). Parses as unit "foot",
 *    source "header", needsConfirmation false (so it can be priced at once).
 *    3 rooms (Kitchen, Living Room, Bathroom), 12 walls, 2 openings.
 *
 *  whole_house_simple_plan.dxf (2.4 KB): no unit header. Parses as "millimetre",
 *    source "plausibility", needsConfirmation true. 7 rooms (first: "Bath 1"),
 *    12 walls. Confirmed as millimetres every room is 43-339 sq ft; read as feet
 *    the areas are in the millions (parser raises UNIT_CONFIRMED_IMPLAUSIBLE).
 *
 *  apps/web/src/lib/e2e-cad-fixtures.test.ts fails fast if these ever drift. */
export const FIXTURE = {
  headerFeet: { file: "sample-house.dxf", rooms: 3, walls: 12 },
  unitless: { file: "whole_house_simple_plan.dxf", rooms: 7, walls: 12 },
} as const;

export const fixturePath = (file: string) =>
  path.join(REPO_ROOT, "packages", "cad-parser", "fixtures", file);

type Prisma = Awaited<ReturnType<typeof openTestDb>>;
let db: Promise<Prisma> | undefined;
const testDb = () => (db ??= openTestDb());

export interface CadProject {
  projectId: string;
  url: string;
}

/** New company + owner (signed in on `page`) + lead + project (status NEW). */
export async function createCadProject(
  page: Page,
  clientIp: string,
): Promise<CadProject> {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const signup = await page.request.post("/api/auth/signup", {
    headers: { "x-forwarded-for": clientIp }, // signup is limited per IP
    data: {
      name: "CAD Owner",
      email: `cad+${stamp}@example.com`,
      password: "Sup3rSecret!pass",
      company: `Cad Co ${stamp}`,
    },
  });
  expect(signup.status(), await signup.text()).toBe(201);
  const { slug } = (await signup.json()) as { slug: string };

  const prisma = await testDb();
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug } });
  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      name: `CAD Client ${stamp}`,
      contact: "0300-0000000",
      city: "Karachi",
      model: 2,
      category: "B",
      consent: true,
      source: "E2E",
    },
  });
  const res = await page.request.post("/api/projects", {
    data: { leadId: lead.id, model: 2, category: "B", city: "Karachi" },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { id } = (await res.json()) as { id: string };
  return { projectId: id, url: `/office/${id}` };
}

/** Uploads a fixture through the real file input and waits for the real route. */
export async function uploadFixture(page: Page, file: string) {
  const done = page.waitForResponse(
    (r) => /\/cad-upload$/.test(r.url()) && r.request().method() === "POST",
  );
  await page.locator("#cad-file").setInputFiles(fixturePath(file));
  const res = await done;
  expect(res.status(), await res.text()).toBe(200);
  return res;
}

/** What the server has saved, read through the app's own authenticated API. */
export async function savedProject(page: Page, projectId: string) {
  const res = await page.request.get(`/api/projects/${projectId}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    status: string;
    cadFile: null | {
      revision: number;
      fileName: string;
      boq: null | { total: number };
      geometry: { rooms: { name: string; area: number }[] };
      unit: null | { unit: { unit: string; source: string; confirmed: boolean; needsConfirmation: boolean } };
      dxfBlobKey: string | null;
    };
  };
}

/** The stored original for a project in the E2E DXF folder (null when absent). */
export function storedDxf(projectId: string): { file: string; text: string } | null {
  const dir = path.join(E2E_DXF_DIR, "cad-dxf");
  if (!fs.existsSync(dir)) return null;
  const name = fs.readdirSync(dir).find((f) => f.startsWith(`${projectId}-`));
  return name
    ? { file: name, text: fs.readFileSync(path.join(dir, name), "utf8") }
    : null;
}

export const roomNames = (page: Page) => page.getByLabel(/^Room \d+ name$/);
export const wallLengths = (page: Page) => page.getByLabel(/^Wall \d+ length$/);
export const projectStatus = (page: Page) => page.getByTestId("project-status");
export const calculateBoq = (page: Page) =>
  page.getByRole("button", { name: "Calculate BOQ" });

/** A priced BOQ is on the page (its totals row) / the empty state is shown. */
export const boqTotal = (page: Page) => page.getByText("Total estimated cost");
export const noBoqYet = (page: Page) => page.getByText("No BOQ yet");

/** Clicks Calculate BOQ and waits for the real finalize response. */
export async function calculate(page: Page) {
  const done = page.waitForResponse(
    (r) => /\/finalize$/.test(r.url()) && r.request().method() === "POST",
  );
  await calculateBoq(page).click();
  const res = await done;
  expect(res.status(), await res.text()).toBe(200);
}

/** Waits until React has attached to the upload input (a real hydration signal),
 *  so a click or file choice made right after navigation is not silently lost. */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#cad-file");
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
  });
}

/** Opens a project page and waits until it is interactive. */
export async function openProject(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
}
