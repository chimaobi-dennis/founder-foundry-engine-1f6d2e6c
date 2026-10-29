/**
 * Branches and failure, in plain words.
 *
 * A board can decide before it works: "if it is a complaint, the Copywriter
 * replies; otherwise ask me". Kinika classifies what arrived against the
 * founder's question (a fast model call), and the chosen option says what
 * happens: run the agent with that option's brief, ask the founder first, or
 * skip this one. A board also says what to do when a step fails: skip the
 * step, ask the founder (the run pauses and can be resumed or the step
 * skipped), or stop. Every failure reaches the founder as a sentence they can
 * act on, never a status code. Pure module, shared with the browser.
 */

export type BranchAction = "run" | "ask" | "skip";
export interface BranchOption { label: string; action: BranchAction; brief: string }
export interface Branches { question: string; options: BranchOption[] }
export type OnFailure = "skip" | "ask" | "stop";

export const ON_FAILURE_WORDS: Record<OnFailure, string> = {
  skip: "skip that step and carry on",
  ask: "pause and ask you",
  stop: "stop the run",
};

export function coerceOnFailure(raw: unknown, fallback: OnFailure = "ask"): OnFailure {
  return raw === "skip" || raw === "ask" || raw === "stop" ? raw : fallback;
}

/** Two to four options; the last one is the "otherwise". Nothing usable → null (no branch). */
export function coerceBranches(raw: unknown): Branches | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const question = typeof r.question === "string" ? r.question.trim().slice(0, 160) : "";
  if (!question) return null;
  const options = (Array.isArray(r.options) ? r.options : [])
    .map((o) => {
      const x = (o ?? {}) as Record<string, unknown>;
      const label = typeof x.label === "string" ? x.label.trim().slice(0, 60) : "";
      const action: BranchAction = x.action === "ask" || x.action === "skip" ? x.action : "run";
      const brief = typeof x.brief === "string" ? x.brief.trim().slice(0, 600) : "";
      return label ? { label, action, brief } : null;
    })
    .filter((o): o is BranchOption => !!o)
    .slice(0, 4);
  return options.length >= 2 ? { question, options } : null;
}

/** The option a classifier's answer names; the last option when nothing matches ("otherwise"). */
export function pickBranch(branches: Branches, answer: unknown): BranchOption {
  const a = String((answer as Record<string, unknown>)?.choice ?? answer ?? "").trim().toLowerCase();
  const exact = branches.options.find((o) => o.label.toLowerCase() === a);
  if (exact) return exact;
  const loose = branches.options.find((o) => a && (a.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(a)));
  return loose ?? branches.options[branches.options.length - 1];
}

/** "Kinika decides: if it is a complaint, the Copywriter replies; otherwise asks you." */
export function branchWords(b: Branches, agentName: string): string {
  const parts = b.options.map((o, i) => {
    const cond = i === b.options.length - 1 && b.options.length > 1 ? "otherwise" : `if ${o.label.toLowerCase()}`;
    const does = o.action === "ask" ? "asks you" : o.action === "skip" ? "skips it" : `the ${agentName} does it`;
    return `${cond}, ${does}`;
  });
  return `Kinika decides: ${parts.join("; ")}`;
}

/** A failure as the founder should read it: what happened and what to do. */
export function plainFailure(raw: string | null | undefined): { what: string; next: string } {
  const m = String(raw ?? "").trim();
  const t = m.toLowerCase();
  if (/insufficient|not enough credits|balance/.test(t)) return { what: "Kinika ran out of credits for this step.", next: "Top up, then press Try again." };
  if (/401|403|unauthori[sz]ed|forbidden|refused|invalid[_ ]token|token has expired|reconnect/.test(t)) return { what: "The connected tool refused Kinika's sign-in.", next: "Reconnect it on Kinika's team, then press Try again." };
  if (/404|not found|no longer|is gone/.test(t)) return { what: "What Kinika was pointed at is not there any more.", next: "Check the connection or the task, then press Try again." };
  if (/timed? ?out|timeout|504|took too long|deadline/.test(t)) return { what: "The service took too long to answer.", next: "Press Try again; it usually works the second time." };
  if (/429|rate limit|slow down|too many requests/.test(t)) return { what: "The service asked Kinika to slow down.", next: "Wait a few minutes, then press Try again." };
  if (/structured output|unexpected shape|not valid json|parse/.test(t)) return { what: "The agent answered in a shape Kinika could not use.", next: "Press Try again; a second attempt usually works. If it keeps happening, tell Kinika to simplify the task." };
  if (/no agent attached|no agent/.test(t)) return { what: "This run has no agent on it.", next: "Set the task up again from your plan." };
  if (/gateway returned|did not answer|no answer|model/.test(t)) return { what: "Kinika's model did not answer.", next: "Press Try again in a moment." };
  if (/schema|migration/.test(t)) return { what: "The task asked for a database change, which Kinika does not do.", next: "Change the task, or do that part in your own tools." };
  return { what: m ? `Something went wrong: ${m.slice(0, 200)}` : "Something went wrong.", next: "Press Try again, skip this step, or stop the run." };
}

export function failureSentence(raw: string | null | undefined): string {
  const f = plainFailure(raw);
  return `${f.what} ${f.next}`;
}
