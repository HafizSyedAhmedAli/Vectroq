import { MapPin } from "lucide-react";
import type { Brand } from "@/lib/brand";
import { BrandLogo } from "./BrandLogo";

const withScheme = (site: string) =>
  /^https?:\/\//i.test(site) ? site : `https://${site}`;

function Skyline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 70"
      fill="currentColor"
      className="pointer-events-none absolute bottom-0 right-6 hidden h-16 text-white/10 md:block"
    >
      <rect x="0" y="40" width="22" height="30" />
      <rect x="26" y="22" width="18" height="48" />
      <rect x="48" y="34" width="26" height="36" />
      <path d="M84 70V44a22 22 0 0 1 44 0v26z" />
      <rect x="136" y="16" width="14" height="54" />
      <rect x="154" y="30" width="24" height="40" />
      <rect x="182" y="44" width="22" height="26" />
      <rect x="208" y="26" width="16" height="44" />
    </svg>
  );
}

export function SiteFooter({ brand }: { brand: Brand }) {
  const { contact, offices } = brand;

  // Add About / Privacy / Terms here once those pages exist.
  const links = [
    contact.website && {
      label: "Website",
      href: withScheme(contact.website),
      external: true,
    },
    contact.email && { label: "Email us", href: `mailto:${contact.email}` },
    contact.phone && {
      label: "Call us",
      href: `tel:${contact.phone.replace(/\s/g, "")}`,
    },
  ].filter(Boolean) as { label: string; href: string; external?: boolean }[];

  return (
    <footer className="print:hidden relative overflow-hidden bg-[color-mix(in_srgb,var(--color-brand)_32%,black)] text-stone-300">
      <Skyline />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-5 px-4 py-8">
        <div className="h-fit w-fit rounded-md bg-white p-2">
          <BrandLogo brand={brand} className="h-9 w-auto" />
        </div>
        {links.length > 0 && (
          <>
            <span
              aria-hidden
              className="hidden h-10 w-px bg-white/20 sm:block"
            />
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {links.map((l, i) => (
                <span key={l.label} className="flex items-center gap-5">
                  {i > 0 && (
                    <span aria-hidden className="h-4 w-px bg-white/20" />
                  )}
                  <a
                    href={l.href}
                    target={l.external ? "_blank" : undefined}
                    rel={l.external ? "noreferrer" : undefined}
                    className="text-stone-400 transition hover:text-white"
                  >
                    {l.label}
                  </a>
                </span>
              ))}
            </nav>
          </>
        )}
      </div>

      {offices.length > 0 && (
        <div className="relative mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-2 px-4 pb-6 text-xs text-stone-400">
          {offices.map((o) => (
            <span key={o.title} className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-white/70" />
              <span>
                <b className="font-semibold text-stone-200">{o.title}:</b>{" "}
                {o.address}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-[11px] text-stone-400">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          {brand.tagline && <span>{brand.tagline}</span>}
        </div>
      </div>
      <div className="h-3 bg-brand" />
    </footer>
  );
}
