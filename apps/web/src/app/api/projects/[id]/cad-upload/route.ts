import { NextRequest, NextResponse } from "next/server";
import { resolveOrgRules } from "@vectroq/shared-types";
import { parseDxf, parseUnitChoice, type UnitChoice } from "@vectroq/cad-parser";
import { Prisma, prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { checkFileContent } from "@/lib/upload-guard";
import { audit } from "@/lib/audit";
import { buildUnitState, publicUnitState } from "@/lib/cad-unit";
import { deleteCadDxf, saveCadDxf } from "@/lib/cad-dxf-store";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import {
  CadFileRevisionConflict,
  revisionConflictResponse,
  updateCadFileAtRevision,
} from "@/lib/cad-revision";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const { id: projectId } = await params;

  // Every upload stores up to 10 MB in blob storage, so it is rate limited per
  // user and per organisation (demo organisations are the abuse risk).
  const rlUser = await rateLimit(`cad-upload:user:${g.auth.user.id}`, 20, 3600);
  if (!rlUser.ok) return tooMany(rlUser, "Too many drawing uploads. Try again later.");
  const rlOrg = await rateLimit(
    `cad-upload:org:${g.auth.org.id}`,
    g.auth.org.isDemo ? 10 : 60,
    3600,
  );
  if (!rlOrg.ok) return tooMany(rlOrg, "Too many drawing uploads. Try again later.");

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: g.auth.org.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload must be multipart/form-data with a 'file' field" },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".dxf")) {
    return NextResponse.json(
      {
        error:
          ".dwg files aren't supported yet — DWG-to-DXF conversion isn't available. Please export the plan as .dxf and re-upload.",
      },
      { status: 422 },
    );
  }

  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "The drawing must be between 1 byte and 10 MB." },
      { status: 422 },
    );
  }
  const contentError = await checkFileContent(file, "dxf");
  if (contentError) {
    return NextResponse.json(
      { error: `Could not parse this DXF file: ${contentError}` },
      { status: 422 },
    );
  }

  // Optional unit chosen by the user at upload time. Validated here (422);
  // it is applied by the parser, never copied into stored state directly.
  let confirmedUnit: UnitChoice | undefined;
  const unitField = formData.get("unit");
  if (typeof unitField === "string" && unitField.trim() !== "") {
    try {
      confirmedUnit = parseUnitChoice(unitField);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid drawing unit." },
        { status: 422 },
      );
    }
  }

  const dxfText = await file.text();

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
  const { geometry, meta } = parsed;
  const unitState = buildUnitState(meta);

  // Keep the untouched original so a later unit confirmation can re-parse it.
  let dxfBlobKey: string;
  try {
    dxfBlobKey = await saveCadDxf(projectId, dxfText);
  } catch (err) {
    console.error("Could not store the original DXF", err);
    return NextResponse.json(
      { error: "Could not store the original drawing. Please try again." },
      { status: 502 },
    );
  }

  // Blob first, then ONE transaction for the row and the project status. The
  // previous blob is deleted only after the transaction commits, and the NEW blob
  // is deleted if it does not, so a failed or conflicting upload leaves exactly
  // the old, consistent state behind.
  let cadFile;
  let previousKey: string | null = null;
  try {
    ({ cadFile, previousKey } = await prisma.$transaction(async (tx) => {
      const existing = await tx.cadFile.findUnique({ where: { projectId } });
      const data = {
        fileName: file.name,
        geometry: geometry as unknown as Prisma.InputJsonValue,
        unit: unitState as unknown as Prisma.InputJsonValue,
        dxfBlobKey,
      };
      let row;
      if (existing) {
        // Pinned to the revision just read: if anything wrote in between
        // (a PATCH, a unit change, another upload) this does not match, so the
        // old blob we would delete is exactly the one this write replaced.
        row = await updateCadFileAtRevision(tx, projectId, existing.revision, {
          ...data,
          boq: Prisma.JsonNull,
        });
      } else {
        try {
          row = await tx.cadFile.create({ data: { projectId, format: "dxf", ...data } });
        } catch (err) {
          // Two first uploads raced; the other one won the unique projectId.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
            throw new CadFileRevisionConflict();
          throw err;
        }
      }
      await tx.project.update({
        where: { id: projectId },
        data: { status: "CAD_UPLOADED" },
      });
      return { cadFile: row, previousKey: existing?.dxfBlobKey ?? null };
    }));
  } catch (err) {
    await deleteCadDxf(dxfBlobKey); // the new blob never became referenced
    if (err instanceof CadFileRevisionConflict) return revisionConflictResponse();
    throw err;
  }
  await deleteCadDxf(previousKey);

  await audit(g.auth, "CAD_UPLOADED", "Project", projectId, {
    fileName: file.name,
    rooms: geometry.rooms.length,
    unit: unitState.unit.unit ?? "unknown",
    unitSource: unitState.unit.source,
    unitNeedsConfirmation: publicUnitState(unitState)?.needsConfirmation,
    note: "Any saved BOQ was cleared",
  });

  // The blob key is internal; the browser gets the unit decision instead.
  const { dxfBlobKey: _key, unit: _unit, ...rest } = cadFile as typeof cadFile & {
    dxfBlobKey?: string | null;
    unit?: unknown;
  };
  return NextResponse.json(
    { ...rest, unitState: publicUnitState(unitState) },
    { status: 200 },
  );
}
