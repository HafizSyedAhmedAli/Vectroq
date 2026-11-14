// W4 (geometry edit persists) and W5 (a geometry edit invalidates the BOQ).
// Exact quantities and prices are NOT asserted here; unit tests own those.
import { test, expect } from "./fixtures";
import {
  FIXTURE, boqTotal, calculate, calculateBoq, createCadProject, noBoqYet,
  openProject, projectStatus, roomNames, savedProject, uploadFixture,
} from "./support/cad";

const NEW_NAME = "E2E Edited Room";
const NEW_AREA = "321";

async function editFirstRoomAndSave(page: import("@playwright/test").Page) {
  await page.getByLabel("Room 1 name").fill(NEW_NAME);
  await page.getByLabel("Room 1 area").fill(NEW_AREA);
  const done = page.waitForResponse(
    (r) => /\/geometry$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save corrections" }).click();
  const res = await done;
  expect(res.status(), await res.text()).toBe(200);
  return res;
}

test("W4: a saved geometry edit is reflected, advances the revision and persists", async ({ page, clientIp }) => {
  const { projectId, url } = await createCadProject(page, clientIp);
  await openProject(page, url);
  await uploadFixture(page, FIXTURE.headerFeet.file);
  const before = await savedProject(page, projectId);

  const res = await editFirstRoomAndSave(page);
  // The browser sends the revision it loaded; the server answers with the next one.
  expect(res.request().postDataJSON().expectedRevision).toBe(before.cadFile!.revision);
  expect((await res.json()).revision).toBe(before.cadFile!.revision + 1);
  await expect(page.getByText("Corrections saved.")).toBeVisible();

  const saved = await savedProject(page, projectId);
  expect(saved.cadFile!.revision).toBe(before.cadFile!.revision + 1);
  expect(saved.cadFile!.geometry.rooms[0]).toMatchObject({ name: NEW_NAME, area: Number(NEW_AREA) });
  // An edit never confirms a unit: the header-declared unit is untouched.
  expect(saved.cadFile?.unit?.unit).toMatchObject({ source: "header", confirmed: false });

  await page.reload();
  await expect(page.getByLabel("Room 1 name")).toHaveValue(NEW_NAME);
  await expect(page.getByLabel("Room 1 area")).toHaveValue(NEW_AREA);
  await expect(roomNames(page)).toHaveCount(FIXTURE.headerFeet.rooms);
  await expect(page.getByTestId("unit-confirmed")).toContainText("read from the drawing");
});

test("W5: saving a geometry edit invalidates the BOQ, and a new one can be calculated", async ({ page, clientIp }) => {
  const { projectId, url } = await createCadProject(page, clientIp);
  await openProject(page, url);
  await uploadFixture(page, FIXTURE.headerFeet.file);

  // A real BOQ, priced from the P1 seed.
  await calculate(page);
  await expect(boqTotal(page)).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Finalized");
  const priced = await savedProject(page, projectId);
  expect(priced.status).toBe("FINALIZED");
  expect(priced.cadFile?.boq?.total).toBeGreaterThan(0);

  await editFirstRoomAndSave(page);
  await expect(page.getByText(/previous BOQ was cleared/)).toBeVisible();
  await expect(noBoqYet(page)).toBeVisible();
  await expect(boqTotal(page)).toHaveCount(0);
  await expect(projectStatus(page)).toHaveText("CAD uploaded");

  // Persisted, not just on screen.
  const cleared = await savedProject(page, projectId);
  expect(cleared.cadFile?.boq).toBeNull();
  expect(cleared.status).toBe("CAD_UPLOADED");
  expect(cleared.cadFile!.revision).toBe(priced.cadFile!.revision + 1);

  await page.reload();
  await expect(noBoqYet(page)).toBeVisible();
  await expect(boqTotal(page)).toHaveCount(0);
  await expect(projectStatus(page)).toHaveText("CAD uploaded");
  await expect(page.getByLabel("Room 1 name")).toHaveValue(NEW_NAME);

  // The normal workflow continues: calculate again.
  await expect(calculateBoq(page)).toBeEnabled();
  await calculate(page);
  await expect(boqTotal(page)).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Finalized");
  expect((await savedProject(page, projectId)).cadFile?.boq).not.toBeNull();
});
