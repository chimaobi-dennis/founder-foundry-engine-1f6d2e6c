/**
 * Watch sources: what a board can wait for. The catalog is pure and shared
 * with the browser (the planner lists it, the board draws it). The readers
 * run only in edge functions, where the credentials are: each returns the
 * items newer than a cursor, oldest first, in one plain shape.
 */
import { getOAuthAccessToken } from "./oauth.ts";

export type WatchSourceKey = "gmail_inbox" | "slack_channel" | "shopify_orders" | "wordpress_comments" | "github_issues";

export interface WatchSourceSpec {
  key: WatchSourceKey;
  name: string;
  /** The tool_connections.provider this source reads through. */
  provider: string;
  /** What arrives, singular and plural, for sentences. */
  noun: string;
  nouns: string;
  /** Options the founder chooses at set-up, if any. */
  options: { key: string; label: string; placeholder: string }[];
  /** How often the tick looks, in minutes. */
  intervalMinutes: number;
  /** Plain words for the board's When circle. */
  words: string;
}

export const WATCH_SOURCES: Record<WatchSourceKey, WatchSourceSpec> = {
  gmail_inbox: { key: "gmail_inbox", name: "Gmail", provider: "google", noun: "email", nouns: "emails", options: [{ key: "query", label: "Only emails matching (optional)", placeholder: "from:orders@ OR subject:invoice" }], intervalMinutes: 5, words: "When a new email arrives" },
  slack_channel: { key: "slack_channel", name: "Slack", provider: "slack", noun: "message", nouns: "messages", options: [{ key: "channel", label: "Channel id", placeholder: "C0123456789" }], intervalMinutes: 5, words: "When a new Slack message arrives" },
  shopify_orders: { key: "shopify_orders", name: "Shopify", provider: "shopify", noun: "order", nouns: "orders", options: [], intervalMinutes: 10, words: "When a new order comes in" },
  wordpress_comments: { key: "wordpress_comments", name: "WordPress", provider: "wordpress", noun: "comment", nouns: "comments", options: [], intervalMinutes: 15, words: "When a new comment is posted" },
  github_issues: { key: "github_issues", name: "GitHub", provider: "github", noun: "issue", nouns: "issues", options: [], intervalMinutes: 15, words: "When a new issue is opened" },
};

export function watchSourceFor(key: unknown): WatchSourceSpec | null {
  return typeof key === "string" && key in WATCH_SOURCES ? WATCH_SOURCES[key as WatchSourceKey] : null;
}

/** Sources a workspace can watch, given its connections. */
export function availableWatchSources(connections: { id: string; provider: string; display_name?: string; status?: string }[]): { source: WatchSourceSpec; connection_id: string; display_name: string }[] {
  const out: { source: WatchSourceSpec; connection_id: string; display_name: string }[] = [];
  for (const s of Object.values(WATCH_SOURCES)) {
    const c = connections.find((c) => c.provider === s.provider && (!c.status || c.status === "active"));
    if (c) out.push({ source: s, connection_id: c.id, display_name: c.display_name ?? s.name });
  }
  return out;
}

/** The lines the planner prompt gets under SOURCES. */
export function watchSourcesBlock(available: { source: WatchSourceSpec; display_name: string }[]): string {
  return available.length ? available.map((a) => `- ${a.source.key}: ${a.source.words.toLowerCase()} (${a.source.name}: ${a.display_name})`).join("\n") : "(none connected)";
}

export interface WatchConfig {
  source: WatchSourceKey;
  connection_id: string;
  options: Record<string, string>;
  interval_minutes: number;
  cursor: { at: string; id: string | null } | null;
  started_from: WatchItem | null;
}

export interface WatchItem {
  id: string;
  at: string;
  title: string;
  text: string;
  from: string;
  url: string | null;
}

/** Everything the brief gets about one item, bounded. */
export function itemForBrief(item: WatchItem): string {
  return [`WHAT ARRIVED (${item.at}):`, `From: ${item.from}`, `Title: ${item.title}`, item.url ? `Link: ${item.url}` : "", "", item.text.slice(0, 3000)].filter((l) => l !== "").join("\n");
}

