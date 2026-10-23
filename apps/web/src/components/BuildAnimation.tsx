"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Box, Maximize2, Minimize2, RotateCcw } from "lucide-react";

type V = [number, number, number];
interface Palette {
  top: string;
  left: string;
  right: string;
}

// Isometric projection: CAD-style (x, y, z) -> screen. Larger x + y = nearer.
const sx = (x: number, y: number) => 300 + (x - y) * 0.866;
const sy = (x: number, y: number, z = 0) => 120 + (x + y) * 0.5 - z;
const pts = (...v: V[]) =>
  v
    .map(([x, y, z]) => `${sx(x, y).toFixed(1)},${sy(x, y, z).toFixed(1)}`)
    .join(" ");

const LAWN: Palette = { top: "#d7eed9", left: "#a9cdb0", right: "#93bb9b" };
const FOUND: Palette = { top: "#cfcac0", left: "#b8b3a8", right: "#a29d92" };
const WALL: Palette = { top: "#fbfaf6", left: "#ece8df", right: "#d6d1c5" };
const SLAB: Palette = { top: "#e4e1d9", left: "#c9c5ba", right: "#b3afa3" };
const ROOF: Palette = {
  top: "color-mix(in srgb, var(--color-brand) 30%, white)",
  left: "color-mix(in srgb, var(--color-brand) 62%, white)",
  right: "var(--color-brand)",
};
const CAR_BODY: Palette = { top: "#ffffff", left: "#e9eef2", right: "#cfd7de" };
const CAR_GLASS: Palette = {
  top: "#bcd7ea",
  left: "#9fbed3",
  right: "#86a7bd",
};

const STEPS = [
  "Marking the plot",
  "Pouring the foundation",
  "Raising the ground floor",
  "Adding the upper floor",
  "Fitting doors & windows",
  "Placing the roof",
  "Landscaping the site",
  "Ready for your quote",
];
const LAST = STEPS.length; // stage 0 = empty, stage 8 = finished
// How long each stage is held (ms). The last one is the "finished" pause.
const DURATIONS = [700, 1200, 1300, 1900, 1900, 1500, 1300, 2000, 4500];

function Block({
  x0,
  y0,
  x1,
  y1,
  z0,
  z1,
  c,
}: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
  c: Palette;
}) {
  return (
    <g>
      {/* left face (y = y1), right face (x = x1), top */}
      <polygon
        points={pts([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1])}
        style={{ fill: c.left }}
      />
      <polygon
        points={pts([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1])}
        style={{ fill: c.right }}
      />
      <polygon
        points={pts([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1])}
        style={{ fill: c.top }}
      />
    </g>
  );
}

/** Fades and moves its children into place when `on` turns true. */
function Pop({
  on,
  from = "translateY(-30px)",
  delay = 0,
  children,
}: {
  on: boolean;
  from?: string;
  delay?: number;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    opacity: on ? 1 : 0,
    transform: on ? "none" : from,
    transformBox: "fill-box",
    transformOrigin: "50% 100%",
    transition: `opacity .7s ease ${delay}ms, transform .9s cubic-bezier(.22,1,.36,1) ${delay}ms`,
  };
  return <g style={style}>{children}</g>;
}

