// Optimistic concurrency for CadFile (docs/dxf-units.md, "Concurrency").
//
// CadFile.revision is an integer that every write advances. A writer reads the
// row, remembers its revision, and writes with `updateMany WHERE projectId AND
// revision = <remembered>`. Zero matched rows means somebody else wrote first:
// the caller gets 409 CAD_FILE_REVISION_CONFLICT and nothing is overwritten.
//
// Why updateMany + WHERE is enough under Postgres READ COMMITTED (Prisma's
// default): an UPDATE locks the row, and if another transaction committed first
// the UPDATE re-evaluates its WHERE against the new row version, so a stale
// revision matches nothing. Wrapping the read in a transaction alone would NOT
// do this; the conditional WHERE is what closes the race.
import { NextResponse } from "next/server";
import { Prisma, prisma } from "@vectroq/db";

export const REVISION_CONFLICT_CODE = "CAD_FILE_REVISION_CONFLICT";

export class CadFileRevisionConflict extends Error {
  constructor() {
    super("The drawing was changed by another request.");
    this.name = "CadFileRevisionConflict";
  }
}

export function revisionConflictResponse() {
  return NextResponse.json(
    {
      error:
        "This drawing was changed somewhere else (another tab, an upload, or a unit change) since you loaded it. Nothing was overwritten. Reload the page to see the latest version, then try again.",
      code: REVISION_CONFLICT_CODE,
    },
    { status: 409 },
  );
}

/** Reads a client-supplied revision: a non-negative integer, else null. */
export function parseRevision(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0
    ? raw
    : null;
}

export function revisionRequiredResponse() {
  return NextResponse.json(
    {
      error:
        "The request must include the drawing revision you loaded (expectedRevision). Reload the page and try again.",
      code: "CAD_FILE_REVISION_REQUIRED",
    },
    { status: 400 },
  );
}

type Tx = Prisma.TransactionClient;

/**
 * Writes `data` to the CadFile only if its revision is still `expected`, and
 * advances the revision. Throws CadFileRevisionConflict otherwise.
 * Returns the row as written.
 */
export async function updateCadFileAtRevision(
  tx: Tx,
  projectId: string,
  expected: number,
  data: Prisma.CadFileUpdateManyMutationInput,
) {
  const res = await tx.cadFile.updateMany({
    where: { projectId, revision: expected },
    data: { ...data, revision: { increment: 1 } },
  });
  if (res.count !== 1) throw new CadFileRevisionConflict();
  const row = await tx.cadFile.findUnique({ where: { projectId } });
  if (!row) throw new CadFileRevisionConflict();
  return row;
}

/**
 * Saves a priced BOQ and marks the project FINALIZED in ONE transaction, only if
 * the drawing is still at the revision that was priced. A stale BOQ is never saved.
 */
export function commitBoqAtRevision(
  projectId: string,
  expected: number,
  boq: object,
) {
  return prisma.$transaction(async (tx) => {
    const row = await updateCadFileAtRevision(tx, projectId, expected, {
      boq: boq as Prisma.InputJsonValue,
    });
    await tx.project.update({
      where: { id: projectId },
      data: { status: "FINALIZED" },
    });
    return row;
  });
}

/** Runs `fn`; converts a revision conflict into the 409 response. */
export async function withRevisionConflict<T>(
  fn: () => Promise<T>,
): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CadFileRevisionConflict) return revisionConflictResponse();
    throw err;
  }
}
