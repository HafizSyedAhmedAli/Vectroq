import { prisma, Prisma } from "@vectroq/db";
import type { AuthContext } from "@/lib/auth/session";

export type AuditAction =
  | "CAD_UPLOADED"
  | "GEOMETRY_EDITED"
  | "BOQ_CALCULATED"
  | "SHARE_CREATED"
  | "SHARE_REVOKED"
  | "RULES_UPDATED"
  | "RATES_IMPORTED"
  | "RATE_SET_APPROVED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED";

/** Never throws: a logging problem must not break the action being logged. */
export async function audit(
  auth: Pick<AuthContext, "org" | "user">,
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: auth.org.id,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action,
        entityType,
        entityId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("Audit log write failed", action, err);
  }
}
