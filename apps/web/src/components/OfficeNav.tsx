"use client";

import type { Brand } from "@/lib/brand";
import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";

const LINKS = [
  { href: "/office/leads", label: "1 · Leads" },
  { href: "/office", label: "2 · Projects", exact: true },
  { href: "/office/rates", label: "Rates" },
  { href: "/office/settings", label: "Settings" },
];

const OTHER = ["/office/leads", "/office/rates", "/office/settings"];

export function OfficeNav({
  brand,
  orgSlug,
}: {
  brand: Brand;
  orgSlug: string;
}) {
  const pathname = usePathname();
  const active = (l: (typeof LINKS)[number]) =>
    l.exact
      ? pathname === l.href ||
        (pathname.startsWith("/office/") &&
          !OTHER.some((p) => pathname.startsWith(p)))
      : pathname.startsWith(l.href);
  return (
    <header className="print:hidden bg-white/90 backdrop-blur border-b border-stone-100">
      <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        <Link href="/office/leads" className="flex items-center gap-2">
          <BrandLogo brand={brand} />
          <span className="hidden sm:inline text-xs font-medium text-stone-500 border-l border-stone-200 pl-2">
            Dashboard
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-1 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg font-medium ${active(l) ? "bg-brand text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={`/c/${orgSlug}`}
              target="_blank"
              className="ml-2 px-3 py-1.5 text-stone-500 hover:text-brand"
            >
              Client form ↗
            </Link>
          </nav>
          {brand.contact.phone && (
            <a
              href={`tel:${brand.contact.phone.replace(/\s/g, "")}`}
              className="hidden md:flex items-center gap-2 text-sm font-semibold text-brand-black"
            >
              <Phone className="size-4 text-brand" />
              {brand.contact.phone}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
