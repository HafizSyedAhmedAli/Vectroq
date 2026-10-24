import { NextRequest, NextResponse } from "next/server";
import {
  PLAN_FILE_MAX_BYTES,
  validateLeadIntake,
  validatePlanFile,
  type LeadIntakeInput,
} from "@vectroq/lead-intake";
import { canonicalCityName, resolveOrgRules } from "@vectroq/shared-types";
import { estimateLead } from "@vectroq/rate-cards";
import { prisma } from "@vectroq/db";
import { getLiveRateCard } from "@/lib/rate-sets";
import { pickLeadData, readLeadRequest } from "@/lib/lead-request";
import { savePlanFile } from "@/lib/save-plan-file";
import { getOrgBySlug } from "@/lib/org";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { botSignals, verifyTurnstile } from "@/lib/bot-check";
import { checkFileContent } from "@/lib/upload-guard";
import { audit } from "@/lib/audit";

const MAX_REQUEST_BYTES = PLAN_FILE_MAX_BYTES + 512 * 1024;
const LEAD_IP_LIMIT = Number(process.env.LEAD_IP_LIMIT) || 8;

export async function POST(req: NextRequest) {
  // 1. Throttle before doing any work (including reading a 10 MB body).
  const ip = clientIp(req);
  const byIp = await rateLimit(`lead:ip:${ip}`, LEAD_IP_LIMIT, 600);
  if (!byIp.ok) return tooMany(byIp);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  }

  const { body, planFile } = await readLeadRequest(req);
  const raw = (body ?? {}) as Partial<LeadIntakeInput> & {
    orgSlug?: unknown;
    bot?: unknown;
  };

  if (typeof raw.orgSlug !== "string") {
    return NextResponse.json({ error: "Missing company." }, { status: 400 });
  }
  const org = await getOrgBySlug(raw.orgSlug);
  if (!org) {
    return NextResponse.json({ error: "Unknown company." }, { status: 404 });
  }

  // 2. A botnet spreads across IPs, so also cap each company per day.
  const byOrg = await rateLimit(`lead:org:${org.id}`, 500, 86_400);
  if (!byOrg.ok) {
    return tooMany(
      byOrg,
      "This company is receiving too many requests right now. Please try again later.",
    );
  }

  // 3. Bot checks.
  const verdict = botSignals(raw.bot);
  if (verdict === "honeypot") {
    // Pretend it worked so the bot doesn't adapt. Nothing is saved.
    return NextResponse.json({ id: "ok", estimate: null }, { status: 201 });
  }
  const human =
    verdict === "ok" &&
    (await verifyTurnstile(
      (raw.bot as { turnstileToken?: unknown } | undefined)?.turnstileToken,
      ip,
    ));
  if (!human) {
    return NextResponse.json(
      {
        error:
          "We couldn't verify your submission. Please reload the page and try again.",
      },
      { status: 400 },
    );
  }

  // 4. Validation, including the file's real contents.
  const input = raw as Partial<LeadIntakeInput>;
  const result = validateLeadIntake(input);
  const planFileError = planFile
    ? (validatePlanFile(planFile) ?? (await checkFileContent(planFile)))
    : null;
  if (!result.valid || planFileError) {
    return NextResponse.json(
      {
        errors: {
          ...result.errors,
          ...(planFileError ? { planFile: planFileError } : {}),
        },
      },
      { status: 400 },
    );
  }

  const city = canonicalCityName(input.city) ?? input.city!.trim();
  const rules = resolveOrgRules(org.rules);

  let lead = await prisma.lead.create({
    data: pickLeadData({ ...(input as LeadIntakeInput), city }, org.id),
  });

  if (planFile) {
    try {
      const planFileUrl = await savePlanFile(lead.id, planFile);
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { planFileUrl, planFileName: planFile.name },
      });
    } catch (err) {
      console.error("Could not save lead plan file", err);
    }
  }

  await audit({ org }, "LEAD_CREATED", "Lead", lead.id, {
    city,
    source: "FORM",
    hasPlanFile: !!planFile,
  });

  const rateCard = await getLiveRateCard(
    org.id,
    city,
    input.category!,
    rules,
  ).catch(() => null);
  const estimate = estimateLead({
    model: input.model!,
    rateCard: rateCard ?? undefined,
    rules,
  });

  return NextResponse.json({ ...lead, estimate }, { status: 201 });
}
