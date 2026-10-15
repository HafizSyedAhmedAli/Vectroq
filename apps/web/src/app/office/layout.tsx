import { OfficeNav } from "@/components/OfficeNav";

export default function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OfficeNav />
      {children}
    </>
  );
}
