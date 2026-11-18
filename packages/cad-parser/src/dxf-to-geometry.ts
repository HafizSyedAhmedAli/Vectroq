// packages/cad-parser/src/dxf-to-geometry.ts
import type {
  ConstructionDefaults,
  Geometry,
  Opening,
  Room,
  RoomType,
  Wall,
} from "@vectroq/shared-types";
import { roomsFromWallSegments, segmentsToWalls } from "./line-plan";
import { normalizeModeBSegments } from "./mode-b-walls";
import { Point2D, distance, pointInPolygon, polygonArea } from "./polygon";
import { snapToWall } from "./place-openings";
import { RawArc, swingFromArc } from "./door-swing";
import { buildModeAEdgeWalls, buildModeAWalls } from "./mode-a-walls";
import type { ParseReport } from "./report";

// --- Layer conventions this parser expects the CAD file to follow ---
// A client's actual drawings may use different layer names; treat these
// as the drawing convention to agree with each drafting team, not a fixed
// industry standard.
export const WALL_LAYER = "WALLS";
export const DOOR_LAYER = "DOORS";
export const WINDOW_LAYER = "WINDOWS";

// Assumptions, not measured values — same figures the reference
// geometry (packages/rate-cards) uses for its house archetype, so a real
// parsed drawing and the ballpark estimate stay on the same footing until
// real wall/opening heights are captured (DXF is inherently 2D — a plan
// view carries no height information at all).
export const WALL_HEIGHT_FT = 10;
export const WALL_THICKNESS_FT = 0.75; // 9 in exterior wall
export const PARTITION_THICKNESS_FT = 0.375; // 4.5 in interior partition
export const DOOR_HEIGHT_FT = 7;
export const WINDOW_HEIGHT_FT = 4;

export const DEFAULT_CONSTRUCTION: ConstructionDefaults = {
  wallHeightFt: WALL_HEIGHT_FT,
  exteriorWallThicknessFt: WALL_THICKNESS_FT,
  partitionThicknessFt: PARTITION_THICKNESS_FT,
  doorHeightFt: DOOR_HEIGHT_FT,
  windowHeightFt: WINDOW_HEIGHT_FT,
};

interface RawVertex {
  x: number;
  y: number;
}

interface RawPolylineEntity {
  type: "LWPOLYLINE";
  layer: string;
  vertices: RawVertex[];
}

interface RawLineEntity {
  type: "LINE";
  layer: string;
  vertices: RawVertex[]; // [start, end]
}

interface RawTextEntity {
  type: "TEXT";
  layer: string;
  startPoint: RawVertex;
  text: string;
}

interface RawOtherEntity {
  type: string;
  layer: string;
  [key: string]: unknown;
}

export type RawEntity =
  | RawPolylineEntity
  | RawLineEntity
  | RawTextEntity
  | RawArcEntity
  | RawOtherEntity;