// ── Readers (edge functions only) ──────────────────────────────────────────

type Secret = Record<string, string>;
export interface ReadArgs { since: string | null; limit: number }

function strip(html: string): string { return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim(); }
function b64decode(s: string): string { try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))); } catch { return ""; } }

async function gmail(token: string, options: Record<string, string>, a: ReadArgs): Promise<WatchItem[]> {
  const q = [options.query ?? "", a.since ? `after:${Math.floor(new Date(a.since).getTime() / 1000)}` : "", "-in:sent -in:drafts -category:promotions"].filter(Boolean).join(" ");
  const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${a.limit}&q=${encodeURIComponent(q)}`, { headers: { authorization: `Bearer ${token}` } });
  const lj = await list.json().catch(() => null);
  if (!list.ok) throw new Error(`Gmail: ${lj?.error?.message ?? list.status}`);
  const ids: string[] = (lj?.messages ?? []).map((m: { id: string }) => m.id);
  const items: WatchItem[] = [];
  for (const id of ids) {
    const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: { authorization: `Bearer ${token}` } });
    const m = await r.json().catch(() => null);
    if (!r.ok || !m) continue;
    const h = (name: string) => (m.payload?.headers ?? []).find((x: { name: string }) => x.name.toLowerCase() === name)?.value ?? "";
    let body = "";
    const walk = (p: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }) => { if (!body && p?.mimeType === "text/plain" && p.body?.data) body = b64decode(p.body.data); for (const c of (p?.parts ?? []) as never[]) walk(c); };
    walk(m.payload ?? {});
    if (!body) { const walkHtml = (p: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }) => { if (!body && p?.mimeType === "text/html" && p.body?.data) body = strip(b64decode(p.body.data)); for (const c of (p?.parts ?? []) as never[]) walkHtml(c); }; walkHtml(m.payload ?? {}); }
    items.push({ id: `gmail:${m.id}`, at: new Date(Number(m.internalDate)).toISOString(), title: h("subject") || "(no subject)", text: body || m.snippet || "", from: h("from"), url: `https://mail.google.com/mail/u/0/#inbox/${m.id}` });
  }
  return items;
}

