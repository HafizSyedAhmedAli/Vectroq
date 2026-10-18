export const ROLES = ["OWNER", "ESTIMATOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ESTIMATOR: "Estimator",
  VIEWER: "Viewer",
};

const RANK: Record<Role, number> = { VIEWER: 1, ESTIMATOR: 2, OWNER: 3 };

export const isRole = (v: unknown): v is Role =>
  typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** True when `role` is at least as powerful as `min`. */
export const hasRole = (role: Role, min: Role) => RANK[role] >= RANK[min];
