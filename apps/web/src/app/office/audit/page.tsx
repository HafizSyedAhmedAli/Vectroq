import Link from "next/link";
import { ScrollText } from "lucide-react";
import { prisma } from "@vectroq/db";
import { requirePage } from "@/lib/org";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  CAD_UPLOADED: "Drawing uploaded",
  GEOMETRY_EDITED: "Drawing corrected",
  BOQ_CALCULATED: "BOQ calculated",
  SHARE_CREATED: "Client link created",
  SHARE_REVOKED: "Client link revoked",
  RULES_UPDATED: "Business rules changed",
  RATES_IMPORTED: "Rates imported",
  RATE_SET_APPROVED: "Rate set approved",
  MEMBER_ROLE_CHANGED: "Member role changed",
  MEMBER_REMOVED: "Member removed",
};

const pkr = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function details(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => {
      const isMoney = /total/i.test(k) && typeof v === "number";
      const val = isMoney
        ? `Rs ${pkr.format(v as number)}`
        : Array.isArray(v)
          ? v.join(", ")
          : String(v);
      return `${k}: ${val}`;
    })
    .join(" · ");
}

export default async function AuditPage() {
  const { org } = await requirePage("OWNER");
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-stone-50 to-white pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold text-brand-black">
          <ScrollText className="size-7 text-brand" /> Audit log
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Who changed drawings, BOQs, rates and rules. Latest 200 entries.
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
              <tr>
                {["When", "Who", "Action", "Details"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-stone-400"
                  >
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-stone-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                    {l.createdAt.toLocaleString("en-PK", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">{l.userEmail ?? "-"}</td>
                  <td className="px-4 py-3 font-semibold text-brand-black">
                    {l.entityType === "Project" && l.entityId ? (
                      <Link
                        href={`/office/${l.entityId}`}
                        className="text-brand hover:underline"
                      >
                        {LABEL[l.action] ?? l.action}
                      </Link>
                    ) : (
                      (LABEL[l.action] ?? l.action)
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {details(l.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
