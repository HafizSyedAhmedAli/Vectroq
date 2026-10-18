import { NextResponse } from "next/server";
import { hasRole, type Role } from "./roles";
import { getAuth, type AuthContext } from "./session";

export type GuardResult =
  | { ok: true; auth: AuthContext }
  | { ok: false; res: NextResponse };

export async function guard(min: Role = "VIEWER"): Promise<GuardResult> {
  const auth = await getAuth();
  if (!auth) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  if (!hasRole(auth.role, min)) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "You don't have permission to do this." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, auth };
}
