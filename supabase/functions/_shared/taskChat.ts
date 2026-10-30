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

export interface TaskPromptTexts { intro: string; rules: string; contract: string; followups: string }

/** The task block: intro with the task and numbered deliverables, the rules, the state-line contract, the follow-up guidance. All text comes from Admin → Prompts. */
export function taskPromptBlock(ctx: TaskChatContext, texts: TaskPromptTexts): string {
  // Deliverables are numbered D1, D2… for the model; the ids never reach the founder.
  const list = ctx.deliverables.map((d, i) => `D${i + 1} [${d.done ? 'done' : d.withAgent ? `with ${d.withAgent}, Kinika hired them; wait for the founder to approve their result` : 'open'}] ${d.title} (${d.kind}): ${d.detail}`).join('\n');
  const task = `${ctx.task.title}${ctx.task.detail ? ` — ${ctx.task.detail}` : ''} (target: ${ctx.task.target_title})`;
  const intro = texts.intro.split('{{task}}').join(task).split('{{deliverables}}').join(list);
  return [intro, texts.rules, texts.contract, texts.followups].join('\n');
}

/** Kinika's reply when working a task: the clean text, the deliverables it closed (with outcomes) and a document if it wrote one. */
export interface ReplyOption { label: string; value: string }
/** A suggested next message: the chip reads the theme (label); clicking it puts the full request (value) in the box. */
export interface Suggestion { label: string; value: string }
export type NeedRole = 'legal' | 'research' | 'copy' | 'design' | 'seo' | 'dev' | 'community' | 'other';
export interface TaskNeed { deliverableId: string | null; role: NeedRole; label: string; why: string; brief: string }
const NEED_ROLES: NeedRole[] = ['legal', 'research', 'copy', 'design', 'seo', 'dev', 'community', 'other'];

