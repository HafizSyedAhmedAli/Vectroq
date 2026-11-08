// apps/web/src/app/api/projects/[id]/cad-unit/route.ts
// Confirm or change the drawing unit. Re-parses the ORIGINAL stored DXF with the
// chosen unit; the browser never supplies geometry or unit state here.
import { NextRequest, NextResponse } from "next/server";
import { parseDxf, parseUnitChoice } from "@vectroq/cad-parser";
import { Prisma, prisma } from "@vectroq/db";
import { resolveOrgRules } from "@vectroq/shared-types";
import { guard } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import {
  buildUnitState,
  publicUnitState,
  readUnitState,
} from "@/lib/cad-unit";
import { readCadDxf } from "@/lib/cad-dxf-store";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const { id: projectId } = await params;

  let body: { unit?: unknown; replaceEditedGeometry?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  let confirmedUnit;
  try {
    confirmedUnit = parseUnitChoice(body?.unit);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid drawing unit." },
      { status: 422 },
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: g.auth.org.id },
  });
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const cadFile = await prisma.cadFile.findUnique({ where: { projectId } });
  if (!cadFile)
    return NextResponse.json(
      { error: "No CAD file uploaded for this project yet" },
      { status: 404 },
    );

  if (!cadFile.dxfBlobKey) {
    return NextResponse.json(
      {
        error:
          "The original DXF was not stored for this drawing, so its unit cannot be changed here. Re-upload the DXF and choose the unit.",
        code: "ORIGINAL_DXF_UNAVAILABLE",
      },
      { status: 409 },
    );
  }

  // Replacing geometry discards manual corrections: require an explicit decision.
  const previous = readUnitState(cadFile.unit);
  if (previous?.geometryEditedAt && body.replaceEditedGeometry !== true) {
    return NextResponse.json(
      {
        error:
          "This drawing has manual corrections. Applying a unit re-reads the original file and will replace them. Confirm that you want to discard them to continue.",
        code: "MANUAL_EDITS_WOULD_BE_LOST",
      },
      { status: 409 },
    );
  }

  const dxfText = await readCadDxf(cadFile.dxfBlobKey);
  if (dxfText === null) {
    return NextResponse.json(
      {
        error:
          "The stored original DXF could not be read. Re-upload the DXF and choose the unit.",
        code: "ORIGINAL_DXF_UNAVAILABLE",
      },
      { status: 409 },
    );
  }

  let parsed;
  try {
    parsed = parseDxf(dxfText, {
      construction: resolveOrgRules(g.auth.org.rules).construction,
      confirmedUnit,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Could not parse this DXF file: ${err instanceof Error ? err.message : "unknown error"}`,
      },
      { status: 422 },
    );
  }
  const unitState = buildUnitState(parsed.meta);

  const updated = await prisma.cadFile.update({
    where: { projectId },
    data: {
      geometry: parsed.geometry as unknown as object,
      unit: unitState as unknown as object,
      boq: Prisma.JsonNull, // any BOQ priced under another unit is stale
    },
  });
  // The cleared BOQ means the project is no longer finalized.
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "CAD_UPLOADED" },
  });

  await audit(g.auth, "CAD_UNIT_CONFIRMED", "Project", projectId, {
    unit: unitState.unit.unit,
    feetPerUnit: unitState.unit.feetPerUnit,
    previousUnit: previous?.unit.unit ?? null,
    discardedManualEdits: previous?.geometryEditedAt !== undefined,
    note: "Any saved BOQ was cleared",
  });

  const { dxfBlobKey: _key, unit: _unit, ...rest } = updated as typeof updated & {
    dxfBlobKey?: string | null;
    unit?: unknown;
  };
  return NextResponse.json(
    { ...rest, unitState: publicUnitState(unitState) },
    { status: 200 },
  );
}
