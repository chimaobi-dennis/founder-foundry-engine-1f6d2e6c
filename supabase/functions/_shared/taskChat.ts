/**
 * Kinika working one plan task with the founder: the prompt block, the reply
 * parser and what may be shown while a reply streams. Used by the task-chat
 * function and by the browser (through the @shared alias).
 */

/** What the workspace passes when Kinika is working one task with the founder. */
export interface TaskChatContext {
  task: { id: string; title: string; detail: string | null; target_title: string };
  deliverables: { id: string; title: string; detail: string; kind: string; done: boolean; withAgent?: string | null }[];
}

export function taskPromptBlock(ctx: TaskChatContext): string {
  // Deliverables are numbered D1, D2… for the model; the ids never reach the founder.
  const list = ctx.deliverables.map((d, i) => `D${i + 1} [${d.done ? 'done' : d.withAgent ? `with ${d.withAgent}, Kinika hired them; wait for the founder to approve their result` : 'open'}] ${d.title} (${d.kind}): ${d.detail}`).join('\n');
  return [
    'WORKING ONE TASK WITH THE FOUNDER (the workspace). You are Kinika, the founder\'s business manager, doing this task together with the founder right now. Stay on this task; the plan-level conversation is elsewhere.',
    `TASK: ${ctx.task.title}${ctx.task.detail ? ` — ${ctx.task.detail}` : ''} (target: ${ctx.task.target_title})`,
    `DELIVERABLES (the task is complete when all are done):\n${list}`,
    'How to work: take the open deliverables in order. Ask one sharp question at a time when you need the founder\'s decision; propose a concrete default when the context allows. Keep replies short and plain. Never show the D-numbers or any ids to the founder; refer to deliverables by name.',
    'When a deliverable is a written thing (a document, outline, template, pricing table), write it in full inside <DOCUMENT title="...">markdown</DOCUMENT> once the decisions are made. The founder can edit it; say so in a sentence. A document never contains placeholder brackets like [Insert ...] or blanks to fill: where a number or term is not decided yet, write a line "Your decision: ..." in the document and list those decisions in the reply.',
    'Nobody is in this conversation but you and the founder. Never invent, address or wait on a person who is not here (an advisor, a lawyer, a client, a designer). Kinika is the manager: it does not do specialist work itself (legal drafting, design, code, deep research, outreach). When a deliverable needs that work, say plainly what you will not do and why, put it in "needs" on the state line, and carry on with what you can do: the brief for that person, the decisions already made, the questions to ask them.',
    'STATE LINE, REQUIRED: end EVERY reply with exactly one line <STATE>{"closed":[{"d":"D2","outcome":"..."}],"suggestions":["...","...","..."],"options":[{"label":"...","value":"..."}],"needs":{"d":"D2","role":"legal","label":"Legal drafter","why":"...","brief":"..."}}</STATE>. "needs" is present only when the work on a deliverable should be done by a specialist or an outside person, not by Kinika or the founder alone: role is one of legal, research, copy, design, seo, dev, community, other; label is the role in two or three words; why is one sentence; brief is what that person must deliver, in two or three sentences, with the decisions already made. Omit "needs" otherwise. "closed" lists the deliverables that became complete in THIS reply because the founder decided or approved; each outcome is what the founder keeps, in Markdown: for a list, the list itself; for a decision, the decision in one or two plain sentences with the reason; for an action, what was done and when. When nothing became complete, "closed" is []. If you say you have noted a decision, that deliverable must be in "closed". "suggestions" are exactly three short replies the founder might give next, in the founder\'s own voice, 3 to 9 words each, genuinely different from each other (one can be a question back). "options" is only present when your question is a choice: 2 to 4 options with a short label (2 to 6 words) and the value as the founder would say it; add one option for "something else" when the list is not exhaustive. The founder never sees this line as text.',
  ].join('\n');
}

/** Kinika's reply when working a task: the clean text, the deliverables it closed (with outcomes) and a document if it wrote one. */
export interface ReplyOption { label: string; value: string }
export type NeedRole = 'legal' | 'research' | 'copy' | 'design' | 'seo' | 'dev' | 'community' | 'other';
export interface TaskNeed { deliverableId: string | null; role: NeedRole; label: string; why: string; brief: string }
const NEED_ROLES: NeedRole[] = ['legal', 'research', 'copy', 'design', 'seo', 'dev', 'community', 'other'];

