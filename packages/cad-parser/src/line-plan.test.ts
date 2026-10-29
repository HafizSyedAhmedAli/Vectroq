import { describe, it, expect } from "vitest";
import {
  dedupeSegments,
  isAxisAligned,
  roomsFromWallSegments,
  segmentsToWalls,
  type Seg,
} from "./line-plan";

const s = (x1: number, y1: number, x2: number, y2: number): Seg => ({
  x1,
  y1,
  x2,
  y2,
});
const outline = [
  s(0, 0, 20, 0),
  s(20, 0, 20, 12),
  s(20, 12, 0, 12),
  s(0, 12, 0, 0),
];
const partition = s(10, 0, 10, 12);

describe("isAxisAligned", () => {
  it("accepts horizontal, vertical and near-straight, rejects diagonals", () => {
    expect(isAxisAligned(s(0, 0, 5, 0))).toBe(true);
    expect(isAxisAligned(s(0, 0, 0, 5))).toBe(true);
    expect(isAxisAligned(s(0, 0, 5, 0.005))).toBe(true);
    expect(isAxisAligned(s(0, 0, 5, 5))).toBe(false);
  });
});

describe("dedupeSegments", () => {
  it("drops duplicates, including reversed ones", () => {
    expect(
      dedupeSegments([s(0, 0, 10, 0), s(10, 0, 0, 0), s(0, 0, 10, 0)]),
    ).toHaveLength(1);
  });
  it("keeps different segments", () => {
    expect(dedupeSegments([s(0, 0, 10, 0), s(0, 0, 0, 10)])).toHaveLength(2);
  });
});

describe("segmentsToWalls", () => {
  it("gives outer walls the exterior thickness and inner ones the partition thickness", () => {
    const walls = segmentsToWalls([...outline, partition], 10, 0.75, 0.375);
    expect(walls).toHaveLength(5);
    expect(walls.slice(0, 4).every((w) => w.thickness === 0.75)).toBe(true);
    expect(walls[4].thickness).toBe(0.375);
    expect(walls[4].length).toBe(12);
    expect(walls.every((w) => w.height === 10)).toBe(true);
    expect(walls.map((w) => w.id)).toEqual([
      "wall-0",
      "wall-1",
      "wall-2",
      "wall-3",
      "wall-4",
    ]);
  });
});

describe("roomsFromWallSegments", () => {
  it("finds two rooms and names them from the labels", () => {
    const rooms = roomsFromWallSegments(
      [...outline, partition],
      [
        { x: 5, y: 5, text: "KITCHEN" },
        { x: 15, y: 5, text: "LIVING ROOM" },
      ],
    );
    expect(rooms).toHaveLength(2);
    const kitchen = rooms.find((r) => r.name === "Kitchen")!;
    expect(kitchen.area).toBe(120);
    expect(kitchen.type).toBe("kitchen");
    expect(kitchen.labelX).toBe(5);
    expect(rooms.find((r) => r.name === "Living Room")!.type).toBe("general");
  });

  it("numbers unlabelled rooms and places labels at their centres", () => {
    const rooms = roomsFromWallSegments([...outline, partition], []);
    expect(rooms.map((r) => r.name).sort()).toEqual(["Room 1", "Room 2"]);
    expect(rooms.map((r) => r.labelX).sort((a, b) => a! - b!)).toEqual([5, 15]);
  });

  it("detects bathrooms by several words and tidies paragraph markers", () => {
    const rooms = roomsFromWallSegments(
      [...outline, partition],
      [
        { x: 5, y: 5, text: "MASTER BATH" },
        { x: 15, y: 5, text: "LIVING\\PROOM" },
      ],
    );
    expect(rooms.find((r) => r.name === "Master Bath")!.type).toBe("bathroom");
    expect(rooms.find((r) => r.name === "Living Room")).toBeDefined();
  });

  it("numbers rooms that end up with the same name", () => {
    const rooms = roomsFromWallSegments(
      [...outline, partition],
      [
        { x: 5, y: 5, text: "BEDROOM" },
        { x: 15, y: 5, text: "Bedroom" },
      ],
    );
    expect(rooms.map((r) => r.name).sort()).toEqual(["Bedroom 1", "Bedroom 2"]);
  });

  it("ignores a label outside the building", () => {
    const rooms = roomsFromWallSegments(outline, [
      { x: 50, y: 5, text: "GARDEN" },
    ]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].name).toBe("Room 1");
  });

  it("merges cells joined through a gap into one room with several shapes", () => {
    const halfWall = s(10, 0, 10, 6);
    const [room] = roomsFromWallSegments([...outline, halfWall], []);
    expect(room.area).toBe(240);
    expect(room.shapes).toHaveLength(4);
  });

  it("returns nothing when the walls don't close", () => {
    expect(
      roomsFromWallSegments(
        [s(0, 0, 20, 0), s(20, 0, 20, 12), s(0, 12, 0, 0)],
        [],
      ),
    ).toEqual([]);
  });

  it("returns nothing for diagonals or no walls", () => {
    expect(roomsFromWallSegments([s(0, 0, 5, 5)], [])).toEqual([]);
    expect(roomsFromWallSegments([], [])).toEqual([]);
  });
});
