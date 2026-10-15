import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { brand } from "@/lib/brand";
import { BrandLogo } from "./BrandLogo";

function FooterItem({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-white mt-0.5">{icon}</span>
      <div>
        <p className="font-semibold text-white mb-1">{title}</p>
        <p className="text-stone-400 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export function SiteFooter() {
  const { contact, offices } = brand;
  return (
    <footer className="print:hidden bg-[#1c1a19] text-stone-300">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-wrap gap-x-10 gap-y-6 text-xs">
        <div className="bg-white rounded-md p-2 w-fit h-fit">
          <BrandLogo className="h-9 w-auto" />
        </div>
        {offices.map((o) => (
          <FooterItem
            key={o.title}
            icon={<MapPin className="size-4" />}
            title={o.title}
          >
            {o.address}
          </FooterItem>
        ))}
        {contact.phone && (
          <FooterItem icon={<Phone className="size-4" />} title="Phone">
            {contact.phone}
          </FooterItem>
        )}
        {contact.email && (
          <FooterItem icon={<Mail className="size-4" />} title="Email">
            {contact.email}
          </FooterItem>
        )}
        {contact.website && (
          <FooterItem icon={<Globe className="size-4" />} title="Website">
            {contact.website}
          </FooterItem>
        )}
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between text-[11px] text-stone-400">
          <span className="text-white">{brand.name}</span>
          <span className="text-white">{brand.tagline}</span>
        </div>
      </div>
      <div className="h-1 flex">
        <span className="w-24 bg-brand" />
        <span className="w-24 bg-brand-gold" />
      </div>
    </footer>
  );
}
