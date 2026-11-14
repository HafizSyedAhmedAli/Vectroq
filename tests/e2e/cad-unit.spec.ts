// W2 (unit confirmation and change) and W3 (finalize is refused until the unit is
// confirmed). Fixture facts are listed in support/cad.ts.
import { test, expect } from "./fixtures";
import {
  FIXTURE, boqTotal, calculate, calculateBoq, createCadProject, noBoqYet,
  openProject, projectStatus, savedProject, uploadFixture,
} from "./support/cad";

async function confirmUnit(page: import("@playwright/test").Page, label: RegExp) {
  await page.getByRole("radio", { name: label }).check();
  const done = page.waitForResponse(
    (r) => /\/cad-unit$/.test(r.url()) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirm unit" }).click();
  const res = await done;
  expect(res.status(), await res.text()).toBe(200);
  return res;
}

test("W2: the unit is confirmed through the UI and the confirmation persists", async ({ page, clientIp }) => {
  const { projectId, url } = await createCadProject(page, clientIp);
  await openProject(page, url);
  await uploadFixture(page, FIXTURE.unitless.file); // no unit header in this file

  // Needs confirmation: the picker is shown, no green "confirmed" bar.
  const picker = page.getByTestId("unit-picker");
  await expect(picker).toContainText("Confirm the drawing unit");
  await expect(page.getByTestId("unit-confirmed")).toHaveCount(0);
  const before = await savedProject(page, projectId);
  expect(before.cadFile?.unit?.unit).toMatchObject({
    unit: "millimetre", source: "plausibility", confirmed: false, needsConfirmation: true,
  });

  const res = await confirmUnit(page, /Millimetres/);
  // The request the browser actually sent.
  expect(res.request().postDataJSON()).toMatchObject({
    unit: "millimetre", replaceEditedGeometry: false, expectedRevision: before.cadFile!.revision,
  });

  const confirmedBar = page.getByTestId("unit-confirmed");
  await expect(confirmedBar).toContainText("Drawing unit: Millimetres");
  await expect(confirmedBar).toContainText("confirmed by you");
  await expect(picker).toHaveCount(0);
  await expect(page.getByText(/Unit confirmed and the drawing re-read/)).toBeVisible();

  const after = await savedProject(page, projectId);
  expect(after.cadFile?.unit?.unit).toMatchObject({
    unit: "millimetre", source: "user", confirmed: true, needsConfirmation: false,
  });
  expect(after.cadFile!.revision).toBeGreaterThan(before.cadFile!.revision);

  await page.reload();
  await expect(page.getByTestId("unit-confirmed")).toContainText("confirmed by you");
  await expect(page.getByTestId("unit-picker")).toHaveCount(0);
});

test("W2: changing a confirmed unit warns, clears the BOQ and reverts the project status", async ({ page, clientIp }) => {
  const { projectId, url } = await createCadProject(page, clientIp);
  await openProject(page, url);
  await uploadFixture(page, FIXTURE.unitless.file);
  await confirmUnit(page, /Millimetres/);
  await calculate(page); // priced from the P1 seed (Karachi / B)
  await expect(boqTotal(page)).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Finalized");
  expect((await savedProject(page, projectId)).cadFile?.boq).not.toBeNull();

  // The UI states the consequence before the user commits.
  await page.getByRole("button", { name: "Change unit" }).click();
  await expect(page.getByTestId("unit-picker")).toContainText("deletes any saved BOQ");
  await confirmUnit(page, /Feet/);

  // BOQ gone, status reverted, and the odd choice is flagged for double-checking.
  await expect(noBoqYet(page)).toBeVisible();
  await expect(boqTotal(page)).toHaveCount(0);
  await expect(projectStatus(page)).toHaveText("CAD uploaded");
  await expect(page.getByTestId("unit-confirmed")).toHaveAttribute("data-caution", "true");
  await expect(page.getByLabel("Unit warnings")).toBeVisible();

  const saved = await savedProject(page, projectId);
  expect(saved.cadFile?.boq).toBeNull();
  expect(saved.status).toBe("CAD_UPLOADED");
  expect(saved.cadFile?.unit?.unit).toMatchObject({ unit: "foot", source: "user" });

  await page.reload();
  await expect(noBoqYet(page)).toBeVisible();
  await expect(projectStatus(page)).toHaveText("CAD uploaded");
});

test("W3: the server refuses to finalize an unconfirmed drawing; confirming unblocks it", async ({ page, clientIp }) => {
  const { projectId, url } = await createCadProject(page, clientIp);
  await openProject(page, url);
  await uploadFixture(page, FIXTURE.unitless.file);
  const before = await savedProject(page, projectId);

  // UI: the button is not offered, and the page says why.
  await expect(calculateBoq(page)).toBeDisabled();
  await expect(page.getByText(/Confirm the drawing unit to enable/)).toBeVisible();

  // Backend: bypass the disabled button and call the route directly.
  const res = await page.request.post(`/api/projects/${projectId}/finalize`);
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body).toMatchObject({ code: "UNIT_CONFIRMATION_REQUIRED", reason: "needs-confirmation" });
  expect(body.error).toMatch(/unit is not confirmed/i);
  expect(body.unitState).toBeTruthy();

  // Nothing was written by the refused request.
  const unchanged = await savedProject(page, projectId);
  expect(unchanged.cadFile?.boq).toBeNull();
  expect(unchanged.status).toBe("CAD_UPLOADED");
  expect(unchanged.cadFile?.revision).toBe(before.cadFile!.revision);
  await page.reload();
  await expect(noBoqYet(page)).toBeVisible();
  await expect(calculateBoq(page)).toBeDisabled();

  // Confirm in the UI, then finalize through the UI.
  await confirmUnit(page, /Millimetres/);
  await expect(calculateBoq(page)).toBeEnabled();
  await calculate(page);
  await expect(boqTotal(page)).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Finalized");
  const done = await savedProject(page, projectId);
  expect(done.status).toBe("FINALIZED");
  expect(done.cadFile?.boq).not.toBeNull();
});
