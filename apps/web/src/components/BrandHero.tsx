import { Box, FileText, Tag } from "lucide-react";
import { IsoBox } from "./CompanyIllustration";

function Chip({
  className,
  icon,
  label,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={`absolute flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-black shadow-lg shadow-black/5 ${className}`}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-brand text-white">
        {icon}
      </span>
      {label}
    </span>
  );
}

// Decorative hero that follows the organisation's brand color.
export function BrandHero() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 hidden h-[430px] w-[46%] lg:block [mask-image:linear-gradient(to_right,transparent,black_45%)]"
    >
      <div className="bg-blueprint absolute inset-0" />
      <svg
        viewBox="0 0 540 430"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full"
      >
        <polygon
          points="300,380 500,280 300,180 100,280"
          fillOpacity={0.7}
          stroke="var(--color-brand)"
          strokeOpacity={0.15}
          style={{ fill: "var(--color-white)" }}
        />
        <IsoBox cx={300} cy={262} a={70} h={120} />
        <IsoBox cx={205} cy={292} a={48} h={62} />
        <IsoBox cx={395} cy={292} a={44} h={52} />
        <IsoBox cx={300} cy={336} a={30} h={20} />
      </svg>

      <Chip
        className="left-[18%] top-[22%]"
        icon={<Box className="size-4" />}
        label="3D model"
      />
      <Chip
        className="right-[10%] top-[14%]"
        icon={<FileText className="size-4" />}
        label="Priced BOQ"
      />
      <Chip
        className="right-[16%] top-[58%]"
        icon={<Tag className="size-4" />}
        label="Approved rates"
      />
    </div>
  );
}
