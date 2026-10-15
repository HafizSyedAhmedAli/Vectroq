// packages/cad-parser/src/dxf-to-geometry.ts
import type {
  Geometry,
  Opening,
  Room,
  RoomType,
  Wall,
} from "@tmcc/shared-types";
import {
  dedupeSegments,
  roomsFromWallSegments,
  segmentsToWalls,
  type Seg,
} from "./line-plan";
import { Point2D, distance, pointInPolygon, polygonArea } from "./polygon";
import { snapToWall } from "./place-openings";

// --- Layer conventions this parser expects the CAD file to follow ---
// A client's actual drawings may use different layer names; treat these
// as the contract to confirm with TM CC's drafting team, not a fixed
// industry standard.
export const WALL_LAYER = "WALLS";
export const DOOR_LAYER = "DOORS";
export const WINDOW_LAYER = "WINDOWS";

// Assumptions, not measured values — same figures the Phase-1 reference
// geometry (packages/rate-cards) uses for its house archetype, so a real
// parsed drawing and the ballpark estimate stay on the same footing until
// real wall/opening heights are captured (DXF is inherently 2D — a plan
// view carries no height information at all).
export const WALL_HEIGHT_FT = 10;
export const WALL_THICKNESS_FT = 0.75; // 9 in exterior wall
export const PARTITION_THICKNESS_FT = 0.375; // 4.5 in interior partition
export const DOOR_HEIGHT_FT = 7;
export const WINDOW_HEIGHT_FT = 4;

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
  | RawOtherEntity;

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

export function dxfToGeometry(dxf: RawDxfDocument): Geometry {
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
  const wallLines = dxf.entities.filter(
    (e): e is RawLineEntity =>
      e.type === "LINE" && layerKind(e.layer) === "wall",
  );

  // Drawings made of separate wall LINEs (most real plans) instead of one
  // closed polyline per room.
  if (roomPolylines.length === 0 && wallLines.length > 0) {
    const segs: Seg[] = dedupeSegments(
      wallLines.map((l) => ({
        x1: l.vertices[0].x,
        y1: l.vertices[0].y,
        x2: l.vertices[1].x,
        y2: l.vertices[1].y,
      })),
    );
    const walls = segmentsToWalls(
      segs,
      WALL_HEIGHT_FT,
      WALL_THICKNESS_FT,
      PARTITION_THICKNESS_FT,
    );
    const openings: Opening[] = [
      ...doorLines.map((l, i) =>
        toOpening(l, i, "door", DOOR_HEIGHT_FT, walls),
      ),
      ...windowLines.map((l, i) =>
        toOpening(l, i, "window", WINDOW_HEIGHT_FT, walls),
      ),
    ];
    return {
      walls,
      rooms: roomsFromWallSegments(
        segs,
        labels.map((l) => ({
          x: l.startPoint.x,
          y: l.startPoint.y,
          text: l.text,
        })),
      ),
      openings,
    };
  }

  const walls: Wall[] = [];
  const rooms: Room[] = [];

  roomPolylines.forEach((polyline, roomIndex) => {
    const vertices: Point2D[] = polyline.vertices.map((v) => ({
      x: v.x,
      y: v.y,
    }));

    // Each edge of the closed room outline becomes one wall segment. Note:
    // a wall shared between two adjacent rooms is currently counted once
    // per room it borders — confirm with TM CC whether shared partition
    // walls should be deduplicated before this feeds a client-facing BOQ.
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      if (start.x === end.x && start.y === end.y) continue; // closing point repeats the first vertex
      walls.push({
        id: `wall-${roomIndex}-${i}`,
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
        length: distance(start, end),
        height: WALL_HEIGHT_FT,
        thickness: WALL_THICKNESS_FT,
      });
    }

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
    });
  });

  const openings: Opening[] = [
    ...doorLines.map((line, i) =>
      toOpening(line, i, "door", DOOR_HEIGHT_FT, walls),
    ),
    ...windowLines.map((line, i) =>
      toOpening(line, i, "window", WINDOW_HEIGHT_FT, walls),
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
): Opening {
  const [start, end] = line.vertices;
  return {
    id: `${type}-${index}`,
    type,
    width: distance(start, end),
    height,
    ...snapToWall(start, end, walls),
  };
}
