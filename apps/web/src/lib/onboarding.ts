import { prisma } from "@vectroq/db";
import type { Organization } from "@vectroq/db";

export interface OnboardingStep {
  id: string;
  title: string;
  text: string;
  done: boolean;
  href: string;
  cta: string;
  external?: boolean;
}

export async function getOnboardingSteps(
  org: Organization,
): Promise<OnboardingStep[]> {
  const [ownRates, leadCount, firstProject, cads] = await Promise.all([
    prisma.rateSet.count({
      where: { organizationId: org.id, status: "APPROVED" },
    }),
    prisma.lead.count({ where: { organizationId: org.id } }),
    prisma.project.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.cadFile.findMany({
      where: { project: { organizationId: org.id } },
      select: { projectId: true, boq: true },
    }),
  ]);

  const hasBranding =
    !!(org.tagline || org.phone || org.logoUrl) ||
    (Array.isArray(org.offices) && org.offices.length > 0);
  const hasBoq = cads.some((c) => c.boq !== null);
  const needsBoq = cads.find((c) => c.boq === null);
  const projectHref = (id?: string) => (id ? `/office/${id}` : "/office/leads");

  return [
    {
      id: "branding",
      title: "Set your branding",
      text: "Add your logo, color, phone and offices. They appear on your form, BOQ and PDF.",
      done: hasBranding,
      href: "/office/settings",
      cta: "Open settings",
    },
    {
      id: "rates",
      title: "Add your own rates (optional)",
      text: "Default rates already work. Import your CSV schedule to override them.",
      done: ownRates > 0,
      href: "/office/rates",
      cta: "Manage rates",
    },
    {
      id: "lead",
      title: "Receive your first request",
      text: "Share your public intake form with a client, or load the sample project below.",
      done: leadCount > 0,
      href: `/c/${org.slug}`,
      cta: "Open client form",
      external: true,
    },
    {
      id: "project",
      title: "Create a project",
      text: "Turn a lead into a project once you have met the client.",
      done: !!firstProject,
      href: "/office/leads",
      cta: "Review leads",
    },
    {
      id: "drawing",
      title: "Upload a drawing",
      text: "Upload a DXF plan, or use the sample plan, and check what was read.",
      done: cads.length > 0,
      href: projectHref(firstProject?.id),
      cta: "Open project",
    },
    {
      id: "boq",
      title: "Calculate your first BOQ",
      text: "Price the drawing and share it with your client.",
      done: hasBoq,
      href: projectHref(needsBoq?.projectId ?? firstProject?.id),
      cta: "Open project",
    },
  ];
}
