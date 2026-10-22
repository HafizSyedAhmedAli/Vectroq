"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Geometry, Room } from "@vectroq/shared-types";
import type { CategoryFinish } from "./finishes";
import {
  layoutFurniture,
  roomBounds,
  roomIsRectangular,
  type Placed,
} from "./furniture-layout";

// ---------- materials ----------

const MAT_KEYS = [
  "wood",
  "cabinet",
  "sofa",
  "mattress",
  "bedding",
  "porcelain",
  "steel",
  "black",
  "mirror",
  "counterTop",
  "splash",
  "ceiling",
  "ceilingPanel",
  "cove",
] as const;
type MatKey = (typeof MAT_KEYS)[number];
export type FurnitureMaterials = Record<MatKey, THREE.MeshStandardMaterial> & {
  dispose: () => void;
};

export function createFurnitureMaterials(
  f: CategoryFinish,
): FurnitureMaterials {
  const std = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial(p);
  const m: Record<MatKey, THREE.MeshStandardMaterial> = {
    wood: std({ color: f.woodColor, roughness: 0.55 }),
    cabinet: std({ color: f.cabinetColor, roughness: 0.5 }),
    sofa: std({ color: f.sofaColor, roughness: 0.9 }),
    mattress: std({ color: "#f3f0ea", roughness: 0.95 }),
    bedding: std({ color: f.beddingColor, roughness: 0.95 }),
    porcelain: std({ color: "#fafafa", roughness: 0.2 }),
    steel: std({ color: "#b9bec4", roughness: 0.3, metalness: 0.8 }),
    black: std({ color: "#1b1d20", roughness: 0.35, metalness: 0.2 }),
    mirror: std({ color: "#bcd7ea", roughness: 0.05, metalness: 0.6 }),
    counterTop:
      f.counter === "granite"
        ? std({ color: "#2c2f33", roughness: 0.25, metalness: 0.1 })
        : std({ color: "#d9d3c7", roughness: 0.6 }),
    splash: std({ color: "#eceae4", roughness: 0.35 }),
    ceiling: std({ color: "#f4f1ea", roughness: 0.95, side: THREE.DoubleSide }),
    ceilingPanel: std({
      color: "#fbfaf6",
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
    cove: std({
      color: "#fff1d6",
      emissive: new THREE.Color("#ffd9a0"),
      emissiveIntensity: 1.6,
    }),
  };
  return {
    ...m,
    dispose() {
      Object.values(m).forEach((x) => x.dispose());
    },
  };
}

// ---------- primitive ----------

type V3 = [number, number, number];

/** Box: `s` = size, `p` = [x, BOTTOM y, z]. */
function P({
  s,
  p,
  m,
  cast = true,
}: {
  s: V3;
  p: V3;
  m: THREE.Material;
  cast?: boolean;
}) {
  return (
    <mesh
      position={[p[0], p[1] + s[1] / 2, p[2]]}
      material={m}
      castShadow={cast}
      receiveShadow
    >
      <boxGeometry args={s} />
    </mesh>
  );
}

// ---------- pieces (all face +z, back at -z, origin at floor centre) ----------

function Bed({ w, d, m }: { w: number; d: number; m: FurnitureMaterials }) {
  const pillows = w > 4.5 ? [-1, 1] : [0];
  return (
    <>
      <P s={[w, 1.1, d]} p={[0, 0.1, 0]} m={m.wood} />
      <P s={[w + 0.2, 3.2, 0.35]} p={[0, 0.1, -d / 2 + 0.18]} m={m.wood} />
      <P s={[w - 0.3, 0.7, d - 0.5]} p={[0, 1.2, 0.15]} m={m.mattress} />
      {pillows.map((i) => (
        <P
          key={i}
          s={[1.9, 0.4, 1.1]}
          p={[i * (w / 4), 1.9, -d / 2 + 1.1]}
          m={m.mattress}
        />
      ))}
      <P
        s={[w - 0.2, 0.15, d * 0.55]}
        p={[0, 1.9, d / 2 - d * 0.275 - 0.05]}
        m={m.bedding}
      />
    </>
  );
}

function Wardrobe({
  w,
  d,
  m,
}: {
  w: number;
  d: number;
  m: FurnitureMaterials;
}) {
  return (
    <>
      <P s={[w, 7, d]} p={[0, 0, 0]} m={m.wood} />
      <P s={[0.04, 6.4, 0.05]} p={[0, 0.3, d / 2]} m={m.black} />
      <P s={[0.08, 0.6, 0.08]} p={[-0.25, 3, d / 2 + 0.03]} m={m.steel} />
      <P s={[0.08, 0.6, 0.08]} p={[0.25, 3, d / 2 + 0.03]} m={m.steel} />
    </>
  );
}

function Sofa({ w, d, m }: { w: number; d: number; m: FurnitureMaterials }) {
  const seatW = (w - 1.4) / 3 - 0.04;
  return (
    <>
      <P s={[w, 1.2, d]} p={[0, 0.15, 0]} m={m.sofa} />
      <P s={[w, 1.6, 0.8]} p={[0, 1.35, -d / 2 + 0.4]} m={m.sofa} />
      {[-1, 1].map((i) => (
        <P
          key={i}
          s={[0.7, 1, d]}
          p={[i * (w / 2 - 0.35), 1.35, 0]}
          m={m.sofa}
        />
      ))}
      {[-1, 0, 1].map((i) => (
        <P
          key={i}
          s={[seatW, 0.5, d - 0.9]}
          p={[i * (seatW + 0.04), 1.35, 0.45]}
          m={m.sofa}
        />
      ))}
    </>
  );
}

function CoffeeTable({
  w,
  d,
  m,
}: {
  w: number;
  d: number;
  m: FurnitureMaterials;
}) {
  const legs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return (
    <>
      <P s={[w, 0.15, d]} p={[0, 1.25, 0]} m={m.wood} />
      {legs.map(([a, b], i) => (
        <P
          key={i}
          s={[0.15, 1.25, 0.15]}
          p={[a * (w / 2 - 0.15), 0, b * (d / 2 - 0.15)]}
          m={m.wood}
        />
      ))}
    </>
  );
}

function TvUnit({ w, d, m }: { w: number; d: number; m: FurnitureMaterials }) {
  return (
    <>
      <P s={[w, 1.5, d]} p={[0, 0.1, 0]} m={m.cabinet} />
      <P s={[w * 0.75, 2.3, 0.12]} p={[0, 1.6, -d / 2 + 0.3]} m={m.black} />
    </>
  );
}

function DiningTable({
  w,
  d,
  m,
}: {
  w: number;
  d: number;
  m: FurnitureMaterials;
}) {
  const legs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return (
    <>
      <P s={[w, 0.15, d]} p={[0, 2.35, 0]} m={m.wood} />
      {legs.map(([a, b], i) => (
        <P
          key={i}
          s={[0.2, 2.35, 0.2]}
          p={[a * (w / 2 - 0.3), 0, b * (d / 2 - 0.3)]}
          m={m.wood}
        />
      ))}
    </>
  );
}

function Chair({ m }: { m: FurnitureMaterials }) {
  const legs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return (
    <>
      <P s={[1.4, 0.15, 1.4]} p={[0, 1.5, 0]} m={m.wood} />
      <P s={[1.4, 1.6, 0.15]} p={[0, 1.65, -0.62]} m={m.wood} />
      {legs.map(([a, b], i) => (
        <P
          key={i}
          s={[0.12, 1.5, 0.12]}
          p={[a * 0.55, 0, b * 0.55]}
          m={m.wood}
        />
      ))}
    </>
  );
}

function Counter({ w, d, m }: { w: number; d: number; m: FurnitureMaterials }) {
  const n = Math.max(2, Math.round(w / 2));
  return (
    <>
      <P s={[w, 2.9, d]} p={[0, 0, 0]} m={m.cabinet} />
      <P s={[w + 0.04, 0.12, d + 0.1]} p={[0, 2.9, 0.03]} m={m.counterTop} />
      <P s={[w, 1.2, 0.1]} p={[0, 3.02, -d / 2 + 0.05]} m={m.splash} />
      {Array.from({ length: n - 1 }, (_, i) => (
        <P
          key={i}
          s={[0.03, 2.4, 0.03]}
          p={[-w / 2 + ((i + 1) * w) / n, 0.25, d / 2]}
          m={m.black}
        />
      ))}
      <P s={[2, 0.05, 1.3]} p={[-w / 4, 3.02, 0.05]} m={m.steel} />
      <P s={[0.12, 0.7, 0.12]} p={[-w / 4, 3.02, -d / 2 + 0.3]} m={m.steel} />
      <P s={[1.8, 0.05, 1.4]} p={[w / 4, 3.02, 0.05]} m={m.black} />
    </>
  );
}

function Toilet({ w, d, m }: { w: number; d: number; m: FurnitureMaterials }) {
  return (
    <>
      <P s={[1.3, 1.6, 0.6]} p={[0, 0.9, -d / 2 + 0.3]} m={m.porcelain} />
      <P s={[1.1, 1.4, 1.5]} p={[0, 0, -d / 2 + 0.9]} m={m.porcelain} />
      <P s={[w - 0.35, 0.1, 1.3]} p={[0, 1.4, -d / 2 + 1]} m={m.porcelain} />
    </>
  );
}

function Basin({ w, d, m }: { w: number; d: number; m: FurnitureMaterials }) {
  return (
    <>
      <P s={[0.5, 2.4, 0.5]} p={[0, 0, -d / 2 + 0.45]} m={m.porcelain} />
      <P s={[w, 0.4, 1.3]} p={[0, 2.4, -d / 2 + 0.65]} m={m.porcelain} />
      <P s={[0.1, 0.4, 0.1]} p={[0, 2.8, -d / 2 + 0.2]} m={m.steel} />
      <P
        s={[1.5, 2, 0.05]}
        p={[0, 3.8, -d / 2 + 0.02]}
        m={m.mirror}
        cast={false}
      />
    </>
  );
}

function Piece({ it, m }: { it: Placed; m: FurnitureMaterials }) {
  switch (it.kind) {
    case "bed":
      return <Bed w={it.w} d={it.d} m={m} />;
    case "wardrobe":
      return <Wardrobe w={it.w} d={it.d} m={m} />;
    case "sofa":
      return <Sofa w={it.w} d={it.d} m={m} />;
    case "coffeeTable":
      return <CoffeeTable w={it.w} d={it.d} m={m} />;
    case "tvUnit":
      return <TvUnit w={it.w} d={it.d} m={m} />;
    case "diningTable":
      return <DiningTable w={it.w} d={it.d} m={m} />;
    case "chair":
      return <Chair m={m} />;
    case "counter":
      return <Counter w={it.w} d={it.d} m={m} />;
    case "toilet":
      return <Toilet w={it.w} d={it.d} m={m} />;
    case "basin":
      return <Basin w={it.w} d={it.d} m={m} />;
  }
}

// ---------- public components ----------

/** CAD (x, y) -> three (x, -z), same mapping as walls and floors. */
export function Furniture({
  geometry,
  cx,
  cy,
  mats,
}: {
  geometry: Geometry;
  cx: number;
  cy: number;
  mats: FurnitureMaterials;
}) {
  const items = useMemo(
    () => geometry.rooms.flatMap((r) => layoutFurniture(r, geometry.openings)),
    [geometry],
  );
  return (
    <group>
      {items.map((it, i) => (
        <group
          key={i}
          position={[it.x - cx, 0.03, -(it.y - cy)]}
          rotation={[0, Math.atan2(it.facing[0], -it.facing[1]), 0]}
        >
          <Piece it={it} m={mats} />
        </group>
      ))}
    </group>
  );
}

function floorGeometry(room: Room) {
  const shapes = (room.shapes ?? [])
    .filter((pts) => pts.length >= 3)
    .map((pts) => {
      const s = new THREE.Shape();
      pts.forEach((p, i) =>
        i === 0 ? s.moveTo(p.x, p.y) : s.lineTo(p.x, p.y),
      );
      s.closePath();
      return s;
    });
  return new THREE.ShapeGeometry(shapes);
}

function RoomCeiling({
  room,
  cx,
  cy,
  y,
  finish,
  m,
}: {
  room: Room;
  cx: number;
  cy: number;
  y: number;
  finish: CategoryFinish;
  m: FurnitureMaterials;
}) {
  const geo = useMemo(() => floorGeometry(room), [room.shapes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);

  const bb = roomBounds(room);
  const lift =
    finish.ceiling === "tray" ? 0.4 : finish.ceiling === "drop" ? 0.15 : 0;
  const inset = finish.ceiling === "tray" ? 1.6 : 1;
  const bw = bb ? bb.maxX - bb.minX : 0;
  const bh = bb ? bb.maxY - bb.minY : 0;
  const rim =
    lift > 0 &&
    !!bb &&
    roomIsRectangular(room) &&
    bw - 2 * inset >= 3 &&
    bh - 2 * inset >= 3;
  const mx = bb ? (bb.minX + bb.maxX) / 2 - cx : 0;
  const mz = bb ? -((bb.minY + bb.maxY) / 2 - cy) : 0;
  const baseY = rim ? y + lift : y;
  const pw = bw - 2 * inset;
  const ph = bh - 2 * inset;

  return (
    <group>
      <mesh
        geometry={geo}
        material={rim ? m.ceilingPanel : m.ceiling}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-cx, baseY, cy]}
      />
      {rim && (
        <>
          {/* dropped border */}
          <P
            s={[bw, lift - 0.01, inset]}
            p={[mx, y, mz + (bh / 2 - inset / 2)]}
            m={m.ceiling}
            cast={false}
          />
          <P
            s={[bw, lift - 0.01, inset]}
            p={[mx, y, mz - (bh / 2 - inset / 2)]}
            m={m.ceiling}
            cast={false}
          />
          <P
            s={[inset, lift - 0.01, bh - 2 * inset]}
            p={[mx + (bw / 2 - inset / 2), y, mz]}
            m={m.ceiling}
            cast={false}
          />
          <P
            s={[inset, lift - 0.01, bh - 2 * inset]}
            p={[mx - (bw / 2 - inset / 2), y, mz]}
            m={m.ceiling}
            cast={false}
          />
          {/* cove light (Category A only) */}
          {finish.ceiling === "tray" && (
            <>
              <P
                s={[pw, 0.05, 0.12]}
                p={[mx, baseY - 0.05, mz + (ph / 2 - 0.06)]}
                m={m.cove}
                cast={false}
              />
              <P
                s={[pw, 0.05, 0.12]}
                p={[mx, baseY - 0.05, mz - (ph / 2 - 0.06)]}
                m={m.cove}
                cast={false}
              />
              <P
                s={[0.12, 0.05, ph - 0.24]}
                p={[mx + (pw / 2 - 0.06), baseY - 0.05, mz]}
                m={m.cove}
                cast={false}
              />
              <P
                s={[0.12, 0.05, ph - 0.24]}
                p={[mx - (pw / 2 - 0.06), baseY - 0.05, mz]}
                m={m.cove}
                cast={false}
              />
            </>
          )}
        </>
      )}
    </group>
  );
}

/** False ceilings in dry rooms only, matching how the BOQ prices them. */
export function Ceilings({
  geometry,
  cx,
  cy,
  height,
  finish,
  mats,
}: {
  geometry: Geometry;
  cx: number;
  cy: number;
  height: number;
  finish: CategoryFinish;
  mats: FurnitureMaterials;
}) {
  const y = height - 0.5;
  return (
    <group>
      {geometry.rooms
        .filter((r) => r.type === "general" && r.shapes?.length)
        .map((r) => (
          <RoomCeiling
            key={r.id}
            room={r}
            cx={cx}
            cy={cy}
            y={y}
            finish={finish}
            m={mats}
          />
        ))}
    </group>
  );
}