/** What of a reply still streaming may be shown: everything before the first machine tag, and no half-typed tag at the end. */
export function visibleWhileStreaming(text: string): { text: string; writingDocument: boolean } {
  const cut = text.search(/<(STATE|DELIVERABLE_DONE)\b/i);
  let shown = cut >= 0 ? text.slice(0, cut) : text;
  let writingDocument = false;
  const doc = shown.search(/<DOCUMENT\b/i);
  if (doc >= 0) { shown = shown.slice(0, doc); writingDocument = true; }
  // A tag that has only begun to arrive ("<STA", "<DOC") is not text yet.
  shown = shown.replace(/<[A-Za-z_]{0,16}$/, '');
  return { text: shown.replace(/```\s*$/, '').trimEnd(), writingDocument };
}

export function parseTaskReply(text: string, deliverables?: { id: string }[]): { text: string; done: { id: string; result: string | null }[]; document: { title: string; body: string } | null; suggestions: string[]; options: ReplyOption[]; needs: TaskNeed | null } {
  const done: { id: string; result: string | null }[] = [];
  let suggestions: string[] = [];
  let options: ReplyOption[] = [];
  let needs: TaskNeed | null = null;
  const idFor = (ref: string): string | null => {
    const m = /^D(\d+)$/i.exec(ref.trim());
    if (m && deliverables) return deliverables[Number(m[1]) - 1]?.id ?? null;
    return ref.trim() || null;
  };
  let clean = text;
  // The state line, possibly wrapped in a code fence.
  clean = clean.replace(/```[a-z]*\s*(<STATE>[\s\S]*?<\/STATE>)\s*```/gi, '$1');
  clean = clean.replace(/<STATE>\s*([\s\S]*?)\s*<\/STATE>/gi, (_m, body) => {
    try {
      const parsed = JSON.parse(String(body));
      for (const c of Array.isArray(parsed?.closed) ? parsed.closed : []) {
        const id = idFor(String(c?.d ?? c?.id ?? ''));
        if (id) done.push({ id, result: String(c?.outcome ?? '').trim() || null });
      }
      suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : []).map((x: unknown) => String(x ?? '').trim()).filter((x: string) => x && x.length <= 120).slice(0, 3);
      const n = parsed?.needs;
      if (n && typeof n === 'object' && String(n.label ?? '').trim()) {
        const role = NEED_ROLES.includes(n.role) ? n.role as NeedRole : 'other';
        needs = { deliverableId: n.d ? idFor(String(n.d)) : null, role, label: String(n.label).trim().slice(0, 40), why: String(n.why ?? '').trim().slice(0, 300), brief: String(n.brief ?? '').trim().slice(0, 1200) };
      }
      options = (Array.isArray(parsed?.options) ? parsed.options : []).map((o: { label?: unknown; value?: unknown }) => ({ label: String(o?.label ?? '').trim().slice(0, 60), value: String(o?.value ?? o?.label ?? '').trim().slice(0, 300) })).filter((o: ReplyOption) => o.label && o.value).slice(0, 4);
    } catch { /* an unreadable state line closes nothing */ }
    return '';
  });
  // The older tag form, still honoured.
  clean = clean
    .replace(/<DELIVERABLE_DONE\s+id=["']([^"']+)["']\s*>([\s\S]*?)<\/DELIVERABLE_DONE>/gi, (_m, ref, body) => { const id = idFor(String(ref)); if (id) done.push({ id, result: String(body).trim() || null }); return ''; })
    .replace(/<DELIVERABLE_DONE\s+id=["']([^"']+)["']\s*\/?>/gi, (_m, ref) => { const id = idFor(String(ref)); if (id) done.push({ id, result: null }); return ''; });
  // Anything left that looks like our machinery never reaches the founder.
  clean = clean.replace(/<\/?(STATE|DELIVERABLE_DONE)[^>]*>/gi, '').replace(/^\s*STATE:.*$/gim, '');
  let document: { title: string; body: string } | null = null;
  const m = clean.match(/<DOCUMENT\s+title=["']([^"']*)["']>([\s\S]*?)<\/DOCUMENT>/);
  if (m) { document = { title: m[1].trim() || 'Document', body: m[2].trim() }; clean = clean.replace(m[0], `\n\n*Written: ${document.title}. It is open beside this conversation; edit any line.*`); }
  return { text: clean.replace(/\n{3,}/g, '\n\n').trim(), done, document, suggestions, options, needs };
}