/** Reveals its children from the bottom up, like a wall being built. */
function Rise({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <g
      style={{
        clipPath: on ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)",
        transition: "clip-path 1.3s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {children}
    </g>
  );
}

function Tree({
  x,
  y,
  s = 1,
  on,
  delay,
}: {
  x: number;
  y: number;
  s?: number;
  on: boolean;
  delay: number;
}) {
  return (
    <g
      transform={`translate(${sx(x, y).toFixed(1)} ${sy(x, y).toFixed(1)}) scale(${s})`}
    >
      <Pop on={on} from="scale(0)" delay={delay}>
        <ellipse
          cx="0"
          cy="0"
          rx="16"
          ry="8"
          style={{ fill: "rgba(0,0,0,.12)" }}
        />
        <rect
          x="-2.5"
          y="-24"
          width="5"
          height="24"
          rx="2"
          style={{ fill: "#7a5533" }}
        />
        <circle cx="-8" cy="-30" r="10" style={{ fill: "#4e8a49" }} />
        <circle cx="0" cy="-36" r="17" style={{ fill: "#5f9a55" }} />
        <circle cx="7" cy="-46" r="11" style={{ fill: "#79b268" }} />
      </Pop>
    </g>
  );
}

const winY = (y: number, xa: number, xb: number, za: number, zb: number) =>
  pts([xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]);
const winX = (x: number, ya: number, yb: number, za: number, zb: number) =>
  pts([x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]);

export function BuildAnimation({ className = "" }: { className?: string }) {
  const [stage, setStage] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [full, setFull] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Respect "reduce motion": show the finished house and stop.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setStage(LAST);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Advance through the stages, then start over.
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => setStage((s) => (s >= LAST ? 0 : s + 1)),
      DURATIONS[stage],
    );
    return () => clearTimeout(t);
  }, [stage, reduced]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  }

  const at = (n: number) => stage >= n;
  const glass = at(8) ? "#ffe2a0" : "#a9d3ee"; // windows light up when finished
  const Win = ({ points }: { points: string }) => (
    <polygon
      points={points}
      style={{
        fill: glass,
        stroke: "#ffffff",
        strokeWidth: 1.2,
        transition: "fill .9s ease",
      }}
    />
  );

  const label = stage === 0 ? "Breaking ground" : STEPS[stage - 1];
  const round =
    "grid size-10 cursor-pointer place-items-center rounded-full bg-white text-brand-black shadow-md transition hover:text-brand";

  return (
    <div
      ref={wrap}
      className={`relative select-none ${
        full ? "flex h-screen items-center justify-center bg-white" : ""
      } ${className}`}
    >
      <svg
        viewBox="0 0 600 420"
        role="img"
        aria-label="A house being built step by step, from an empty plot to a finished home"
        className="block h-auto w-full max-h-full"
      >
        {/* 1. Plot */}
        <Pop on={at(1)} from="translateY(24px)">
          <Block x0={-60} y0={-60} x1={260} y1={260} z0={-12} z1={0} c={LAWN} />
        </Pop>
        <polygon
          points={pts(
            [-48, -48, 0],
            [248, -48, 0],
            [248, 248, 0],
            [-48, 248, 0],
          )}
          pathLength={1}
          style={{
            fill: "none",
            stroke: "var(--color-brand)",
            strokeWidth: 1.6,
            strokeOpacity: 0.55,
            strokeLinejoin: "round",
            strokeDasharray: 1,
            strokeDashoffset: at(1) ? 0 : 1,
            transition: "stroke-dashoffset 1.4s ease .3s",
          }}
        />

        {/* Trees behind the house */}
        <Tree x={-30} y={10} s={1.05} on={at(7)} delay={0} />
        <Tree x={-35} y={120} s={0.95} on={at(7)} delay={120} />

        {/* 2. Foundation */}
        <Pop on={at(2)} from="translateY(-16px)">
          <Block x0={20} y0={30} x1={200} y1={180} z0={0} z1={6} c={FOUND} />
        </Pop>

        {/* 3. Ground floor */}
        <Rise on={at(3)}>
          <Block x0={30} y0={40} x1={190} y1={170} z0={0} z1={76} c={WALL} />
        </Rise>

        {/* 6. Terrace slab (drops in with the roof) */}
        <Pop on={at(6)} from="translateY(-34px)">
          <Block x0={26} y0={36} x1={194} y1={174} z0={76} z1={80} c={SLAB} />
        </Pop>

        {/* 4. Upper floor */}
        <Rise on={at(4)}>
          <Block x0={76} y0={40} x1={190} y1={124} z0={76} z1={130} c={WALL} />
        </Rise>

        {/* 5. Door and windows */}
        <Pop on={at(5)} from="none">
          <polygon
            points={pts(
              [48, 170, 0],
              [66, 170, 0],
              [66, 170, 50],
              [48, 170, 50],
            )}
            style={{ fill: "var(--color-brand)" }}
          />
          <circle
            cx={sx(62, 170)}
            cy={sy(62, 170, 24)}
            r="1.4"
            style={{ fill: "#ffffff" }}
          />
          <Win points={winY(170, 84, 116, 22, 56)} />
          <Win points={winY(170, 130, 172, 22, 56)} />
          <Win points={winX(190, 60, 90, 22, 56)} />
          <Win points={winX(190, 110, 150, 22, 56)} />
          <Win points={winY(124, 92, 122, 92, 120)} />
          <Win points={winY(124, 142, 176, 92, 120)} />
          <Win points={winX(190, 54, 80, 92, 120)} />
          <Win points={winX(190, 90, 114, 92, 120)} />
        </Pop>

        {/* 6. Roof cap */}
        <Pop on={at(6)} from="translateY(-50px)" delay={150}>
          <Block x0={72} y0={36} x1={194} y1={128} z0={130} z1={137} c={ROOF} />
        </Pop>

        {/* 7. Driveway, car, trees in front */}
        <Pop on={at(7)} from="translateY(10px)">
          <polygon
            points={pts(
              [120, 180, 0.4],
              [170, 180, 0.4],
              [170, 260, 0.4],
              [120, 260, 0.4],
            )}
            style={{ fill: "#8a8d91" }}
          />
        </Pop>
        <Pop on={at(7)} from="translate(-52px, 30px)" delay={500}>
          <Block
            x0={134}
            y0={196}
            x1={156}
            y1={240}
            z0={3}
            z1={11}
            c={CAR_BODY}
          />
          <Block
            x0={137}
            y0={206}
            x1={153}
            y1={230}
            z0={11}
            z1={18}
            c={CAR_GLASS}
          />
        </Pop>
        <Tree x={240} y={10} s={1} on={at(7)} delay={200} />
        <Tree x={240} y={150} s={1.05} on={at(7)} delay={320} />
        <Tree x={40} y={225} s={1.1} on={at(7)} delay={440} />
        <Tree x={215} y={230} s={1.15} on={at(7)} delay={560} />
      </svg>

      {/* Live badge */}
      <span className="absolute right-2 top-2 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-black shadow-md backdrop-blur">
        <Box className="size-3.5 text-brand" />
        3D Preview
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-brand" />
        </span>
      </span>

      {/* Progress */}
      <div
        aria-hidden
        className="absolute bottom-3 left-2 max-w-[60%] rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-md backdrop-blur"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          {stage === 0 ? "Starting" : `Step ${stage} of ${LAST}`}
        </p>
        <p className="text-sm font-bold text-brand-black">{label}</p>
        <div className="mt-2 flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 w-4 rounded-full transition-colors duration-500 ${
                stage > i ? "bg-brand" : "bg-stone-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 right-2 flex gap-2">
        <button
          type="button"
          aria-label="Replay the build"
          onClick={() => setStage(reduced ? LAST : 0)}
          className={round}
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          aria-label={full ? "Exit fullscreen" : "View fullscreen"}
          onClick={toggleFullscreen}
          className={round}
        >
          {full ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