/** What of a reply still streaming may be shown: everything before the first machine tag, and no half-typed tag at the end. */
export function visibleWhileStreaming(text: string): { text: string; writingDocument: boolean } {
  const cut = text.search(/<(STATE|DELIVERABLE_DONE)\b|(^|\n)[ \t]*STATE:?[ \t]*\{/i);
  let shown = cut >= 0 ? text.slice(0, cut) : text;
  let writingDocument = false;
  const doc = shown.search(/<DOCUMENT\b/i);
  if (doc >= 0) { shown = shown.slice(0, doc); writingDocument = true; }
  // A tag that has only begun to arrive ("<STA", "<DOC") is not text yet.
  shown = shown.replace(/<[A-Za-z_]{0,16}$/, '');
  return { text: shown.replace(/```\s*$/, '').trimEnd(), writingDocument };
}

/** Where the first document block stood, until the note that replaces it is written. */
const DOC_MARK = '[[kinika-document]]';

export function parseTaskReply(text: string, deliverables?: { id: string; title?: string }[]): { text: string; done: { id: string; result: string | null }[]; document: { title: string; body: string } | null; suggestions: Suggestion[]; options: ReplyOption[]; needs: TaskNeed | null; connect: 'social' | null } {
  const done: { id: string; result: string | null }[] = [];
  let suggestions: Suggestion[] = [];
  let options: ReplyOption[] = [];
  let needs: TaskNeed | null = null;
  let connect: 'social' | null = null;
  // Kinika names a deliverable as D2, by its id, or by its title; each resolves to the id.
  const idFor = (ref: string): string | null => {
    const r = ref.trim();
    if (!r) return null;
    const m = /^D(\d+)$/i.exec(r);
    if (m && deliverables) return deliverables[Number(m[1]) - 1]?.id ?? null;
    if (!deliverables) return r;
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return deliverables.find((d) => d.id === r)?.id ?? deliverables.find((d) => d.title && norm(d.title) === norm(r))?.id ?? null;
  };
  let clean = text;
  // The state line, possibly wrapped in a code fence.
  clean = clean.replace(/```[a-z]*\s*(<STATE>[\s\S]*?<\/STATE>)\s*```/gi, '$1');
  // The model sometimes drops the tags ("STATE {…}") or the closing one: the JSON is found by its braces and tagged.
  clean = tagBareState(clean);
  clean = clean.replace(/<STATE>\s*([\s\S]*?)\s*<\/STATE>/gi, (_m, body) => {
    try {
      const parsed = JSON.parse(String(body));
      for (const c of Array.isArray(parsed?.closed) ? parsed.closed : []) {
        const id = idFor(String(c?.d ?? c?.id ?? ''));
        if (id) done.push({ id, result: String(c?.outcome ?? '').trim() || null });
      }
      // A suggestion is { label, value }; a plain string (the older shape) is both.
      suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : []).map((x: unknown): Suggestion => {
        if (x && typeof x === 'object') { const o = x as { label?: unknown; value?: unknown }; const value = String(o.value ?? o.label ?? '').trim().slice(0, 300); return { label: String(o.label ?? value).trim().slice(0, 60), value }; }
        const t = String(x ?? '').trim().slice(0, 300); return { label: t.slice(0, 60), value: t };
      }).filter((x: Suggestion) => x.label && x.value).slice(0, 3);
      const n = parsed?.needs;
      if (n && typeof n === 'object' && String(n.label ?? '').trim()) {
        const role = NEED_ROLES.includes(n.role) ? n.role as NeedRole : 'other';
        needs = { deliverableId: n.d ? idFor(String(n.d)) : null, role, label: String(n.label).trim().slice(0, 40), why: String(n.why ?? '').trim().slice(0, 300), brief: String(n.brief ?? '').trim().slice(0, 1200) };
      }
      if (String(parsed?.connect ?? '').toLowerCase() === 'social') connect = 'social';
      options = (Array.isArray(parsed?.options) ? parsed.options : []).map((o: { label?: unknown; value?: unknown }) => ({ label: String(o?.label ?? '').trim().slice(0, 60), value: String(o?.value ?? o?.label ?? '').trim().slice(0, 300) })).filter((o: ReplyOption) => o.label && o.value).slice(0, 4);
    } catch { /* an unreadable state line closes nothing */ }
    return '';
  });
  // The older tag form, still honoured.
  clean = clean
    .replace(/<DELIVERABLE_DONE\s+id=["']([^"']+)["']\s*>([\s\S]*?)<\/DELIVERABLE_DONE>/gi, (_m, ref, body) => { const id = idFor(String(ref)); if (id) done.push({ id, result: String(body).trim() || null }); return ''; })
    .replace(/<DELIVERABLE_DONE\s+id=["']([^"']+)["']\s*\/?>/gi, (_m, ref) => { const id = idFor(String(ref)); if (id) done.push({ id, result: null }); return ''; });
  // Anything left that looks like our machinery never reaches the founder.
  clean = clean.replace(/<\/?(STATE|DELIVERABLE_DONE)[^>]*>/gi, '').replace(/^\s*STATE:?\s*(\{.*)?$/gim, '');
  // Documents: one surface per task, so several blocks in one reply become one document with a section each.
  const docs: { title: string; body: string }[] = [];
  clean = clean
    .replace(/```[a-z]*\s*(<DOCUMENT\b[\s\S]*?<\/DOCUMENT>)\s*```/gi, '$1')
    .replace(/<DOCUMENT\s+title=["']([^"']*)["']\s*>([\s\S]*?)(?:<\/DOCUMENT>|$)/gi, (_m, title, body) => {
      const b = String(body).trim();
      if (b) docs.push({ title: String(title).trim() || 'Document', body: b });
      return docs.length === 1 && b ? DOC_MARK : '';
    })
    .replace(/<\/?DOCUMENT[^>]*>/gi, '');
  let document: { title: string; body: string } | null = null;
  if (docs.length) {
    document = { title: docs[0].title, body: docs.map((d, i) => (i === 0 ? d.body : `## ${d.title}\n\n${d.body}`)).join('\n\n') };
    const names = docs.map((d) => d.title).join(' and ');
    clean = clean.replace(DOC_MARK, `\n\n*Written: ${names}. It is open beside this conversation; edit any line.*`);
  }
  clean = clean.split(DOC_MARK).join('');
  return { text: clean.replace(/\n{3,}/g, '\n\n').trim(), done, document, suggestions, options, needs, connect };
}

/** Find a bare "STATE {…}" (or an unclosed "<STATE>{…") and wrap the balanced JSON in the tags the parser reads. */
function tagBareState(text: string): string {
  const re = /(^|\n)[ \t]*(?:<STATE>|STATE:?)[ \t]*(?=\{)/gi;
  let m: RegExpExecArray | null;
  let out = text;
  while ((m = re.exec(out))) {
    const start = m.index + m[0].length;
    const end = balancedEnd(out, start);
    if (end < 0) break;
    const after = out.slice(end).replace(/^\s*<\/STATE>/i, '');
    out = `${out.slice(0, m.index)}${m[1]}<STATE>${out.slice(start, end)}</STATE>${after}`;
    re.lastIndex = m.index + m[1].length + 7;
  }
  return out;
}

/** The index just past the brace that closes the one at `start`, ignoring braces inside strings; -1 when unbalanced. */
function balancedEnd(text: string, start: number): number {
  let depth = 0; let inStr = false; let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}
