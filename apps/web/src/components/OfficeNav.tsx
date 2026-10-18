"use client";

import type { Brand } from "@/lib/brand";
import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Phone } from "lucide-react";
import { ROLE_LABEL, hasRole, type Role } from "@/lib/auth/roles";

const LINKS = [
  { href: "/office/leads", label: "1 · Leads" },
  { href: "/office", label: "2 · Projects", exact: true },
  { href: "/office/rates", label: "Rates" },
  { href: "/office/team", label: "Team", owner: true },
  { href: "/office/settings", label: "Settings", owner: true },
];

const OTHER = LINKS.filter((l) => !l.exact).map((l) => l.href);

export function OfficeNav({
  brand,
  orgSlug,
  role,
  userName,
}: {
  brand: Brand;
  orgSlug: string;
  role: Role;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = LINKS.filter((l) => !l.owner || hasRole(role, "OWNER"));
  const active = (l: (typeof LINKS)[number]) =>
    l.exact
      ? pathname === l.href ||
        (pathname.startsWith("/office/") &&
          !OTHER.some((p) => pathname.startsWith(p)))
      : pathname.startsWith(l.href);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="print:hidden bg-white/90 backdrop-blur border-b border-stone-100">
      <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        <Link href="/office/leads" className="flex items-center gap-2">
          <BrandLogo brand={brand} />
          <span className="hidden sm:inline text-xs font-medium text-stone-500 border-l border-stone-200 pl-2">
            Dashboard
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 text-sm">
            {links.map((l) => (
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
              className="hidden lg:flex items-center gap-2 text-sm font-semibold text-brand-black"
            >
              <Phone className="size-4 text-brand" />
              {brand.contact.phone}
            </a>
          )}
          <div className="flex items-center gap-2 border-l border-stone-200 pl-4 text-xs text-stone-500">
            <span className="hidden md:block text-right leading-tight">
              <span className="block font-semibold text-brand-black">
                {userName}
              </span>
              {ROLE_LABEL[role]}
            </span>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-stone-100"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
