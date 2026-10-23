"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  Sky,
  Text,
} from "@react-three/drei";
import {
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
} from "lucide-react";
import type { Category, Geometry, Room } from "@vectroq/shared-types";
import {
  createHouseMaterials,
  type HouseMaterials,
  type LivingFloor,
} from "./viewer/materials";
import { planWalls, type WallCut, type WallPlan } from "./viewer/wall-cuts";
import {
  CATEGORY_FINISH,
  CategoryFinish,
  finishSummary,
} from "./viewer/finishes";
import {
  Ceilings,
  createFurnitureMaterials,
  Furniture,
} from "./viewer/furniture";
import {
  furnitureRects,
  gapToRect,
  type Rect,
} from "./viewer/furniture-layout";
import { addConnectingOpenings } from "./viewer/connect-rooms";

type RoofMode = "off" | "on" | "lift";
type ViewMode = "3d" | "plan" | "walk";

/** Touch / on-screen button state shared with the walker. */
interface MoveState {
  f: boolean;
  b: boolean;
  tl: boolean;
  tr: boolean;
}

interface Bounds {
  cx: number;
  cy: number;
  w: number;
  d: number;
  h: number;
}

const DOOR_OPEN = 0.8; // radians a swung door is opened (about 46 degrees)
const EYE_FT = 5.5;
const PLAYER_R = 0.8; // keeps you off walls
const FURN_R = 0.5; // keeps you off furniture
const WALK_SPEED = 5; // ft per second
const DEFAULT_FOV = 75;

function boundsOf(g: Geometry): Bounds {
  if (g.walls.length === 0) return { cx: 0, cy: 0, w: 0, d: 0, h: 10 };
  const xs = g.walls.flatMap((s) => [s.startX, s.endX]);
  const ys = g.walls.flatMap((s) => [s.startY, s.endY]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    d: maxY - minY,
    h: g.walls[0]?.height ?? 10,
  };
}