async function slack(token: string, options: Record<string, string>, a: ReadArgs): Promise<WatchItem[]> {
  const channel = options.channel ?? "";
  if (!channel) throw new Error("Slack: this board has no channel id.");
  const u = new URL("https://slack.com/api/conversations.history");
  u.searchParams.set("channel", channel); u.searchParams.set("limit", String(a.limit));
  if (a.since) u.searchParams.set("oldest", String(new Date(a.since).getTime() / 1000));
  const r = await fetch(u, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(`Slack: ${j?.error ?? r.status}`);
  return (j.messages ?? []).filter((m: { subtype?: string }) => !m.subtype).map((m: { ts: string; text: string; user?: string; username?: string }) => ({
    id: `slack:${channel}:${m.ts}`, at: new Date(Number(m.ts) * 1000).toISOString(), title: (m.text ?? "").slice(0, 80), text: m.text ?? "", from: m.username ?? m.user ?? "someone", url: null,
  }));
}

async function shopifyOrders(config: Record<string, string>, secret: Secret, a: ReadArgs): Promise<WatchItem[]> {
  const d = (config.shop_domain ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const u = new URL(`https://${d}/admin/api/2024-10/orders.json`);
  u.searchParams.set("status", "any"); u.searchParams.set("limit", String(a.limit)); u.searchParams.set("order", "created_at asc");
  if (a.since) u.searchParams.set("created_at_min", a.since);
  const r = await fetch(u, { headers: { "X-Shopify-Access-Token": secret.access_token ?? "" } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Shopify: ${j?.errors ? JSON.stringify(j.errors) : r.status}`);
  return (j?.orders ?? []).map((o: Record<string, unknown>) => {
    const cust = (o.customer ?? {}) as Record<string, string>;
    const lines = ((o.line_items ?? []) as Record<string, unknown>[]).map((l) => `${l.quantity} × ${l.title}`).join(", ");
    return { id: `shopify:order:${o.id}`, at: String(o.created_at), title: `Order ${o.name ?? o.id} · ${o.total_price} ${o.currency}`, text: `${lines}\nTotal ${o.total_price} ${o.currency}. Status: ${o.financial_status ?? ""} ${o.fulfillment_status ?? "unfulfilled"}.${o.note ? `\nNote: ${o.note}` : ""}`, from: [cust.first_name, cust.last_name].filter(Boolean).join(" ") || String(o.email ?? "a customer"), url: o.order_status_url ? String(o.order_status_url) : null };
  });
}

async function wordpressComments(config: Record<string, string>, secret: Secret, a: ReadArgs): Promise<WatchItem[]> {
  const site = (config.site_url ?? "").replace(/\/$/, "");
  const u = new URL(`${site}/wp-json/wp/v2/comments`);
  u.searchParams.set("per_page", String(a.limit)); u.searchParams.set("order", "asc"); u.searchParams.set("orderby", "date_gmt"); u.searchParams.set("status", "all");
  if (a.since) u.searchParams.set("after", a.since);
  const r = await fetch(u, { headers: { Authorization: `Basic ${btoa(`${secret.username ?? ""}:${secret.app_password ?? ""}`)}` } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`WordPress: ${j?.message ?? r.status}`);
  return (j ?? []).map((c: Record<string, unknown>) => ({ id: `wp:comment:${c.id}`, at: `${String(c.date_gmt)}Z`, title: `Comment on post ${c.post}`, text: strip(String((c.content as { rendered?: string })?.rendered ?? "")), from: String(c.author_name ?? "someone"), url: c.link ? String(c.link) : null }));
}

async function githubIssues(config: Record<string, string>, secret: Secret, a: ReadArgs): Promise<WatchItem[]> {
  const repo = (config.repo ?? "").replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  const u = new URL(`https://api.github.com/repos/${repo}/issues`);
  u.searchParams.set("per_page", String(a.limit)); u.searchParams.set("state", "open"); u.searchParams.set("sort", "created"); u.searchParams.set("direction", "asc");
  if (a.since) u.searchParams.set("since", a.since);
  const r = await fetch(u, { headers: { authorization: `Bearer ${secret.token ?? secret.access_token ?? ""}`, accept: "application/vnd.github+json" } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`GitHub: ${j?.message ?? r.status}`);
  return (j ?? []).filter((i: Record<string, unknown>) => !i.pull_request && (!a.since || String(i.created_at) > a.since)).map((i: Record<string, unknown>) => ({ id: `github:issue:${i.id}`, at: String(i.created_at), title: `#${i.number} ${i.title}`, text: String(i.body ?? ""), from: String((i.user as { login?: string })?.login ?? "someone"), url: String(i.html_url ?? "") }));
}

/**
 * Items newer than `since` for a board's source, oldest first. Credentials
 * come from the connection: an OAuth token (refreshed if needed) or the
 * secret the founder pasted.
 */
// deno-lint-ignore no-explicit-any
export async function readWatchSource(admin: any, source: WatchSourceKey, connection: { id: string; config: Record<string, string> }, secret: Secret, options: Record<string, string>, a: ReadArgs): Promise<WatchItem[]> {
  const oauth = async () => { const t = await getOAuthAccessToken(admin, connection.id); if (t.ok === false) throw new Error(t.error); return t.token; };
  let items: WatchItem[];
  switch (source) {
    case "gmail_inbox": items = await gmail(await oauth(), options, a); break;
    case "slack_channel": items = await slack(await oauth(), options, a); break;
    case "shopify_orders": items = await shopifyOrders(connection.config, secret, a); break;
    case "wordpress_comments": items = await wordpressComments(connection.config, secret, a); break;
    case "github_issues": items = await githubIssues(connection.config, secret, a); break;
    default: throw new Error(`Unknown source ${source}`);
  }
  return items.filter((i) => !a.since || i.at > a.since).sort((x, y) => x.at.localeCompare(y.at)).slice(0, a.limit);
}
