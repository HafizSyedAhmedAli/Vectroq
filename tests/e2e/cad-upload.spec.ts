// W1: upload a real DXF through the project page. Real route, real parser, real
// E2E DXF store (see support/cad.ts for what is set-up and what is under test).
import fs from "node:fs";
import { test, expect } from "./fixtures";
import {
  FIXTURE, createCadProject, fixturePath, openProject, projectStatus,
  roomNames, savedProject, storedDxf, uploadFixture, wallLengths,
} from "./support/cad";

test("W1: an uploaded DXF is parsed, shown, stored and survives a reload", async ({ page, clientIp }) => {
  const { projectId, url } = await createCadProject(page, clientIp);
  await openProject(page, url);
  await expect(page.getByText("No drawing yet")).toBeVisible();
  await expect(projectStatus(page)).toHaveText("New");

  // --- upload (UI -> real route) ---
  const res = await uploadFixture(page, FIXTURE.headerFeet.file);
  const body = await res.json();
  expect(body.fileName).toBe(FIXTURE.headerFeet.file);
  expect(body.geometry.rooms).toHaveLength(FIXTURE.headerFeet.rooms);
  expect(body, "the internal blob key must not reach the browser").not.toHaveProperty("dxfBlobKey");

  const assertParsedPlanShown = async () => {
    await expect(page.getByText("Drawing uploaded")).toBeVisible();
    await expect(page.getByText(FIXTURE.headerFeet.file, { exact: true })).toBeVisible();
    await expect(roomNames(page)).toHaveCount(FIXTURE.headerFeet.rooms);
    await expect(wallLengths(page)).toHaveCount(FIXTURE.headerFeet.walls);
    // Parsed unit is shown: the file declares feet in its header.
    const unit = page.getByTestId("unit-confirmed");
    await expect(unit).toContainText("Drawing unit: Feet");
    await expect(unit).toContainText("read from the drawing");
  };
  await assertParsedPlanShown();

  // --- the original went into the E2E store, byte for byte (direct file check) ---
  const stored = storedDxf(projectId);
  expect(stored, "original DXF should be in the E2E DXF store").not.toBeNull();
  expect(stored!.text).toBe(fs.readFileSync(fixturePath(FIXTURE.headerFeet.file), "utf8"));

  // --- what the server saved (direct API read) ---
  const saved = await savedProject(page, projectId);
  expect(saved.status).toBe("CAD_UPLOADED");
  expect(saved.cadFile?.fileName).toBe(FIXTURE.headerFeet.file);
  expect(saved.cadFile?.dxfBlobKey).toMatch(new RegExp(`^cad-dxf/${projectId}-[0-9a-f]+\\.dxf$`));
  expect(saved.cadFile?.unit?.unit).toMatchObject({ unit: "foot", source: "header", needsConfirmation: false });

  // --- reload (UI): same parsed state, and the project status has moved on ---
  await page.reload();
  await expect(projectStatus(page)).toHaveText("CAD uploaded");
  await assertParsedPlanShown();
});