// A wall shared by two rooms is drawn twice by the polyline parser. Two copies
// in the same place make faces fight each other (flicker), so keep one.
function dedupePlans(plans: WallPlan[]): WallPlan[] {
  const r = (n: number) => Math.round(n * 20) / 20;
  const seen = new Set<string>();
  return plans.filter(({ wall: w }) => {
    const a = `${r(w.startX)},${r(w.startY)}`;
    const b = `${r(w.endX)},${r(w.endY)}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True when a point (CAD feet) is inside a wall, unless it is in a doorway. */
function blockedAt(px: number, py: number, plans: WallPlan[]): boolean {
  for (const { wall, cuts } of plans) {
    const dx = wall.endX - wall.startX;
    const dy = wall.endY - wall.startY;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const ux = dx / len;
    const uy = dy / len;
    const rx = px - wall.startX;
    const ry = py - wall.startY;
    const along = rx * ux + ry * uy;
    const across = Math.abs(-rx * uy + ry * ux);
    if (along < -PLAYER_R || along > len + PLAYER_R) continue;
    if (across > wall.thickness / 2 + PLAYER_R) continue;
    const inDoor = cuts.some(
      (c) => c.type === "door" && along > c.u0 + 0.1 && along < c.u1 - 0.1,
    );
    if (!inDoor) return true;
  }
  return false;
}

/** Nearest free spot to (x, z), searching outward in rings. */
function findFree(
  x: number,
  z: number,
  isFree: (x: number, z: number) => boolean,
) {
  if (isFree(x, z)) return { x, z };
  for (let r = 1; r <= 12; r++)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const nx = x + Math.cos(a) * r;
      const nz = z + Math.sin(a) * r;
      if (isFree(nx, nz)) return { x: nx, z: nz };
    }
  return { x, z };
}

/** Where the walk starts, in three.js coordinates. */
function walkStart(g: Geometry, b: Bounds) {
  const rooms = g.rooms.filter((r) => r.shapes?.length);
  const pick =
    rooms.find((r) => /living|lounge/i.test(r.name)) ??
    [...rooms].sort((p, q) => q.area - p.area)[0];
  const cadX = pick?.labelX ?? b.cx;
  const cadY = pick?.labelY ?? b.cy;
  return { x: cadX - b.cx, z: -(cadY - b.cy) };
}

// BoxGeometry with UVs in feet, so textures keep their real-world size on any wall.
function boxGeometry(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  return g;
}

function Box({
  w,
  h,
  d,
  x,
  y,
  z,
  material,
  cast = true,
}: {
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
  material: THREE.Material;
  cast?: boolean;
}) {
  const geo = useMemo(() => boxGeometry(w, h, d), [w, h, d]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh
      geometry={geo}
      material={material}
      position={[x, y, z]}
      castShadow={cast}
      receiveShadow
    />
  );
}

/** Door leaf. When the hinge side is known it pivots open about the hinge jamb. */
function DoorLeaf({
  cut,
  w,
  h,
  x,
  f,
  doorOpen,
  m,
}: {
  cut: WallCut;
  w: number;
  h: number;
  x: number;
  f: number;
  doorOpen: number;
  m: HouseMaterials;
}) {
  const lw = w - 2 * f;
  const swing =
    doorOpen > 0 && cut.hingeAtStart !== undefined && cut.swingZ !== undefined;
  const dir = cut.hingeAtStart ? 1 : -1;
  const pivotX = cut.hingeAtStart ? x - w / 2 + f : x + w / 2 - f;
  const rotY = swing
    ? (cut.hingeAtStart ? -1 : 1) * (cut.swingZ ?? 1) * doorOpen
    : 0;

  return (
    <group position={[swing ? pivotX : x, 0, 0]} rotation={[0, rotY, 0]}>
      <Box
        w={lw}
        h={h - f}
        d={0.12}
        x={swing ? (dir * lw) / 2 : 0}
        y={cut.y0 + (h - f) / 2}
        z={0}
        material={m.door}
      />
      <Box
        w={0.5}
        h={0.08}
        d={0.2}
        x={swing ? dir * (lw - 0.4) : lw / 2 - 0.4}
        y={3.2}
        z={0}
        material={m.brass}
      />
    </group>
  );
}

/** Frame + door leaf, or frame + glass + sill, sitting in a hole in the wall. */
function Fixture({
  cut,
  th,
  m,
  doorOpen,
}: {
  cut: WallCut;
  th: number;
  m: HouseMaterials;
  doorOpen: number;
}) {
  const w = cut.u1 - cut.u0;
  const h = cut.y1 - cut.y0;
  const x = (cut.u0 + cut.u1) / 2;
  const y = (cut.y0 + cut.y1) / 2;
  const f = 0.2;
  const depth = th + 0.12;

  return (
    <group>
      <Box
        w={f}
        h={h}
        d={depth}
        x={x - w / 2 + f / 2}
        y={y}
        z={0}
        material={m.frame}
      />
      <Box
        w={f}
        h={h}
        d={depth}
        x={x + w / 2 - f / 2}
        y={y}
        z={0}
        material={m.frame}
      />
      <Box
        w={w - 2 * f}
        h={f}
        d={depth}
        x={x}
        y={cut.y1 - f / 2}
        z={0}
        material={m.frame}
      />
      {cut.type === "door" ? (
        cut.archway ? null : (
          <DoorLeaf
            cut={cut}
            w={w}
            h={h}
            x={x}
            f={f}
            doorOpen={doorOpen}
            m={m}
          />
        )
      ) : (
        <>
          <Box
            w={w - 2 * f}
            h={f}
            d={depth}
            x={x}
            y={cut.y0 + f / 2}
            z={0}
            material={m.frame}
          />
          <mesh position={[x, y, 0]} material={m.glass}>
            <boxGeometry args={[w - 2 * f, h - 2 * f, 0.04]} />
          </mesh>
          {w > 4.5 && (
            <Box
              w={0.1}
              h={h - 2 * f}
              d={0.08}
              x={x}
              y={y}
              z={0}
              material={m.frame}
            />
          )}
          <Box
            w={w + 0.3}
            h={0.12}
            d={th + 0.5}
            x={x}
            y={cut.y0 - 0.06}
            z={0}
            material={m.ledge}
          />
        </>
      )}
    </group>
  );
}

const SKIRTING_H = 0.4;

function Wall({
  plan,
  cx,
  cy,
  m,
  doorOpen,
}: {
  plan: WallPlan;
  cx: number;
  cy: number;
  m: HouseMaterials;
  doorOpen: number;
}) {
  const { wall, pieces, cuts } = plan;
  const th = wall.thickness;
  const angle = Math.atan2(wall.endY - wall.startY, wall.endX - wall.startX);
  const mat = th >= 0.6 ? m.plasterOuter : m.plasterInner;
  // CAD (x, y) -> three (x, -z); the group's local x runs along the wall.
  return (
    <group
      position={[wall.startX - cx, 0, -(wall.startY - cy)]}
      rotation={[0, angle, 0]}
    >
      {pieces.map((p, i) => (
        <Box
          key={i}
          w={p.u1 - p.u0}
          h={p.y1 - p.y0}
          d={th}
          x={(p.u0 + p.u1) / 2}
          y={(p.y0 + p.y1) / 2}
          z={0}
          material={mat}
        />
      ))}
      {/* skirting: only where wall reaches the floor (not under doors) */}
      {pieces
        .filter((p) => p.y0 < 0.01)
        .map((p, i) => (
          <Box
            key={`skirt-${i}`}
            w={p.u1 - p.u0}
            h={SKIRTING_H}
            d={th + 0.08}
            x={(p.u0 + p.u1) / 2}
            y={SKIRTING_H / 2}
            z={0}
            material={m.ledge}
            cast={false}
          />
        ))}
      {cuts.map((c) => (
        <Fixture key={c.openingId} cut={c} th={th} m={m} doorOpen={doorOpen} />
      ))}
    </group>
  );
}

function floorFor(room: Room, m: HouseMaterials, living: LivingFloor) {
  if (room.type === "bathroom") return m.floorBath;
  if (room.type === "kitchen") return m.floorKitchen;
  return living === "marble" ? m.floorMarble : m.floorTile;
}

function RoomFloor({
  room,
  material,
  cx,
  cy,
}: {
  room: Room;
  material: THREE.Material;
  cx: number;
  cy: number;
}) {
  const geo = useMemo(() => {
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
  }, [room.shapes]);
  useEffect(() => () => geo.dispose(), [geo]);
  // rotating -90 degrees about X turns CAD y into -z
  return (
    <mesh
      geometry={geo}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[-cx, 0.02, cy]}
      receiveShadow
    />
  );
}

function Roof({
  mode,
  b,
  m,
}: {
  mode: RoofMode;
  b: Bounds;
  m: HouseMaterials;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = mode === "lift" ? b.h * 1.6 + 6 : 0;
    ref.current.position.y = THREE.MathUtils.damp(
      ref.current.position.y,
      target,
      5,
      dt,
    );
  });
  if (mode === "off") return null;

  const W = b.w + 1.5;
  const D = b.d + 1.5;
  const py = b.h + 0.5 + 1; // parapet centre
  return (
    <group ref={ref}>
      <Box w={W} h={0.5} d={D} x={0} y={b.h + 0.25} z={0} material={m.roof} />
      <Box
        w={W}
        h={2}
        d={0.4}
        x={0}
        y={py}
        z={D / 2 - 0.2}
        material={m.plasterOuter}
      />
      <Box
        w={W}
        h={2}
        d={0.4}
        x={0}
        y={py}
        z={-(D / 2 - 0.2)}
        material={m.plasterOuter}
      />
      <Box
        w={0.4}
        h={2}
        d={D - 0.8}
        x={W / 2 - 0.2}
        y={py}
        z={0}
        material={m.plasterOuter}
      />
      <Box
        w={0.4}
        h={2}
        d={D - 0.8}
        x={-(W / 2 - 0.2)}
        y={py}
        z={0}
        material={m.plasterOuter}
      />
    </group>
  );
}

/**
 * Driveway and trees. Illustrative only: not in the BOQ. The driveway runs out
 * of the +z side (the smallest-CAD-y side, where plans usually draw the
 * entrance).
 */
function Surroundings({
  b,
  size,
  trees,
  night,
}: {
  b: Bounds;
  size: number;
  trees: boolean;
  night: boolean;
}) {
  const items = useMemo(() => {
    const r = seeded(11);
    const reach = Math.max(b.w, b.d) / 2;
    const out: { x: number; z: number; s: number; tone: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const ang = r() * Math.PI * 2;
      const dist = reach * 1.5 + 8 + r() * size * 0.5;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (z > 0 && Math.abs(x) < 8) continue; // keep the driveway clear
      out.push({ x, z, s: 0.8 + r() * 0.7, tone: r() });
    }
    return out;
  }, [b.w, b.d, size]);

  const len = size * 0.7;
  const GROUND = -0.5;

  return (
    <group>
      {/* driveway */}
      <mesh position={[0, GROUND + 0.04, b.d / 2 + 1 + len / 2]} receiveShadow>
        <boxGeometry args={[9, 0.08, len]} />
        <meshStandardMaterial color="#8a8d91" roughness={1} />
      </mesh>
      {/* entrance path border */}
      <mesh position={[0, GROUND + 0.05, b.d / 2 + 1 + len / 2]} receiveShadow>
        <boxGeometry args={[9.4, 0.06, len + 0.4]} />
        <meshStandardMaterial color="#b9b4aa" roughness={1} />
      </mesh>

      {trees &&
        items.map((t, i) => (
          <group key={i} position={[t.x, GROUND, t.z]} scale={t.s}>
            <mesh position={[0, 3, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.7, 6, 8]} />
              <meshStandardMaterial color="#6b4a2b" roughness={1} />
            </mesh>
            <mesh position={[0, 8, 0]} castShadow>
              <icosahedronGeometry args={[4, 1]} />
              <meshStandardMaterial
                color={night ? "#2d4a2b" : t.tone > 0.5 ? "#4f7a3a" : "#5f8a45"}
                roughness={1}
                flatShading
              />
            </mesh>
            <mesh position={[1.6, 10.4, 0.6]} castShadow>
              <icosahedronGeometry args={[2.6, 1]} />
              <meshStandardMaterial
                color={night ? "#2d4a2b" : "#6a9650"}
                roughness={1}
                flatShading
              />
            </mesh>
          </group>
        ))}
    </group>
  );
}

/** One warm light per room, only used at night. */
function RoomLights({
  geometry,
  cx,
  cy,
  height,
}: {
  geometry: Geometry;
  cx: number;
  cy: number;
  height: number;
}) {
  return (
    <>
      {geometry.rooms.map((r) =>
        r.labelX === undefined || r.labelY === undefined ? null : (
          <pointLight
            key={r.id}
            position={[r.labelX - cx, height - 1.4, -(r.labelY - cy)]}
            color="#ffd9a0"
            intensity={30}
            distance={24}
            decay={2}
          />
        ),
      )}
    </>
  );
}

/** Cuts the whole scene at a height (feet). null = no cut. */
function SliceClip({ y }: { y: number | null }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.clippingPlanes =
      y === null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)];
    return () => {
      gl.clippingPlanes = [];
    };
  }, [gl, y]);
  return null;
}

/** Moves the camera when the view mode changes (3D and plan only). */
function CameraRig({ view, size }: { view: ViewMode; size: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;

  useEffect(() => {
    if (view === "walk") return;
    if (view === "plan") camera.position.set(0, size * 2, 0.001);
    else camera.position.set(size * 0.9, size * 0.8, size * 0.9);
    camera.lookAt(0, 0, 0);
    controls?.target.set(0, 0, 0);
    controls?.update();
  }, [view, size, camera, controls]);

  return null;
}

type Keys = {
  f: boolean;
  b: boolean;
  l: boolean;
  r: boolean;
  tl: boolean;
  tr: boolean;
};

const KEYMAP: Record<string, keyof Keys> = {
  KeyW: "f",
  ArrowUp: "f",
  KeyS: "b",
  ArrowDown: "b",
  KeyA: "l",
  KeyD: "r",
  KeyQ: "tl",
  ArrowLeft: "tl",
  KeyE: "tr",
  ArrowRight: "tr",
};

/**
 * First-person walk. Keys only work while the view has focus (click it), so
 * the arrow keys never hijack page scrolling. Walls and furniture block
 * movement; door openings are passable.
 */
function Walker({
  plans,
  blockers,
  start,
  cx,
  cy,
  move,
  fov,
}: {
  plans: WallPlan[];
  blockers: Rect[];
  start: { x: number; z: number };
  cx: number;
  cy: number;
  move: MutableRefObject<MoveState>;
  fov: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dom = useThree((s) => s.gl.domElement);
  const st = useRef({
    x: start.x,
    z: start.z,
    yaw: 0,
    pitch: 0,
    placed: false,
  });
  const keys = useRef<Keys>({
    f: false,
    b: false,
    l: false,
    r: false,
    tl: false,
    tr: false,
  });

  useEffect(() => {
    const prevNear = camera.near;
    const prevFov = camera.fov;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    camera.rotation.order = "YXZ";
    dom.tabIndex = 0;
    dom.style.outline = "none";
    dom.style.touchAction = "none";
    dom.focus({ preventScroll: true });

    const down = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      keys.current[k] = true;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (k) keys.current[k] = false;
    };
    const blur = () => {
      keys.current = {
        f: false,
        b: false,
        l: false,
        r: false,
        tl: false,
        tr: false,
      };
    };

    let drag: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY };
      dom.setPointerCapture(e.pointerId);
      dom.focus({ preventScroll: true });
    };
    const pm = (e: PointerEvent) => {
      if (!drag) return;
      st.current.yaw -= (e.clientX - drag.x) * 0.005;
      st.current.pitch = Math.max(
        -1.2,
        Math.min(1.2, st.current.pitch - (e.clientY - drag.y) * 0.004),
      );
      drag = { x: e.clientX, y: e.clientY };
    };
    const pu = (e: PointerEvent) => {
      drag = null;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    dom.addEventListener("keydown", down);
    dom.addEventListener("keyup", up);
    dom.addEventListener("blur", blur);
    dom.addEventListener("pointerdown", pd);
    dom.addEventListener("pointermove", pm);
    dom.addEventListener("pointerup", pu);
    dom.addEventListener("pointercancel", pu);

    return () => {
      dom.removeEventListener("keydown", down);
      dom.removeEventListener("keyup", up);
      dom.removeEventListener("blur", blur);
      dom.removeEventListener("pointerdown", pd);
      dom.removeEventListener("pointermove", pm);
      dom.removeEventListener("pointerup", pu);
      dom.removeEventListener("pointercancel", pu);
      dom.style.touchAction = "";
      camera.near = prevNear;
      camera.fov = prevFov; // back to the orbit camera's lens
      camera.updateProjectionMatrix();
      camera.rotation.order = "XYZ";
    };
  }, [camera, dom]);

  // Declared after the setup effect on purpose: that one saves the orbit fov first.
  useEffect(() => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    const k = keys.current;
    const mv = move.current;

    // three coordinates -> CAD feet
    const isFree = (x: number, z: number) => {
      const px = x + cx;
      const py = -z + cy;
      if (blockedAt(px, py, plans)) return false;
      return !blockers.some((r) => gapToRect(r, { x: px, y: py }) < FURN_R);
    };

    if (!s.placed) {
      const f = findFree(s.x, s.z, isFree);
      s.x = f.x;
      s.z = f.z;
      s.placed = true;
    }

    const turn = (k.tl || mv.tl ? 1 : 0) - (k.tr || mv.tr ? 1 : 0);
    s.yaw += turn * 1.8 * dt;

    const fwd = (k.f || mv.f ? 1 : 0) - (k.b || mv.b ? 1 : 0);
    const strafe = (k.r ? 1 : 0) - (k.l ? 1 : 0);
    if (fwd || strafe) {
      const sp = WALK_SPEED * dt;
      const sin = Math.sin(s.yaw);
      const cos = Math.cos(s.yaw);
      // forward = (-sin, -cos), right = (cos, -sin) in three's x/z
      const dx = (-sin * fwd + cos * strafe) * sp;
      const dz = (-cos * fwd - sin * strafe) * sp;
      // If something was switched on around you, any move is allowed so you can step out.
      const here = isFree(s.x, s.z);
      const can = (x: number, z: number) => !here || isFree(x, z);
      if (can(s.x + dx, s.z)) s.x += dx;
      if (can(s.x, s.z + dz)) s.z += dz;
    }

    camera.position.set(s.x, EYE_FT, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0);
  });

  return null;
}

function Scene({
  geometry,
  b,
  roof,
  labels,
  ao,
  livingFloor,
  furniture,
  ceilings,
  finish,
  night,
  surroundings,
  trees,
  sliceY,
  view,
  doorOpen,
  move,
  fov,
}: {
  geometry: Geometry;
  b: Bounds;
  roof: RoofMode;
  labels: boolean;
  ao: boolean;
  livingFloor: LivingFloor;
  furniture: boolean;
  ceilings: boolean;
  finish: CategoryFinish;
  night: boolean;
  surroundings: boolean;
  trees: boolean;
  sliceY: number | null;
  view: ViewMode;
  doorOpen: number;
  move: MutableRefObject<MoveState>;
  fov: number;
}) {
  const m = useMemo(
    () => createHouseMaterials(finish.doorColor),
    [finish.doorColor],
  );
  useEffect(() => () => m.dispose(), [m]);
  const fm = useMemo(() => createFurnitureMaterials(finish), [finish]);
  useEffect(() => () => fm.dispose(), [fm]);

  // When the house is cut open, render both sides of the walls so the cut
  // edge does not look empty.
  const sliced = sliceY !== null;
  useEffect(() => {
    for (const k of [
      "plasterOuter",
      "plasterInner",
      "concrete",
      "frame",
      "door",
      "ledge",
    ] as const) {
      m[k].side = sliced ? THREE.DoubleSide : THREE.FrontSide;
      m[k].needsUpdate = true;
    }
  }, [m, sliced]);

  const plans = useMemo(() => dedupePlans(planWalls(geometry)), [geometry]);
  const start = useMemo(() => walkStart(geometry, b), [geometry, b]);
  // Same layout the Furniture component draws, so what you see is what blocks you.
  const blockers = useMemo(
    () => (furniture ? furnitureRects(geometry) : []),
    [furniture, geometry],
  );
  const size = Math.max(b.w, b.d, 20);
  const toX = (x: number) => x - b.cx;
  const toZ = (y: number) => -(y - b.cy);

  return (
    <>
      <SliceClip y={sliceY} />
      {night ? (
        <color attach="background" args={["#0b1020"]} />
      ) : (
        <Sky
          sunPosition={[size, size * 1.6, size * 0.6]}
          turbidity={6}
          rayleigh={1.2}
        />
      )}
      <fog
        attach="fog"
        args={[night ? "#0b1020" : "#dbe7f3", size * 4, size * 14]}
      />
      {/* Soft reflections without downloading an HDR file */}
      <Environment resolution={256} environmentIntensity={night ? 0.06 : 1}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 20, 0]}
          scale={[30, 30, 1]}
          rotation-x={Math.PI / 2}
        />
        <Lightformer
          form="rect"
          intensity={1}
          position={[-20, 8, 10]}
          scale={[20, 10, 1]}
          rotation-y={Math.PI / 2}
        />
        <Lightformer
          form="rect"
          intensity={1}
          position={[20, 8, -10]}
          scale={[20, 10, 1]}
          rotation-y={-Math.PI / 2}
        />
      </Environment>
      <ambientLight
        intensity={night ? 0.05 : 0.15}
        color={night ? "#8fa8ff" : "#ffffff"}
      />
      <directionalLight
        position={[size * 0.9, size * 1.6, size * 0.6]}
        intensity={night ? 0.25 : 2.2}
        color={night ? "#8fa8ff" : "#ffffff"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={1}
        shadow-camera-far={size * 6}
      />
      {night && (
        <RoomLights geometry={geometry} cx={b.cx} cy={b.cy} height={b.h} />
      )}

      {/* ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.51, 0]}
        receiveShadow
      >
        <circleGeometry args={[size * 6, 64]} />
        <meshStandardMaterial
          color={night ? "#33442b" : "#7d9a63"}
          roughness={1}
        />
      </mesh>

      {surroundings && geometry.walls.length > 0 && (
        <Surroundings b={b} size={size} trees={trees} night={night} />
      )}

      {geometry.walls.length > 0 && (
        <group>
          <Box
            w={b.w + 2}
            h={0.5}
            d={b.d + 2}
            x={0}
            y={-0.25}
            z={0}
            material={m.concrete}
          />

          {geometry.rooms.map((room) =>
            room.shapes?.length ? (
              <RoomFloor
                key={room.id}
                room={room}
                material={floorFor(room, m, livingFloor)}
                cx={b.cx}
                cy={b.cy}
              />
            ) : null,
          )}

          {plans.map((p) => (
            <Wall
              key={p.wall.id}
              plan={p}
              cx={b.cx}
              cy={b.cy}
              m={m}
              doorOpen={doorOpen}
            />
          ))}

          {labels &&
            geometry.rooms.map((r) =>
              r.labelX === undefined || r.labelY === undefined ? null : (
                <Text
                  key={r.id}
                  position={[toX(r.labelX), 0.05, toZ(r.labelY)]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={1.1}
                  color={night ? "#f5efe0" : "#231f1e"}
                  anchorX="center"
                  anchorY="middle"
                  textAlign="center"
                >
                  {`${r.name}\n${Math.round(r.area)} sq ft`}
                </Text>
              ),
            )}

          {furniture && (
            <Furniture geometry={geometry} cx={b.cx} cy={b.cy} mats={fm} />
          )}
          {ceilings && (
            <Ceilings
              geometry={geometry}
              cx={b.cx}
              cy={b.cy}
              height={b.h}
              finish={finish}
              mats={fm}
            />
          )}

          <Roof mode={roof} b={b} m={m} />
        </group>
      )}

      {view !== "walk" && (
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      )}
      {view === "walk" && geometry.walls.length > 0 && (
        <Walker
          plans={plans}
          blockers={blockers}
          start={start}
          cx={b.cx}
          cy={b.cy}
          move={move}
          fov={fov}
        />
      )}
      <CameraRig view={view} size={size} />

      {ao && (
        <EffectComposer multisampling={0}>
          <N8AO
            aoRadius={2}
            distanceFalloff={1}
            intensity={3}
            quality="medium"
          />
          <ToneMapping />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

const ROOF_LABEL: Record<RoofMode, string> = {
  off: "No roof",
  on: "Roof",
  lift: "Lift roof",
};

const VIEW_LABEL: Record<ViewMode, string> = {
  "3d": "3D",
  plan: "2D plan",
  walk: "Walk",
};

/** Hold-to-move button for touch screens. */
function PadButton({
  label,
  onChange,
  children,
}: {
  label: string;
  onChange: (down: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onPointerLeave={() => onChange(false)}
      className="grid size-11 cursor-pointer touch-none select-none place-items-center rounded-full bg-white/90 text-brand-black shadow-md active:bg-brand active:text-white"
    >
      {children}
    </button>
  );
}

export function HouseViewer({
  geometry,
  livingFloor = "tile",
  category = "B",
}: {
  geometry: Geometry;
  livingFloor?: LivingFloor;
  category?: Category;
}) {
  const [roof, setRoof] = useState<RoofMode>("off");
  const [labels, setLabels] = useState(true);
  const [ao, setAo] = useState(false);
  const [furniture, setFurniture] = useState(true);
  const [ceilings, setCeilings] = useState(false);
  const [night, setNight] = useState(false);
  const [surroundings, setSurroundings] = useState(true);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [linkRooms, setLinkRooms] = useState(true);
  const [fov, setFov] = useState(DEFAULT_FOV);
  const [view, setView] = useState<ViewMode>("3d");
  const [slice, setSlice] = useState(1); // 1 = no cut
  const [isFull, setIsFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<MoveState>({
    f: false,
    b: false,
    tl: false,
    tr: false,
  });

  const finish = CATEGORY_FINISH[category] ?? CATEGORY_FINISH.B;
  const summary = finishSummary(category, livingFloor);

  const b = useMemo(() => boundsOf(geometry), [geometry]);
  // Viewer-only archways where the drawing leaves rooms cut off from each other.
  const viewGeometry = useMemo(
    () => (linkRooms ? addConnectingOpenings(geometry) : geometry),
    [geometry, linkRooms],
  );
  const size = Math.max(b.w, b.d, 20);

  const plan = view === "plan";
  const walking = view === "walk";
  const sliceY = view === "3d" && slice < 0.999 ? slice * b.h : null;

  useEffect(() => {
    const onChange = () =>
      setIsFull(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  }

  function download() {
    const url = wrapRef.current
      ?.querySelector("canvas")
      ?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "house-3d.png";
    a.click();
  }

  const press = (k: keyof MoveState) => (down: boolean) => {
    moveRef.current[k] = down;
  };

  const btn =
    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 font-medium shadow-sm hover:bg-white";

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden border border-stone-200 bg-stone-100 ${
        isFull ? "h-screen rounded-none" : "h-[480px] rounded-xl"
      }`}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: [size * 0.9, size * 0.8, size * 0.9],
          fov: 45,
          near: 0.5,
          far: 3000,
        }}
      >
        <Scene
          geometry={viewGeometry}
          b={b}
          roof={plan || walking ? "off" : roof}
          labels={labels}
          ao={ao}
          livingFloor={livingFloor}
          furniture={furniture}
          ceilings={plan ? false : ceilings}
          finish={finish}
          night={night}
          surroundings={surroundings}
          trees={!plan && sliceY === null}
          sliceY={sliceY}
          view={view}
          doorOpen={doorsOpen ? DOOR_OPEN : 0}
          move={moveRef}
          fov={fov}
        />
      </Canvas>

      <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2 text-xs">
        {/* 3D / 2D plan / Walk */}
        <div className="flex overflow-hidden rounded-lg bg-white/90 shadow-sm">
          {(["3d", "plan", "walk"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`cursor-pointer px-2.5 py-1.5 font-medium ${
                view === v ? "bg-brand text-white" : "hover:bg-stone-100"
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg bg-white/90 shadow-sm">
          {(["off", "on", "lift"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={plan || walking}
              onClick={() => setRoof(mode)}
              className={`cursor-pointer px-2.5 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                roof === mode ? "bg-brand text-white" : "hover:bg-stone-100"
              }`}
            >
              {ROOF_LABEL[mode]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNight((n) => !n)}
          className={btn}
          aria-pressed={night}
        >
          {night ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {night ? "Day" : "Night"}
        </button>
        <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={labels}
            onChange={(e) => setLabels(e.target.checked)}
          />{" "}
          Labels
        </label>
        <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={ao}
            onChange={(e) => setAo(e.target.checked)}
          />{" "}
          Soft shadows
        </label>
        <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={furniture}
            onChange={(e) => setFurniture(e.target.checked)}
          />{" "}
          Furniture
        </label>
        <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={ceilings}
            disabled={plan}
            onChange={(e) => setCeilings(e.target.checked)}
          />{" "}
          Ceilings
        </label>
        <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={doorsOpen}
            onChange={(e) => setDoorsOpen(e.target.checked)}
          />{" "}
          Open doors
        </label>
        <label
          className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm"
          title="Adds archways where the drawing leaves rooms unconnected. Viewer only; not priced."
        >
          <input
            type="checkbox"
            checked={linkRooms}
            onChange={(e) => setLinkRooms(e.target.checked)}
          />{" "}
          Link rooms
        </label>
        <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          <input
            type="checkbox"
            checked={surroundings}
            onChange={(e) => setSurroundings(e.target.checked)}
          />{" "}
          Surroundings
        </label>
        <label className="flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          Cut height
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={slice}
            disabled={view !== "3d"}
            onChange={(e) => setSlice(Number(e.target.value))}
            aria-label="Cut the house open at a height"
            className="w-24 cursor-pointer accent-brand disabled:cursor-not-allowed"
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm">
          FOV {fov}°
          <input
            type="range"
            min={50}
            max={110}
            step={1}
            value={fov}
            disabled={!walking}
            onChange={(e) => setFov(Number(e.target.value))}
            aria-label="Field of view in walk mode"
            className="w-24 cursor-pointer accent-brand disabled:cursor-not-allowed"
          />
        </label>
        <button type="button" onClick={toggleFullscreen} className={btn}>
          {isFull ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
          {isFull ? "Exit fullscreen" : "Fullscreen"}
        </button>
        <button type="button" onClick={download} className={btn}>
          <Download className="size-3.5" /> Download
        </button>
      </div>

      {walking && (
        <>
          <p className="pointer-events-none absolute left-3 top-13 max-w-[260px] rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] leading-snug text-stone-600 shadow-sm">
            Walk mode: drag to look around. Click the view, then use W A S D or
            the arrow keys to move. Doorways are the only way through walls and
            furniture blocks your path.
          </p>
          <div className="absolute bottom-3 right-3 flex flex-col items-center gap-2">
            <PadButton label="Walk forward" onChange={press("f")}>
              <ArrowUp className="size-5" />
            </PadButton>
            <div className="flex gap-2">
              <PadButton label="Turn left" onChange={press("tl")}>
                <ArrowLeft className="size-5" />
              </PadButton>
              <PadButton label="Walk back" onChange={press("b")}>
                <ArrowDown className="size-5" />
              </PadButton>
              <PadButton label="Turn right" onChange={press("tr")}>
                <ArrowRight className="size-5" />
              </PadButton>
            </div>
          </div>
        </>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[270px] rounded-lg bg-white/90 p-2.5 text-[11px] leading-snug text-stone-600 shadow-sm">
        <p className="font-semibold text-brand-black">
          Category {category} finishes
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-[10px] text-stone-400">
          Furniture, finishes, trees, driveway, lighting and any linking
          archways are illustrative. Only flooring and false ceilings are priced
          in the BOQ.
        </p>
      </div>
    </div>
  );
}
