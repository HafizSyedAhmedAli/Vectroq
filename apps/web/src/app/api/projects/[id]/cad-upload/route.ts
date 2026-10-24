import { NextRequest, NextResponse } from "next/server";
import { resolveOrgRules } from "@vectroq/shared-types";
import { parseDxfToGeometry } from "@vectroq/cad-parser";
import { Prisma, prisma } from "@vectroq/db";
import { guard } from "@/lib/auth/guard";
import { checkFileContent } from "@/lib/upload-guard";
import { audit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  const { id: projectId } = await params;

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

  const dxfText = await file.text();

  let geometry;
  try {
    geometry = parseDxfToGeometry(
      dxfText,
      resolveOrgRules(g.auth.org.rules).construction,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `Could not parse this DXF file: ${err instanceof Error ? err.message : "unknown error"}`,
      },
      { status: 422 },
    );
  }

  const cadFile = await prisma.cadFile.upsert({
    where: { projectId },
    create: {
      projectId,
      fileName: file.name,
      format: "dxf",
      geometry: geometry as unknown as object,
    },
    update: {
      fileName: file.name,
      geometry: geometry as unknown as object,
      boq: Prisma.JsonNull,
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "CAD_UPLOADED" },
  });

  await audit(g.auth, "CAD_UPLOADED", "Project", projectId, {
    fileName: file.name,
    rooms: geometry.rooms.length,
    note: "Any saved BOQ was cleared",
  });

  return NextResponse.json(cadFile, { status: 200 });
}
