import { Building2, ImageIcon, MapPin } from "lucide-react";

const TOP = "color-mix(in srgb, var(--color-brand) 30%, white)";
const LEFT = "color-mix(in srgb, var(--color-brand) 62%, white)";
const RIGHT = "var(--color-brand)";

export function IsoBox({
  cx,
  cy,
  a,
  h,
}: {
  cx: number;
  cy: number;
  a: number;
  h: number;
}) {
  const fb = [cx, cy];
  const rb = [cx + a, cy - a / 2];
  const lb = [cx - a, cy - a / 2];
  const bb = [cx, cy - a];
  const up = (v: number[]) => [v[0], v[1] - h];
  const pts = (...v: number[][]) => v.map((p) => p.join(",")).join(" ");
  const floors = Math.max(2, Math.round(h / 12));

  return (
    <g>
      <polygon points={pts(lb, fb, up(fb), up(lb))} style={{ fill: LEFT }} />
      <polygon points={pts(fb, rb, up(rb), up(fb))} style={{ fill: RIGHT }} />
      <polygon
        points={pts(up(lb), up(fb), up(rb), up(bb))}
        style={{ fill: TOP }}
      />
      {Array.from({ length: floors - 1 }, (_, i) => {
        const t = (h * (i + 1)) / floors;
        return (
          <g key={i} stroke="white" strokeOpacity={0.35} strokeWidth={1}>
            <line x1={lb[0]} y1={lb[1] - t} x2={fb[0]} y2={fb[1] - t} />
            <line x1={fb[0]} y1={fb[1] - t} x2={rb[0]} y2={rb[1] - t} />
          </g>
        );
      })}
    </g>
  );
}

function Chip({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`absolute grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-lg shadow-blue-900/10 ${className}`}
    >
      {children}
    </span>
  );
}

// Decorative; recolours with the organisation's brand color.
export function CompanyIllustration({
  className = "h-52",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--color-brand) 14%, white), white)",
      }}
    >
      <svg
        viewBox="0 0 270 190"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full"
      >
        <polygon
          points="135,176 245,121 135,66 25,121"
          fill="white"
          fillOpacity={0.7}
          stroke="var(--color-brand)"
          strokeOpacity={0.12}
        />
        <IsoBox cx={135} cy={108} a={22} h={72} />
        <IsoBox cx={86} cy={120} a={26} h={34} />
        <IsoBox cx={184} cy={120} a={22} h={28} />
        <IsoBox cx={135} cy={146} a={18} h={14} />
      </svg>

      <Chip className="left-5 top-7">
        <MapPin className="size-5" />
      </Chip>
      <Chip className="right-5 top-5">
        <Building2 className="size-5" />
      </Chip>
      <Chip className="bottom-6 right-8">
        <ImageIcon className="size-5" />
      </Chip>
    </div>
  );
}
