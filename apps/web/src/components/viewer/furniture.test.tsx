import { describe, it, expect } from "vitest";
import * as THREE from "three";
import type { Geometry, Room } from "@vectroq/shared-types";
import { CATEGORY_FINISH } from "./finishes";
import { createFurnitureMaterials, Ceilings, Furniture } from "./furniture";
import { layoutFurniture } from "./furniture-layout";

const box = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const room = (id: string, name: string, type: Room["type"], w: number, h: number, ox = 0): Room => ({
  id,
  name,
  type,
  area: w * h,
  shapes: [box(ox, 0, ox + w, h)],
});

describe("createFurnitureMaterials", () => {
  it("builds every material as a MeshStandardMaterial", () => {
    const m = createFurnitureMaterials(CATEGORY_FINISH.B);
    for (const k of ["wood", "cabinet", "sofa", "mattress", "bedding", "porcelain", "steel", "black", "mirror", "counterTop", "splash", "ceiling", "ceilingPanel", "cove"] as const)
      expect(m[k]).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it("takes wood, cabinet, sofa and bedding colours from the category finish", () => {
    const m = createFurnitureMaterials(CATEGORY_FINISH.A);
    expect(m.wood.color.getHexString()).toBe("6b4426");
    expect(m.cabinet.color.getHexString()).toBe("4a3b32");
    expect(m.sofa.color.getHexString()).toBe("7a6a58");
    expect(m.bedding.color.getHexString()).toBe("c9b79c");
  });

  it("uses a dark glossy granite counter for A and B, a pale matte laminate for C", () => {
    const granite = createFurnitureMaterials(CATEGORY_FINISH.A).counterTop;
    const laminate = createFurnitureMaterials(CATEGORY_FINISH.C).counterTop;
    expect(granite.color.getHexString()).toBe("2c2f33");
    expect(granite.metalness).toBeCloseTo(0.1);
    expect(laminate.color.getHexString()).toBe("d9d3c7");
    expect(laminate.roughness).toBeCloseTo(0.6);
  });

  it("makes the ceilings double-sided and the cove light emissive", () => {
    const m = createFurnitureMaterials(CATEGORY_FINISH.A);
    expect(m.ceiling.side).toBe(THREE.DoubleSide);
    expect(m.ceilingPanel.side).toBe(THREE.DoubleSide);
    expect(m.cove.emissiveIntensity).toBeCloseTo(1.6);
  });

  it("dispose releases every material", () => {
    const m = createFurnitureMaterials(CATEGORY_FINISH.B);
    let disposed = 0;
    m.wood.addEventListener("dispose", () => disposed++);
    m.sofa.addEventListener("dispose", () => disposed++);
    m.dispose();
    expect(disposed).toBe(2);
  });
});

// Needs: pnpm --filter @vectroq/web add -D @react-three/test-renderer
describe("Furniture and Ceilings (react-three test renderer)", async () => {
  const { default: R3F } = await import("@react-three/test-renderer");
  const geometry: Geometry = {
    walls: [],
    openings: [],
    rooms: [
      room("r1", "Bedroom 1", "general", 12, 12),
      room("r2", "Bath", "bathroom", 6, 8, 20),
      { id: "r3", name: "No shape", type: "general", area: 50 },
    ],
  };
  const mats = createFurnitureMaterials(CATEGORY_FINISH.B);

  it("places one group per laid-out piece", async () => {
    const expected = geometry.rooms.flatMap((r) => layoutFurniture(r, geometry.openings)).length;
    const r = await R3F.create(<Furniture geometry={geometry} cx={0} cy={0} mats={mats} />);
    expect(expected).toBeGreaterThan(2);
    expect(r.scene.children[0].children).toHaveLength(expected);
  });

  it("renders nothing for a house with no rooms", async () => {
    const r = await R3F.create(
      <Furniture geometry={{ walls: [], rooms: [], openings: [] }} cx={0} cy={0} mats={mats} />,
    );
    expect(r.scene.children[0].children).toHaveLength(0);
  });

  it("gives every room that has a floor outline a ceiling", async () => {
    const r = await R3F.create(
      <Ceilings geometry={geometry} cx={0} cy={0} height={10} finish={CATEGORY_FINISH.A} mats={mats} />,
    );
    expect(r.scene.children[0].children).toHaveLength(2);
  });
});