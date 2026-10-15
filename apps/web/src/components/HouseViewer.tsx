// apps/web/src/components/HouseViewer.tsx
"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import type { Geometry } from "@tmcc/shared-types";

const SILL_FT = 3; // window sill height

function Model({
  geometry,
  showRoof,
  showLabels,
}: {
  geometry: Geometry;
  showRoof: boolean;
  showLabels: boolean;
}) {
  const b = useMemo(() => {
    const xs = geometry.walls.flatMap((s) => [s.startX, s.endX]);
    const ys = geometry.walls.flatMap((s) => [s.startY, s.endY]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: maxX - minX,
      d: maxY - minY,
      h: geometry.walls[0]?.height ?? 10,
    };
  }, [geometry]);

  if (geometry.walls.length === 0) return null;
  // CAD (x, y) -> three (x, -z); y-up is height. rotation.y = CAD angle.
  const toX = (x: number) => x - b.cx;
  const toZ = (y: number) => -(y - b.cy);

  return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[b.w + 2, 0.5, b.d + 2]} />
        <meshStandardMaterial color="#e6e2d9" />
      </mesh>

      {geometry.walls.map((s) => {
        const dx = s.endX - s.startX;
        const dy = s.endY - s.startY;
        const len = Math.hypot(dx, dy);
        if (len === 0) return null;
        return (
          <mesh
            key={s.id}
            position={[
              toX((s.startX + s.endX) / 2),
              s.height / 2,
              toZ((s.startY + s.endY) / 2),
            ]}
            rotation={[0, Math.atan2(dy, dx), 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[len + s.thickness, s.height, s.thickness]} />
            <meshStandardMaterial
              color={s.thickness >= 0.6 ? "#d8d4cc" : "#efece6"}
            />
          </mesh>
        );
      })}

      {geometry.openings.map((o) => {
        if (o.x === undefined || o.y === undefined || o.angle === undefined)
          return null;
        const isDoor = o.type === "door";
        const yMid = isDoor ? o.height / 2 : SILL_FT + o.height / 2;
        return (
          <mesh
            key={o.id}
            position={[toX(o.x), yMid, toZ(o.y)]}
            rotation={[0, o.angle, 0]}
          >
            {/* slightly thicker than the wall so it shows on both faces */}
            <boxGeometry args={[o.width, o.height, 0.9]} />
            <meshStandardMaterial
              color={isDoor ? "#8b5a2b" : "#7fb8e6"}
              transparent={!isDoor}
              opacity={isDoor ? 1 : 0.7}
            />
          </mesh>
        );
      })}

      {showLabels &&
        geometry.rooms.map((r) =>
          r.labelX === undefined || r.labelY === undefined ? null : (
            <Text
              key={r.id}
              position={[toX(r.labelX), 0.06, toZ(r.labelY)]}
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

      {showRoof && (
        <mesh position={[0, b.h + 0.25, 0]} castShadow>
          <boxGeometry args={[b.w + 1, 0.5, b.d + 1]} />
          <meshStandardMaterial color="#b9b4aa" />
        </mesh>
      )}
    </group>
  );
}

export function HouseViewer({ geometry }: { geometry: Geometry }) {
  const [roof, setRoof] = useState(false);
  const [labels, setLabels] = useState(true);
  const size = Math.max(
    ...geometry.walls.flatMap((s) =>
      [s.endX - s.startX, s.endY - s.startY].map(Math.abs),
    ),
    20,
  );

  return (
    <div className="relative h-[480px] w-full rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
      <Canvas
        shadows
        camera={{ position: [size * 0.8, size, size * 0.8], fov: 45 }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[size, size * 1.5, size / 2]}
          intensity={1.1}
          castShadow
        />
        <Model geometry={geometry} showRoof={roof} showLabels={labels} />
        <Grid
          args={[200, 200]}
          position={[0, -0.51, 0]}
          cellColor="#ccc"
          sectionColor="#aaa"
          fadeDistance={150}
        />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <div className="absolute top-3 right-3 flex gap-2 text-xs">
        <label className="bg-white/90 rounded px-2 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={roof}
            onChange={(e) => setRoof(e.target.checked)}
          />{" "}
          Roof
        </label>
        <label className="bg-white/90 rounded px-2 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={labels}
            onChange={(e) => setLabels(e.target.checked)}
          />{" "}
          Labels
        </label>
      </div>
    </div>
  );
}
