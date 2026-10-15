import { toast } from "sonner";

/**
 * One door to support. The floating support chat (planned) listens for the
 * `kinika:support` event and calls preventDefault when it opens; until it
 * exists, the founder is told what to do instead.
 */
export type SupportContext = { where: string; problem: string; details?: Record<string, unknown> };

export function openSupport(ctx: SupportContext): boolean {
  const ev = new CustomEvent<SupportContext>("kinika:support", { detail: ctx, cancelable: true });
  const handled = !window.dispatchEvent(ev);
  if (!handled) {
    toast("Support chat is on its way. For now, wait a minute and try again; if it keeps failing, tell us from Settings.", { duration: 8000 });
  }
  return handled;
}
