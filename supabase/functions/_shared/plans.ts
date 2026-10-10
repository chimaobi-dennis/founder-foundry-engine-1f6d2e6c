/**
 * Plan entitlements — pure helpers shared by the UI and tests. The database
 * computes the same thing in get_entitlements() and enforces it in triggers;
 * this is for friendly messages before the founder hits a wall.
 */

export interface PlanLimits {
  /** -1 means unlimited */
  agents: number;
  automations: number;
  connections: number;
  members: number;
  autonomous_publishing: boolean;
  code_repos: number;
  enterprise: boolean;
}

export interface Entitlements extends PlanLimits {
  plan_slug: string;
  plan_name: string;
  status: "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  monthly_credits: number;
  extra_agent_seats: number;
  extra_member_seats: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export const FREE_LIMITS: PlanLimits = {
  agents: 0,   // the trial is plans and consultation; no agent seats
  automations: 1,
  connections: 1,
  members: 1,
  autonomous_publishing: false,
  code_repos: 0,
  enterprise: false,
};

export type LimitKind = "agents" | "automations" | "connections" | "members" | "code_repos";

export const LIMIT_LABEL: Record<LimitKind, string> = {
  agents: "agents on your team",
  automations: "active schedules",
  connections: "connected tools",
  members: "team members",
  code_repos: "connected repositories",
};

/** Effective cap for a kind, seats included. -1 is unlimited. */
export function effectiveLimit(ent: Pick<Entitlements, LimitKind | "extra_agent_seats" | "extra_member_seats">, kind: LimitKind): number {
  const base = ent[kind];
  if (base < 0) return -1;
  if (kind === "agents") return base + (ent.extra_agent_seats ?? 0);
  if (kind === "members") return base + (ent.extra_member_seats ?? 0);
  return base;
}

export type AllowVerdict = { ok: true; remaining: number } | { ok: false; limit: number; reason: string };

/** Can one more of `kind` be added given `current` in use? */
export function planAllows(ent: Pick<Entitlements, LimitKind | "extra_agent_seats" | "extra_member_seats" | "plan_name">, kind: LimitKind, current: number): AllowVerdict {
  const limit = effectiveLimit(ent, kind);
  if (limit < 0) return { ok: true, remaining: -1 };
  if (current < limit) return { ok: true, remaining: limit - current };
  const seatNote = kind === "agents" ? " Add an agent seat or upgrade." : kind === "members" ? " Add a member seat or upgrade." : " Upgrade to add more.";
  return { ok: false, limit, reason: `${ent.plan_name} includes ${limit} ${LIMIT_LABEL[kind]}.${seatNote}` };
}

/** Status values that count as paid-and-usable. */
export function isActiveStatus(status: Entitlements["status"]): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

// ── Workspace roles ──────────────────────────────────────────────────────────

export type BrandRole = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<BrandRole, number> = { viewer: 1, editor: 2, owner: 3 };

/** Is `role` at least `min`? Unknown or null roles never qualify. */
export function roleAtLeast(role: BrandRole | null | undefined, min: BrandRole): boolean {
  if (!role || !(role in ROLE_RANK)) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_LABEL: Record<BrandRole, { name: string; blurb: string }> = {
  owner: { name: "Owner", blurb: "Pays the plan, manages people and connections." },
  editor: { name: "Editor", blurb: "Gives tasks, approves work, edits content." },
  viewer: { name: "Viewer", blurb: "Sees everything, changes nothing." },
};
