"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
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
import { Download, Maximize2, Minimize2 } from "lucide-react";
import type { Geometry, Room } from "@vectroq/shared-types";
import {
  createHouseMaterials,
  type HouseMaterials,
  type LivingFloor,
} from "./viewer/materials";
import { planWalls, type WallCut, type WallPlan } from "./viewer/wall-cuts";

type RoofMode = "off" | "on" | "lift";

interface Bounds {
  cx: number;
  cy: number;
  w: number;
  d: number;
  h: number;
}

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

/** Frame + door leaf, or frame + glass + sill, sitting in a hole in the wall. */
function Fixture({
  cut,
  th,
  m,
}: {
  cut: WallCut;
  th: number;
  m: HouseMaterials;
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
        <>
          <Box
            w={w - 2 * f}
            h={h - f}
            d={0.12}
            x={x}
            y={cut.y0 + (h - f) / 2}
            z={0}
            material={m.door}
          />
          <Box
            w={0.5}
            h={0.08}
            d={0.2}
            x={x + (w - 2 * f) / 2 - 0.4}
            y={3.2}
            z={0}
            material={m.brass}
          />
        </>
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

function Wall({
  plan,
  cx,
  cy,
  m,
}: {
  plan: WallPlan;
  cx: number;
  cy: number;
  m: HouseMaterials;
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
      {cuts.map((c) => (
        <Fixture key={c.openingId} cut={c} th={th} m={m} />
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

function Scene({
  geometry,
  b,
  roof,
  labels,
  ao,
  livingFloor,
}: {
  geometry: Geometry;
  b: Bounds;
  roof: RoofMode;
  labels: boolean;
  ao: boolean;
  livingFloor: LivingFloor;
}) {
  const m = useMemo(() => createHouseMaterials(), []);
  useEffect(() => () => m.dispose(), [m]);
  const plans = useMemo(() => planWalls(geometry), [geometry]);
  const size = Math.max(b.w, b.d, 20);
  const toX = (x: number) => x - b.cx;
  const toZ = (y: number) => -(y - b.cy);

  return (
    <>
      <fog attach="fog" args={["#dbe7f3", size * 4, size * 14]} />
      <Sky
        sunPosition={[size, size * 1.6, size * 0.6]}
        turbidity={6}
        rayleigh={1.2}
      />
      {/* Soft reflections without downloading an HDR file */}
      <Environment resolution={256}>
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
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[size * 0.9, size * 1.6, size * 0.6]}
        intensity={2.2}
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

      {/* ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.51, 0]}
        receiveShadow
      >
        <circleGeometry args={[size * 6, 64]} />
        <meshStandardMaterial color="#7d9a63" roughness={1} />
      </mesh>

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
            <Wall key={p.wall.id} plan={p} cx={b.cx} cy={b.cy} m={m} />
          ))}

          {labels &&
            geometry.rooms.map((r) =>
              r.labelX === undefined || r.labelY === undefined ? null : (
                <Text
                  key={r.id}
                  position={[toX(r.labelX), 0.05, toZ(r.labelY)]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={1.1}
                  color="#231f1e"
                  anchorX="center"
                  anchorY="middle"
                  textAlign="center"
                >
                  {`${r.name}\n${Math.round(r.area)} sq ft`}
                </Text>
              ),
            )}

          <Roof mode={roof} b={b} m={m} />
        </group>
      )}

      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />

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

export function HouseViewer({
  geometry,
  livingFloor = "tile",
}: {
  geometry: Geometry;
  livingFloor?: LivingFloor;
}) {
  const [roof, setRoof] = useState<RoofMode>("off");
  const [labels, setLabels] = useState(true);
  const [ao, setAo] = useState(true);
  const [isFull, setIsFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const b = useMemo(() => boundsOf(geometry), [geometry]);
  const size = Math.max(b.w, b.d, 20);

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
          geometry={geometry}
          b={b}
          roof={roof}
          labels={labels}
          ao={ao}
          livingFloor={livingFloor}
        />
      </Canvas>

      <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2 text-xs">
        <div className="flex overflow-hidden rounded-lg bg-white/90 shadow-sm">
          {(["off", "on", "lift"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRoof(mode)}
              className={`cursor-pointer px-2.5 py-1.5 font-medium ${
                roof === mode ? "bg-brand text-white" : "hover:bg-stone-100"
              }`}
            >
              {ROOF_LABEL[mode]}
            </button>
          ))}
        </div>
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
    </div>
  );
}
