import * as THREE from "three";

export type LivingFloor = "marble" | "tile";

export interface HouseMaterials {
  plasterOuter: THREE.MeshStandardMaterial;
  plasterInner: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  ledge: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  floorTile: THREE.MeshStandardMaterial;
  floorMarble: THREE.MeshStandardMaterial;
  floorBath: THREE.MeshStandardMaterial;
  floorKitchen: THREE.MeshStandardMaterial;
  dispose: () => void;
}

// Small seeded random so the textures look the same on every load.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) =>
    Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

// UVs are in feet (see boxGeometry in HouseViewer), so repeat = 1 / feet per tile.
function toTexture(c: HTMLCanvasElement, feetPerTile: number) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / feetPerTile, 1 / feetPerTile);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function plasterTexture() {
  const [c, g] = canvas(256);
  const r = rng(1);
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = r() > 0.5 ? 255 : 120;
    g.fillStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  return toTexture(c, 8);
}

/** A 2 ft x 2 ft square holding `tiles` x `tiles` tiles. */
function tileTexture(o: {
  tiles: number;
  base: string;
  grout: string;
  vary: number;
  seed: number;
}) {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rng(o.seed);
  g.fillStyle = o.grout;
  g.fillRect(0, 0, S, S);
  const t = S / o.tiles;
  const gap = 4;
  for (let i = 0; i < o.tiles; i++)
    for (let j = 0; j < o.tiles; j++) {
      g.fillStyle = shade(o.base, 1 + (r() - 0.5) * o.vary);
      g.fillRect(i * t + gap / 2, j * t + gap / 2, t - gap, t - gap);
    }
  return toTexture(c, 2);
}

function marbleTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rng(7);
  const gap = 3;
  g.fillStyle = "#cfc8b8";
  g.fillRect(0, 0, S, S);
  g.save();
  g.beginPath();
  g.rect(gap, gap, S - 2 * gap, S - 2 * gap);
  g.clip();
  g.fillStyle = "#f2ede2";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 80 + r() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(190,175,150,0.18)");
    gr.addColorStop(1, "rgba(190,175,150,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  for (let i = 0; i < 7; i++) {
    g.strokeStyle = `rgba(110,100,85,${0.12 + r() * 0.2})`;
    g.lineWidth = 0.6 + r() * 2;
    g.beginPath();
    g.moveTo(r() * S, 0);
    g.bezierCurveTo(r() * S, S * 0.3, r() * S, S * 0.6, r() * S, S);
    g.stroke();
  }
  g.restore();
  return toTexture(c, 2);
}

export function createHouseMaterials(doorColor = "#8b5a2b"): HouseMaterials {
  const textures: THREE.Texture[] = [];
  const tex = (t: THREE.Texture) => (textures.push(t), t);
  const plaster = tex(plasterTexture());
  const std = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial(p);

  const m = {
    plasterOuter: std({ color: "#e6dccb", map: plaster, roughness: 0.95 }),
    plasterInner: std({ color: "#f6f3ec", map: plaster, roughness: 0.92 }),
    concrete: std({ color: "#cfcac0", roughness: 1 }),
    frame: std({ color: "#5b3a1e", roughness: 0.6 }),
    door: std({ color: doorColor, roughness: 0.55 }),
    brass: std({ color: "#c9a14a", roughness: 0.35, metalness: 0.8 }),
    glass: std({
      color: "#9cc8e8",
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    ledge: std({ color: "#d9d4c9", roughness: 0.9 }),
    roof: std({ color: "#b9b4aa", roughness: 0.95 }),
    floorTile: std({
      map: tex(
        tileTexture({
          tiles: 1,
          base: "#d8d2c6",
          grout: "#b8b2a6",
          vary: 0.06,
          seed: 3,
        }),
      ),
      roughness: 0.35,
    }),
    floorMarble: std({ map: tex(marbleTexture()), roughness: 0.22 }),
    floorBath: std({
      map: tex(
        tileTexture({
          tiles: 2,
          base: "#cfdde6",
          grout: "#e8eef2",
          vary: 0.08,
          seed: 5,
        }),
      ),
      roughness: 0.3,
    }),
    floorKitchen: std({
      map: tex(
        tileTexture({
          tiles: 2,
          base: "#e5ddcf",
          grout: "#b0a99c",
          vary: 0.08,
          seed: 9,
        }),
      ),
      roughness: 0.35,
    }),
  };

  return {
    ...m,
    dispose() {
      Object.values(m).forEach((x) => x.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
