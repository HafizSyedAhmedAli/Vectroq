// packages/cad-parser/src/mode-b-walls.ts
// Phase 2 Stage 3a: wall uniqueness for Mode B (walls drawn as separate LINEs).
import { dedupeSegments, type Seg } from "./line-plan";
import {
  mergeCollinear,
  type MergeInputSeg,
  type MergeOptions,
  type MergeRefusalReason,
} from "./normalize-segments";
import type { ParseReport } from "./report";

/**
 * Explicit Stage 3a tolerances. All lengths are FEET, so they are only
 * meaningful on geometry whose unit is trusted (see `merge` below).
 * offsetTol, angleTol and minOverlap are the approved Stage 3a values;
 * faceOffsetMax and ambiguousAngleMax only matter when segments carry a
 * `side`, which Mode B never supplies, and are pinned to the Stage 1 defaults.
 */
export const MODE_B_MERGE_OPTIONS: Required<MergeOptions> = {
  offsetTol: 0.05,
  angleTolRad: (0.5 * Math.PI) / 180,
  minOverlap: 0.1,
  faceOffsetMax: 1.125,
  ambiguousAngleMaxRad: (5 * Math.PI) / 180,
};

const REFUSAL_CODE: Record<MergeRefusalReason, string> = {
  SAME_SIDE_OVERLAP: "WALL_SAME_SIDE_OVERLAP",
  FACE_OFFSET: "WALL_FACE_OFFSET",
  ANGLE_AMBIGUOUS: "WALL_ANGLE_AMBIGUOUS",
  CONFLICT_IN_GROUP: "WALL_MERGE_CONFLICT",
  CHAIN_DRIFT: "WALL_MERGE_CONFLICT",
  LAYER_MISMATCH: "WALL_MERGE_CONFLICT",
  THICKNESS_MISMATCH: "WALL_MERGE_CONFLICT",
};

/** Cap so a pathological drawing cannot flood the report. */
const MAX_REFUSAL_WARNINGS = 25;

export interface ModeBSegments {
  /** Segments the output walls are built from (each physical run once, when merging is on). */
  wallSegs: Seg[];
  /**
   * The segments the pipeline used before Stage 3a (exact/reversed duplicates
   * dropped only). Openings snap to walls built from these and rooms are
   * detected from them, so neither depends on how walls were merged.
   */
  legacySegs: Seg[];
}

/**
 * Turns the raw wall LINEs into the segments Mode B builds walls from.
 *
 * merge = true : mergeCollinear WITHOUT `side` (Mode B has no interior-side
 *                information) and the explicit tolerances above.
 * merge = false: the previous behaviour, exact/reversed duplicate removal only.
 *                Used when the drawing's unit is not trustworthy yet, because
 *                the tolerances are in feet.
 *
 * Wall ids are unchanged (`wall-${i}` over the output, assigned later by
 * segmentsToWalls). Provenance from the merge is reported through warnings and
 * stats only.
 */
export function normalizeModeBSegments(
  raw: Seg[],
  opts: { merge: boolean; report?: ParseReport },
): ModeBSegments {
  const legacySegs = dedupeSegments(raw);
  const { report } = opts;
  if (!opts.merge) {
    // A stat, not a warning: the unit-confirmation warning already tells the
    // user the geometry is provisional, and merging happens once it is confirmed.
    if (raw.length > 1) report?.stat("wallMergeSkippedUnitUnconfirmed", 1);
    return { wallSegs: legacySegs, legacySegs };
  }

  const input: MergeInputSeg[] = raw.map((s, i) => ({
    id: `line-${i}`,
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
  }));
  const res = mergeCollinear(input, MODE_B_MERGE_OPTIONS);
  const wallSegs: Seg[] = res.segs.map((s) => ({
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
  }));

  if (report) {
    if (res.skipped.length > 0) {
      const shown = res.skipped.slice(0, 5).map((s) => s.id);
      report.warning(
        "WALL_DEGENERATE_LINE",
        `${res.skipped.length} wall line(s) have no length or an invalid coordinate (${shown.join(", ")}${res.skipped.length > shown.length ? ", ..." : ""}); they were left as drawn and not merged.`,
      );
    }

    let shownRefusals = 0;
    let suppressed = 0;
    for (const r of res.refusals) {
      if (shownRefusals >= MAX_REFUSAL_WARNINGS) {
        suppressed++;
        continue;
      }
      shownRefusals++;
      report.warning(
        REFUSAL_CODE[r.reason],
        `Wall lines ${r.aId} and ${r.bId} overlap but were kept separate (${r.reason}: ${r.detail}). Both were kept as drawn, so the overlap may be counted twice.`,
        { kind: "wall", id: r.aId },
      );
    }
    if (suppressed > 0)
      report.warning(
        "WALL_MERGE_REFUSALS_TRUNCATED",
        `${suppressed} more overlapping wall line pairs were kept separate.`,
      );

    // Only what the merge really removed: contributors beyond the first, and
    // the length of the duplicated runs.
    let absorbed = 0;
    let removedLength = 0;
    for (const m of res.merges) {
      absorbed += m.sources.length - 1;
      removedLength += m.removedLength;
    }
    if (absorbed > 0) {
      report.stat("wallsMerged", absorbed);
      report.stat("wallLengthRemovedFt", Math.round(removedLength * 1e6) / 1e6);
    }
  }

  return { wallSegs, legacySegs };
}
