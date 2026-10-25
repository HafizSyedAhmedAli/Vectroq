import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { createHouseMaterials } from "./materials";

function fakeCtx() {
  const grad = { addColorStop: vi.fn() };
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => grad),
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => fakeCtx() as unknown as CanvasRenderingContext2D,
  );
});
afterEach(() => vi.restoreAllMocks());

describe("createHouseMaterials", () => {
  it("builds every material as a MeshStandardMaterial", () => {
    const m = createHouseMaterials();
    for (const k of [
      "plasterOuter", "plasterInner", "concrete", "frame", "door", "brass",
      "glass", "ledge", "roof", "floorTile", "floorMarble", "floorBath", "floorKitchen",
    ] as const)
      expect(m[k]).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it("uses the default door colour and accepts an override", () => {
    expect(createHouseMaterials().door.color.getHexString()).toBe("8b5a2b");
    expect(createHouseMaterials("#112233").door.color.getHexString()).toBe("112233");
  });

  it("makes the glass transparent and double-sided", () => {
    const g = createHouseMaterials().glass;
    expect(g.transparent).toBe(true);
    expect(g.opacity).toBeCloseTo(0.35);
    expect(g.side).toBe(THREE.DoubleSide);
    expect(g.depthWrite).toBe(false);
  });

  it("textures floors and plaster with repeating sRGB canvases", () => {
    const m = createHouseMaterials();
    for (const mat of [m.floorTile, m.floorMarble, m.floorBath, m.floorKitchen, m.plasterOuter]) {
      expect(mat.map).toBeInstanceOf(THREE.CanvasTexture);
      expect(mat.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    }
    expect(m.floorTile.map!.repeat.x).toBeCloseTo(0.5);
    expect(m.plasterOuter.map!.repeat.x).toBeCloseTo(1 / 8);
    expect(m.plasterOuter.map).toBe(m.plasterInner.map);
  });

  it("is deterministic: the same seed paints the same calls", () => {
    const calls: unknown[][] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      const c = fakeCtx();
      calls.push(c.fillRect.mock.calls);
      return c as unknown as CanvasRenderingContext2D;
    });
    createHouseMaterials();
    const first = JSON.stringify(calls);
    calls.length = 0;
    createHouseMaterials();
    expect(JSON.stringify(calls)).toBe(first);
  });

  it("dispose releases all materials and textures", () => {
    const m = createHouseMaterials();
    const spies = [m.floorMarble, m.glass, m.plasterOuter].map((x) => vi.spyOn(x, "dispose"));
    const texSpy = vi.spyOn(m.floorMarble.map!, "dispose");
    m.dispose();
    spies.forEach((s) => expect(s).toHaveBeenCalled());
    expect(texSpy).toHaveBeenCalled();
  });
});
