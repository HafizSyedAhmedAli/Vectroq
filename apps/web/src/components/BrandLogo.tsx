import Image from "next/image";
import { brand } from "@/lib/brand";

export function BrandLogo({
  className = "h-11 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  if (!brand.logo) {
    return (
      <span className="text-xl font-extrabold tracking-tight text-brand-black">
        {brand.name}
      </span>
    );
  }
  return (
    <Image
      src={brand.logo.src}
      alt={brand.name}
      width={brand.logo.width}
      height={brand.logo.height}
      className={className}
      priority={priority}
    />
  );
}
