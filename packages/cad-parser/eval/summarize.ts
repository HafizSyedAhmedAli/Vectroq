import type { Geometry } from "@vectroq/shared-types";

export interface GeometrySummary {
  walls: number;
  rooms: number;
  doors: number;
  windows: number;
  bathrooms: number;
  totalWallFt: number;
  totalRoomAreaSqFt: number;
}

export function summarizeGeometry(g: Geometry): GeometrySummary {
  return {
    walls: g.walls.length,
    rooms: g.rooms.length,
    doors: g.openings.filter((o) => o.type === "door").length,
    windows: g.openings.filter((o) => o.type === "window").length,
    bathrooms: g.rooms.filter((r) => r.type === "bathroom").length,
    totalWallFt: g.walls.reduce((s, w) => s + w.length, 0),
    totalRoomAreaSqFt: g.rooms.reduce((s, r) => s + r.area, 0),
  };
}