interface RawArcEntity {
  type: "ARC";
  layer: string;
  center: RawVertex;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface RawDxfDocument {
  entities: RawEntity[];
}

function detectRoomType(label: string): RoomType {
  if (/bath|washroom|toilet/i.test(label)) return "bathroom";
  if (/kitchen/i.test(label)) return "kitchen";
  return "general";
}

// Text labels often carry a trailing computed area ("Kitchen 240 sq ft") —
// strip it for the display name and let the polygon's own geometry be the
// source of truth for area, rather than trusting a number drafted by hand.
function cleanRoomName(label: string): string {
  return label.replace(/\s*\d+(\.\d+)?\s*sq\s*\.?\s*ft\.?\s*$/i, "").trim();
}

// Accept WALL/WALLS, DOOR/DOORS, WINDOW/WINDOWS in any case.
function layerKind(layer: string): "wall" | "door" | "window" | null {
  const l = (layer ?? "").trim().toLowerCase();
  if (/^walls?$/.test(l)) return "wall";
  if (/^doors?$/.test(l)) return "door";
  if (/^windows?$/.test(l)) return "window";
  return null;
}

export function dxfToGeometry(
  dxf: RawDxfDocument,
  d: ConstructionDefaults = DEFAULT_CONSTRUCTION,
  ctx: {
    /** Optional. When given, shared-wall (Mode A) and wall-merge (Mode B) decisions are reported into it. */
    report?: ParseReport;
    /**
     * Opt-in. Mode B merges overlapping wall lines only when this is exactly
     * true, because the merge tolerances are in feet and are meaningless on
     * geometry whose unit is not established. false, undefined, or a missing
     * ctx all skip merging (the previous exact-duplicate removal). parseDxf()
     * passes `!unit.needsConfirmation`.
     */
    unitTrusted?: boolean;
  } = {},
): Geometry {
  const roomPolylines = dxf.entities.filter(
    (e): e is RawPolylineEntity =>
      e.type === "LWPOLYLINE" && layerKind(e.layer) === "wall",
  );
  const labels = dxf.entities.filter(
    (e): e is RawTextEntity =>
      e.type === "TEXT" &&
      layerKind(e.layer) === null &&
      !/^dim/i.test(e.layer ?? ""),
  );
  const doorLines = dxf.entities.filter(
    (e): e is RawLineEntity =>
      e.type === "LINE" && layerKind(e.layer) === "door",
  );
  const windowLines = dxf.entities.filter(
    (e): e is RawLineEntity =>
      e.type === "LINE" && layerKind(e.layer) === "window",
  );

  const doorArcs: RawArc[] = dxf.entities
    .filter(
      (e): e is RawArcEntity =>
        e.type === "ARC" && layerKind(e.layer) === "door",
    )
    .map((e) => ({
      center: e.center,
      radius: e.radius,
      startAngle: e.startAngle,
      endAngle: e.endAngle,
    }));

  const wallLines = dxf.entities.filter(
    (e): e is RawLineEntity =>
      e.type === "LINE" && layerKind(e.layer) === "wall",
  );

  // Drawings made of separate wall LINEs (most real plans) instead of one
  // closed polyline per room.
  if (roomPolylines.length === 0 && wallLines.length > 0) {
    // Each physical wall run is one wall (INV-2): overlapping LINEs are merged
    // (Stage 3a) only when the unit is explicitly trusted, as the tolerances are feet.
    const { wallSegs, legacySegs } = normalizeModeBSegments(
      wallLines.map((l) => ({
        x1: l.vertices[0].x,
        y1: l.vertices[0].y,
        x2: l.vertices[1].x,
        y2: l.vertices[1].y,
      })),
      { merge: ctx.unitTrusted === true, report: ctx.report },
    );
    const walls = segmentsToWalls(
      wallSegs,
      d.wallHeightFt,
      d.exteriorWallThicknessFt,
      d.partitionThicknessFt,
    );
    // Openings snap to the walls exactly as the pipeline built them before
    // merging, so their position, angle and hinge never depend on which
    // contributor of a merged wall came first. (Mode A does the same.)
    const hostWalls = segmentsToWalls(
      legacySegs,
      d.wallHeightFt,
      d.exteriorWallThicknessFt,
      d.partitionThicknessFt,
    );
    const openings: Opening[] = [
      ...doorLines.map((l, i) =>
        toOpening(l, i, "door", d.doorHeightFt, hostWalls, doorArcs),
      ),
      ...windowLines.map((l, i) =>
        toOpening(l, i, "window", d.windowHeightFt, hostWalls, doorArcs),
      ),
    ];
    return {
      walls,
      // Room detection is unchanged by Stage 3a: it reads the pre-merge segments.
      rooms: roomsFromWallSegments(
        legacySegs,
        labels.map((l) => ({
          x: l.startPoint.x,
          y: l.startPoint.y,
          text: l.text,
        })),
      ),
      openings,
    };
  }

  const rooms: Room[] = [];
  const outlines: Point2D[][] = [];

  roomPolylines.forEach((polyline, roomIndex) => {
    const vertices: Point2D[] = polyline.vertices.map((v) => ({
      x: v.x,
      y: v.y,
    }));
    outlines.push(vertices);

    // Rooms come from the original outline, never from the merged walls below.
    const label = labels.find((l) =>
      pointInPolygon({ x: l.startPoint.x, y: l.startPoint.y }, vertices),
    );

    const mean = vertices.reduce(
      (s, v) => ({
        x: s.x + v.x / vertices.length,
        y: s.y + v.y / vertices.length,
      }),
      { x: 0, y: 0 },
    );

    rooms.push({
      id: `room-${roomIndex}`,
      name: label ? cleanRoomName(label.text) : `Room ${roomIndex + 1}`,
      area: polygonArea(vertices),
      type: label ? detectRoomType(label.text) : "general",
      labelX: label ? label.startPoint.x : mean.x,
      labelY: label ? label.startPoint.y : mean.y,
      shapes: [vertices],
    });
  });

  // Each edge of a closed room outline is a wall. A wall shared by two rooms is
  // drawn by both outlines; buildModeAWalls represents each physical run once
  // (INV-2) and leaves every other wall exactly as before.
  const params = {
    height: d.wallHeightFt,
    thickness: d.exteriorWallThicknessFt,
  };
  const walls: Wall[] = buildModeAWalls(outlines, params, ctx.report);
  // Openings snap to the original per-edge walls (as before shared walls were
  // merged), so their placement and angle do not depend on the merge.
  const edgeWalls = buildModeAEdgeWalls(outlines, params);

  const openings: Opening[] = [
    ...doorLines.map((line, i) =>
      toOpening(line, i, "door", d.doorHeightFt, edgeWalls),
    ),
    ...windowLines.map((line, i) =>
      toOpening(line, i, "window", d.windowHeightFt, edgeWalls),
    ),
  ];

  return { walls, rooms, openings };
}

function toOpening(
  line: RawLineEntity,
  index: number,
  type: Opening["type"],
  height: number,
  walls: Wall[],
  arcs: RawArc[] = [],
): Opening {
  const [start, end] = line.vertices;
  const closed =
    type === "door" ? swingFromArc(start, end, arcs)?.closed : undefined;
  const placed = snapToWall(start, end, walls, closed);

  // Only doors swing; a window never carries hinge data.
  if (type === "window") {
    const { hingeX: _hx, hingeY: _hy, openAngle: _oa, ...rest } = placed;
    return {
      id: `${type}-${index}`,
      type,
      width: distance(start, end),
      height,
      ...rest,
    };
  }
  return {
    id: `${type}-${index}`,
    type,
    width: distance(start, end),
    height,
    ...placed,
  };
}
