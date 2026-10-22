import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";
import { createSampleProject } from "@/lib/sample-project";
import { appUrl } from "@/lib/app-url";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const g = await guard("ESTIMATOR");
  if (!g.ok) return g.res;
  try {
    const r = await createSampleProject(g.auth.org, appUrl(req));
    return NextResponse.json(r, { status: 201 });
  } catch (err) {
    console.error("Sample project failed", err);
    return NextResponse.json(
      { error: "Could not create the sample project." },
      { status: 500 },
    );
  }
}
