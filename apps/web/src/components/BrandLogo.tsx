import type { Brand } from "@/lib/brand";

export function BrandLogo({
  brand,
  className = "h-11 w-auto",
}: {
  brand: Brand;
  className?: string;
  priority?: boolean;
}) {
  if (!brand.logoUrl) {
    return (
      <span className="text-xl font-extrabold tracking-tight text-brand-black">
        {brand.name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- org logos are arbitrary blob URLs
    <img src={brand.logoUrl} alt={brand.name} className={className} />
  );
}
