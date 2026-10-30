/**
 * Queue when out of credits. A run that cannot reserve its credits does not
 * fail and does not pause for the founder: it waits (status
 * `waiting_credits`) with the amount it needs, and the minute tick continues
 * the oldest waiting run as soon as the wallet covers it. Nothing is spent
 * while waiting; credits already captured stay captured. Pure module, shared
 * by the runner and the browser.
 */

export const WAITING_CREDITS = "waiting_credits";

/** A board holds at most this many waiting runs; later ones are skipped with a note, so a top-up never floods the founder. */
export const MAX_WAITING_PER_BOARD = 5;

export function waitingWords(needed: number, available: number): string {
  return `Waiting for credits: this run needs about ${Math.max(1, Math.ceil(needed))}, you have ${Math.max(0, Math.floor(available))} available. Add credits and it continues on its own, or stop it.`;
}

export function queueFullWords(boardName: string, max = MAX_WAITING_PER_BOARD): string {
  return `Skipped: ${max} runs of "${boardName}" are already waiting for credits. Add credits and the waiting ones run first.`;
}

/** Where a waiting run goes back to: a run that never reserved starts over (queued, reserve on first touch); one mid-run continues. */
export function resumeStatusFor(run: { generation_id?: string | null }): "queued" | "running" {
  return run.generation_id ? "running" : "queued";
}

export interface WaitingRun { id: string; user_id: string; credits_needed: number | null }
export interface WalletRow { user_id: string; balance: number; reserved_balance: number }

/**
 * Which waiting runs the wallets now cover, oldest first per founder, each
 * one taking its share before the next is considered.
 */
export function fundInOrder(runs: WaitingRun[], wallets: WalletRow[]): string[] {
  const available = new Map<string, number>();
  for (const w of wallets) available.set(w.user_id, Number(w.balance) - Number(w.reserved_balance));
  const out: string[] = [];
  for (const r of runs) {
    const need = Math.max(1, Number(r.credits_needed) || 1);
    const have = available.get(r.user_id);
    if (have == null || have < need) continue;
    available.set(r.user_id, have - need);
    out.push(r.id);
  }
  return out;
}
