import { github, parseRepo } from "./github.ts";
/**
 * Connectors — provider catalog, adapters and change-set helpers.
 *
 * The pure parts (catalog, field allowlists, diffs) are shared with the
 * frontend. The adapters only run in edge functions, where the secret is.
 */

export type ConnectorProvider = "wordpress" | "shopify" | "notion" | "ayrshare" | "github";
export type Capability = "read" | "data_write" | "code_write" | "publish";

/**
 * records:  a system of records agents read and update (Shopify, WordPress)
 * delivery: a place agents deliver new things to (Notion)
 * publish:  irreversible outward actions (social posts); always reviewed
 * code:     a repository; changes arrive as pull requests on a branch
 */
export type ProviderKind = "records" | "delivery" | "publish" | "code";

export interface ConnectorField {
  key: string;
  label: string;
  /** Fields that change what customers see or pay are not on by default. */
  defaultAllowed: boolean;
  maxLength?: number;
}

export interface ProviderSpec {
  provider: ConnectorProvider;
  name: string;
  kind: ProviderKind;
  targetType: "post" | "product" | "page" | "social_post" | "pull_request";
  targetLabel: string;
  /** Config the UI collects (non-secret) */
  config: { key: string; label: string; placeholder: string }[];
  /** Secret fields the UI collects; stored through set_connection_secret */
  secret: { key: string; label: string; placeholder: string }[];
  fields: ConnectorField[];
  help: string;
}

export const PROVIDERS: Record<ConnectorProvider, ProviderSpec> = {
  wordpress: {
    provider: "wordpress",
    name: "WordPress",
    kind: "records",
    targetType: "post",
    targetLabel: "posts",
    config: [{ key: "site_url", label: "Site URL", placeholder: "https://yourblog.com" }],
    secret: [
      { key: "username", label: "WordPress username", placeholder: "editor" },
      { key: "app_password", label: "Application password", placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx" },
    ],
    fields: [
      { key: "title", label: "Title", defaultAllowed: true, maxLength: 120 },
      { key: "excerpt", label: "Excerpt (meta description)", defaultAllowed: true, maxLength: 300 },
      { key: "slug", label: "Slug", defaultAllowed: false },
      { key: "content", label: "Body", defaultAllowed: false },
    ],
    help: "Create an Application Password under Users → Profile in WordPress. The REST API must be reachable at /wp-json/.",
  },
  shopify: {
    provider: "shopify",
    name: "Shopify",
    kind: "records",
    targetType: "product",
    targetLabel: "products",
    config: [{ key: "shop_domain", label: "Shop domain", placeholder: "your-store.myshopify.com" }],
    secret: [{ key: "access_token", label: "Admin API access token", placeholder: "shpat_…" }],
    fields: [
      { key: "seo_title", label: "SEO title", defaultAllowed: true, maxLength: 70 },
      { key: "seo_description", label: "SEO description", defaultAllowed: true, maxLength: 320 },
      { key: "title", label: "Product title", defaultAllowed: false, maxLength: 255 },
      { key: "body_html", label: "Description (HTML)", defaultAllowed: false },
      { key: "tags", label: "Tags", defaultAllowed: false },
    ],
    help: "Create a custom app in Shopify admin (Settings → Apps → Develop apps) with read_products and write_products scopes, then install it to get the token.",
  },
  notion: {
    provider: "notion",
    name: "Notion",
    kind: "delivery",
    targetType: "page",
    targetLabel: "pages",
    config: [{ key: "database_id", label: "Database ID", placeholder: "32-character id from the database URL" }],
    secret: [{ key: "token", label: "Internal integration token", placeholder: "ntn_… or secret_…" }],
    fields: [
      { key: "title", label: "Page title", defaultAllowed: true, maxLength: 200 },
      { key: "content", label: "Page body", defaultAllowed: true },
    ],
    help: "Create an internal integration at notion.so/my-integrations, then share the target database with it (••• → Connections). Agents create pages there; reverting archives the page.",
  },
  ayrshare: {
    provider: "ayrshare",
    name: "Social (Ayrshare)",
    kind: "publish",
    targetType: "social_post",
    targetLabel: "posts",
    config: [],
    secret: [{ key: "api_key", label: "Ayrshare API key", placeholder: "from app.ayrshare.com → API Key" }],
    fields: [],
    help: "Ayrshare publishes to Instagram, LinkedIn, X, Facebook and TikTok from one key. Link your social accounts in the Ayrshare dashboard first. Posting is irreversible, so it is always reviewed; reverting deletes the post where the network allows it.",
  },
  github: {
    provider: "github",
    name: "GitHub",
    kind: "code",
    targetType: "pull_request",
    targetLabel: "pull requests",
    config: [
      { key: "repo", label: "Repository", placeholder: "owner/name or https://github.com/owner/name" },
      { key: "base_branch", label: "Base branch (optional)", placeholder: "defaults to the repo's default branch" },
    ],
    secret: [{ key: "token", label: "Fine-grained personal access token", placeholder: "github_pat_…" }],
    fields: [],
    help: "Create a fine-grained token (Settings → Developer settings) limited to this repository with Contents: read & write and Pull requests: read & write. The Developer never pushes to your base branch; every change is a pull request you merge. Secrets, CI, lockfiles and migrations are always off limits.",
  },
};

/** Platform names agents use → Ayrshare platform ids. */
export const AYRSHARE_PLATFORMS: Record<string, string> = {
  instagram: "instagram",
  linkedin: "linkedin",
  x: "twitter",
  twitter: "twitter",
  facebook: "facebook",
  tiktok: "tiktok",
  youtube: "youtube",
  pinterest: "pinterest",
  threads: "threads",
  bluesky: "bluesky",
};

export function toAyrsharePlatforms(platforms: string[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const p of platforms ?? []) {
    const k = AYRSHARE_PLATFORMS[String(p).toLowerCase().trim()];
    if (k) out.add(k);
  }
  return [...out];
}

export const DEFAULT_MAX_RECORDS = 50;

export interface ConnectionScope {
  fields?: string[];
  max_records_per_run?: number;
  /** code connections: globs the Developer may write under */
  paths?: string[];
}

/** Fields the connection may change: the scope's list, else the provider defaults. */
export function allowedFields(provider: ConnectorProvider, scope: ConnectionScope | null | undefined): string[] {
  const spec = PROVIDERS[provider];
  const known = new Set(spec.fields.map((f) => f.key));
  const fromScope = (scope?.fields ?? []).filter((f) => known.has(f));
  if (fromScope.length) return fromScope;
  return spec.fields.filter((f) => f.defaultAllowed).map((f) => f.key);
}

/** Keep only allowed, non-empty, actually-different fields; enforce lengths. */
export function pickAllowedChanges(
  provider: ConnectorProvider,
  allowed: string[],
  before: Record<string, unknown>,
  proposed: Record<string, unknown>,
): { fields: Record<string, string>; rejected: { field: string; reason: string }[] } {
  const spec = PROVIDERS[provider];
  const fields: Record<string, string> = {};
  const rejected: { field: string; reason: string }[] = [];
  for (const [k, v] of Object.entries(proposed ?? {})) {
    if (!allowed.includes(k)) {
      rejected.push({ field: k, reason: "not allowed for this connection" });
      continue;
    }
    if (typeof v !== "string") {
      rejected.push({ field: k, reason: "not a string" });
      continue;
    }
    const value = v.trim();
    if (!value) {
      rejected.push({ field: k, reason: "empty" });
      continue;
    }
    const def = spec.fields.find((f) => f.key === k);
    if (def?.maxLength && value.length > def.maxLength) {
      rejected.push({ field: k, reason: `longer than ${def.maxLength} characters` });
      continue;
    }
    if (String(before?.[k] ?? "").trim() === value) continue; // unchanged
    fields[k] = value;
  }
  return { fields, rejected };
}

export interface NormalizedRecord {
  id: string;
  label: string;
  fields: Record<string, string>;
  url?: string;
}

export interface ProposedChange {
  target_id: string;
  target_label?: string;
  fields: Record<string, unknown>;
  reason?: string;
}

export interface DiffLine {
  target_id: string;
  target_label: string;
  field: string;
  before: string;
  after: string;
}

/** Flatten proposed changes against fetched records into reviewable lines. */
export function diffLines(records: NormalizedRecord[], changes: ProposedChange[], provider: ConnectorProvider, allowed: string[]): { lines: DiffLine[]; applied: ProposedChange[]; rejected: { target_id: string; field: string; reason: string }[] } {
  const byId = new Map(records.map((r) => [String(r.id), r]));
  const lines: DiffLine[] = [];
  const applied: ProposedChange[] = [];
  const rejected: { target_id: string; field: string; reason: string }[] = [];
  for (const ch of changes ?? []) {
    const rec = byId.get(String(ch.target_id));
    if (!rec) {
      rejected.push({ target_id: String(ch.target_id), field: "*", reason: "record not in the fetched set" });
      continue;
    }
    const { fields, rejected: rej } = pickAllowedChanges(provider, allowed, rec.fields, ch.fields ?? {});
    rej.forEach((r) => rejected.push({ target_id: rec.id, field: r.field, reason: r.reason }));
    if (!Object.keys(fields).length) continue;
    applied.push({ target_id: rec.id, target_label: rec.label, fields, reason: ch.reason });
    for (const [field, after] of Object.entries(fields)) {
      lines.push({ target_id: rec.id, target_label: rec.label, field, before: rec.fields[field] ?? "", after });
    }
  }
  return { lines, applied, rejected };
}

// ── Adapters (edge functions only) ──────────────────────────────────────────

export interface ConnectionRow {
  id: string;
  provider: ConnectorProvider;
  config: Record<string, string>;
  scope: ConnectionScope;
  capabilities: Capability[];
}

export type Secret = Record<string, string>;

export class ConnectorError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

function fail(provider: string, res: Response, body: any): never {
  const msg = body?.message ?? body?.errors ?? body?.error ?? body?.raw ?? `${res.status} ${res.statusText}`;
  throw new ConnectorError(`${provider}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`, res.status === 401 || res.status === 403 ? 401 : 502);
}

// WordPress ─────────────────────────────────────────────────────────────────

function wpBase(conn: ConnectionRow): string {
  const site = (conn.config.site_url ?? "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(site)) throw new ConnectorError("WordPress: site_url must start with http(s)://", 400);
  return `${site}/wp-json/wp/v2`;
}

function wpHeaders(secret: Secret): Record<string, string> {
  const token = btoa(`${secret.username ?? ""}:${secret.app_password ?? ""}`);
  return { Authorization: `Basic ${token}`, "content-type": "application/json" };
}

function wpNormalize(p: any): NormalizedRecord {
  const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
  return {
    id: String(p.id),
    label: strip(p.title?.raw ?? p.title?.rendered ?? `Post ${p.id}`),
    url: p.link,
    fields: {
      title: String(p.title?.raw ?? strip(p.title?.rendered)),
      excerpt: String(p.excerpt?.raw ?? strip(p.excerpt?.rendered)),
      slug: String(p.slug ?? ""),
      content: String(p.content?.raw ?? ""),
    },
  };
}

const wordpress = {
  async test(conn: ConnectionRow, secret: Secret) {
    const res = await fetch(`${wpBase(conn)}/users/me?context=edit`, { headers: wpHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("WordPress", res, body);
    return { account: body?.name ?? body?.slug ?? "ok", can_edit: Array.isArray(body?.capabilities) || !!body?.capabilities };
  },
  async list(conn: ConnectionRow, secret: Secret, limit: number): Promise<NormalizedRecord[]> {
    const res = await fetch(`${wpBase(conn)}/posts?per_page=${Math.min(100, limit)}&status=publish,draft&context=edit&orderby=modified`, { headers: wpHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("WordPress", res, body);
    return (body as any[]).map(wpNormalize);
  },
  async get(conn: ConnectionRow, secret: Secret, id: string): Promise<NormalizedRecord> {
    const res = await fetch(`${wpBase(conn)}/posts/${encodeURIComponent(id)}?context=edit`, { headers: wpHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("WordPress", res, body);
    return wpNormalize(body);
  },
  async update(conn: ConnectionRow, secret: Secret, id: string, fields: Record<string, string>): Promise<NormalizedRecord> {
    const res = await fetch(`${wpBase(conn)}/posts/${encodeURIComponent(id)}?context=edit`, { method: "POST", headers: wpHeaders(secret), body: JSON.stringify(fields) });
    const body = await readJson(res);
    if (!res.ok) fail("WordPress", res, body);
    return wpNormalize(body);
  },
  async createDraft(conn: ConnectionRow, secret: Secret, fields: Record<string, string>): Promise<NormalizedRecord> {
    const res = await fetch(`${wpBase(conn)}/posts?context=edit`, { method: "POST", headers: wpHeaders(secret), body: JSON.stringify({ ...fields, status: "draft" }) });
    const body = await readJson(res);
    if (!res.ok) fail("WordPress", res, body);
    return wpNormalize(body);
  },
  async trash(conn: ConnectionRow, secret: Secret, id: string): Promise<void> {
    const res = await fetch(`${wpBase(conn)}/posts/${encodeURIComponent(id)}`, { method: "DELETE", headers: wpHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("WordPress", res, body);
  },
};

// Shopify ───────────────────────────────────────────────────────────────────

const SHOPIFY_API = "2024-10";

function shopBase(conn: ConnectionRow): string {
  const d = (conn.config.shop_domain ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d.endsWith(".myshopify.com")) throw new ConnectorError("Shopify: shop_domain must look like your-store.myshopify.com", 400);
  return `https://${d}/admin/api/${SHOPIFY_API}`;
}

function shopHeaders(secret: Secret): Record<string, string> {
  return { "X-Shopify-Access-Token": secret.access_token ?? "", "content-type": "application/json" };
}

async function shopSeo(conn: ConnectionRow, secret: Secret, productId: string): Promise<{ seo_title: string; seo_description: string }> {
  const res = await fetch(`${shopBase(conn)}/products/${productId}/metafields.json?namespace=global`, { headers: shopHeaders(secret) });
  const body = await readJson(res);
  if (!res.ok) fail("Shopify", res, body);
  const mf = (body?.metafields ?? []) as any[];
  const get = (k: string) => String(mf.find((m) => m.key === k)?.value ?? "");
  return { seo_title: get("title_tag"), seo_description: get("description_tag") };
}

async function shopNormalize(conn: ConnectionRow, secret: Secret, p: any, withSeo: boolean): Promise<NormalizedRecord> {
  const seo = withSeo ? await shopSeo(conn, secret, String(p.id)) : { seo_title: "", seo_description: "" };
  return {
    id: String(p.id),
    label: String(p.title ?? `Product ${p.id}`),
    url: p.handle && conn.config.shop_domain ? `https://${conn.config.shop_domain.replace(/^https?:\/\//, "")}/products/${p.handle}` : undefined,
    fields: {
      title: String(p.title ?? ""),
      body_html: String(p.body_html ?? ""),
      tags: String(p.tags ?? ""),
      ...seo,
    },
  };
}

const shopify = {
  async test(conn: ConnectionRow, secret: Secret) {
    const res = await fetch(`${shopBase(conn)}/shop.json`, { headers: shopHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("Shopify", res, body);
    return { account: body?.shop?.name ?? "ok", domain: body?.shop?.myshopify_domain };
  },
  async list(conn: ConnectionRow, secret: Secret, limit: number): Promise<NormalizedRecord[]> {
    const res = await fetch(`${shopBase(conn)}/products.json?limit=${Math.min(250, limit)}&fields=id,title,body_html,handle,tags`, { headers: shopHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("Shopify", res, body);
    const out: NormalizedRecord[] = [];
    for (const p of body?.products ?? []) out.push(await shopNormalize(conn, secret, p, true));
    return out;
  },
  async get(conn: ConnectionRow, secret: Secret, id: string): Promise<NormalizedRecord> {
    const res = await fetch(`${shopBase(conn)}/products/${encodeURIComponent(id)}.json?fields=id,title,body_html,handle,tags`, { headers: shopHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("Shopify", res, body);
    return shopNormalize(conn, secret, body.product, true);
  },
  async update(conn: ConnectionRow, secret: Secret, id: string, fields: Record<string, string>): Promise<NormalizedRecord> {
    const product: Record<string, unknown> = { id: Number(id) };
    if (fields.title != null) product.title = fields.title;
    if (fields.body_html != null) product.body_html = fields.body_html;
    if (fields.tags != null) product.tags = fields.tags;
    if (fields.seo_title != null) product.metafields_global_title_tag = fields.seo_title;
    if (fields.seo_description != null) product.metafields_global_description_tag = fields.seo_description;
    const res = await fetch(`${shopBase(conn)}/products/${encodeURIComponent(id)}.json`, { method: "PUT", headers: shopHeaders(secret), body: JSON.stringify({ product }) });
    const body = await readJson(res);
    if (!res.ok) fail("Shopify", res, body);
    return shopNormalize(conn, secret, body.product, true);
  },
};

// Notion ────────────────────────────────────────────────────────────────────

const NOTION_VERSION = "2022-06-28";

function notionHeaders(secret: Secret): Record<string, string> {
  return { Authorization: `Bearer ${secret.token ?? ""}`, "Notion-Version": NOTION_VERSION, "content-type": "application/json" };
}

/** Plain text → Notion paragraph/heading blocks (2000-char rich-text limit per block). */
export function textToNotionBlocks(text: string): any[] {
  const blocks: any[] = [];
  for (const raw of String(text ?? "").split(/\n{2,}/)) {
    const para = raw.trim();
    if (!para) continue;
    const heading = para.match(/^#{1,3}\s+(.*)$/);
    if (heading && para.split("\n").length === 1) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: heading[1].slice(0, 2000) } }] } });
      continue;
    }
    for (let i = 0; i < para.length; i += 2000) {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: para.slice(i, i + 2000) } }] } });
    }
    if (blocks.length >= 100) break; // API limit per request
  }
  return blocks;
}

const notion = {
  async test(conn: ConnectionRow, secret: Secret) {
    const res = await fetch(`https://api.notion.com/v1/databases/${encodeURIComponent(conn.config.database_id ?? "")}`, { headers: notionHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("Notion", res, body);
    const title = (body?.title ?? []).map((t: any) => t.plain_text).join("") || "database";
    const titleProp = Object.entries(body?.properties ?? {}).find(([, v]: any) => v.type === "title")?.[0] ?? "Name";
    return { account: title, title_property: titleProp };
  },
  async titleProperty(conn: ConnectionRow, secret: Secret): Promise<string> {
    const info = await notion.test(conn, secret);
    return info.title_property;
  },
  async create(conn: ConnectionRow, secret: Secret, fields: Record<string, string>): Promise<NormalizedRecord> {
    const titleProp = await notion.titleProperty(conn, secret);
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(secret),
      body: JSON.stringify({
        parent: { database_id: conn.config.database_id },
        properties: { [titleProp]: { title: [{ type: "text", text: { content: String(fields.title ?? "Untitled").slice(0, 200) } }] } },
        children: textToNotionBlocks([fields.excerpt, fields.content].filter(Boolean).join("\n\n")),
      }),
    });
    const body = await readJson(res);
    if (!res.ok) fail("Notion", res, body);
    return { id: String(body.id), label: String(fields.title ?? "Untitled"), url: body.url, fields: { title: String(fields.title ?? ""), content: String(fields.content ?? "") } };
  },
  async archive(conn: ConnectionRow, secret: Secret, id: string): Promise<void> {
    const res = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(id)}`, { method: "PATCH", headers: notionHeaders(secret), body: JSON.stringify({ archived: true }) });
    const body = await readJson(res);
    if (!res.ok) fail("Notion", res, body);
  },
};

// Ayrshare (social publishing aggregator) ───────────────────────────────────

function ayrHeaders(secret: Secret): Record<string, string> {
  return { Authorization: `Bearer ${secret.api_key ?? ""}`, "content-type": "application/json" };
}

export interface PublishResult {
  id: string;
  platforms: string[];
  post_ids: Record<string, string>;
  urls: Record<string, string>;
  status: string;
}

const ayrshare = {
  async test(_conn: ConnectionRow, secret: Secret) {
    const res = await fetch("https://api.ayrshare.com/api/user", { headers: ayrHeaders(secret) });
    const body = await readJson(res);
    if (!res.ok) fail("Ayrshare", res, body);
    return { account: body?.title ?? body?.email ?? "ok", linked_platforms: body?.activeSocialAccounts ?? [] };
  },
  async publish(_conn: ConnectionRow, secret: Secret, text: string, platforms: string[], scheduleDate?: string): Promise<PublishResult> {
    if (!platforms.length) throw new ConnectorError("No supported platforms selected for this post.", 400);
    const res = await fetch("https://api.ayrshare.com/api/post", {
      method: "POST",
      headers: ayrHeaders(secret),
      body: JSON.stringify({ post: text, platforms, ...(scheduleDate ? { scheduleDate } : {}) }),
    });
    const body = await readJson(res);
    if (!res.ok || body?.status === "error") fail("Ayrshare", res, body);
    const post_ids: Record<string, string> = {};
    const urls: Record<string, string> = {};
    for (const p of body?.postIds ?? []) {
      if (p?.platform) {
        if (p.id) post_ids[p.platform] = String(p.id);
        if (p.postUrl) urls[p.platform] = String(p.postUrl);
      }
    }
    return { id: String(body?.id ?? ""), platforms, post_ids, urls, status: String(body?.status ?? "success") };
  },
  async remove(_conn: ConnectionRow, secret: Secret, id: string): Promise<void> {
    const res = await fetch("https://api.ayrshare.com/api/post", { method: "DELETE", headers: ayrHeaders(secret), body: JSON.stringify({ id }) });
    const body = await readJson(res);
    if (!res.ok || body?.status === "error") fail("Ayrshare", res, body);
  },
};

export interface PublishItem {
  platform?: string;
  platforms?: string[];
  title?: string;
  body?: string;
  hashtags?: string[];
  cta?: string;
}

/** The text a social post is published with. */
export function composePostText(item: PublishItem): string {
  const parts = [String(item.body ?? "").trim()];
  if (item.cta) parts.push(String(item.cta).trim());
  if (item.hashtags?.length) parts.push(item.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  return parts.filter(Boolean).join("\n\n").trim();
}

// Dispatch ──────────────────────────────────────────────────────────────────

export type ConnectorAction =
  | { action: "test" }
  | { action: "list_records"; limit?: number }
  | { action: "get_record"; id: string }
  | { action: "update_record"; id: string; fields: Record<string, string> }
  | { action: "create_record"; fields: Record<string, string> }
  | { action: "delete_record"; id: string }
  | { action: "publish_post"; text: string; platforms: string[]; scheduleDate?: string }
  | { action: "delete_post"; id: string };

export async function runConnector(conn: ConnectionRow, secret: Secret, act: ConnectorAction): Promise<any> {
  const limit = Math.max(1, Math.min(conn.scope?.max_records_per_run ?? DEFAULT_MAX_RECORDS, (act as any).limit ?? DEFAULT_MAX_RECORDS));
  const needsWrite = act.action === "update_record" || act.action === "create_record" || act.action === "delete_record";
  if (needsWrite && !conn.capabilities.includes("data_write")) {
    throw new ConnectorError("This connection is read-only. Allow data writes on the connection to let agents change records.", 403);
  }
  const needsPublish = act.action === "publish_post" || act.action === "delete_post";
  if (needsPublish && !conn.capabilities.includes("publish")) {
    throw new ConnectorError("Publishing is not enabled on this connection.", 403);
  }
  if (conn.provider === "notion") {
    switch (act.action) {
      case "test": return notion.test(conn, secret);
      case "create_record": return notion.create(conn, secret, act.fields);
      case "delete_record": return notion.archive(conn, secret, act.id);
      case "list_records": return [];
      default: throw new ConnectorError(`Notion connections only create pages (${act.action} not supported).`, 400);
    }
  }
  if (conn.provider === "github") {
    // Everything beyond "test" goes through connectorOps (branch/PR workflow).
    if (act.action === "test") {
      const c = parseRepo(conn.config.repo ?? "");
      if (!c) throw new ConnectorError("GitHub: repository must be owner/name", 400);
      const info = await github.repoInfo(secret.token ?? "", c);
      if (!info.permissions?.push) throw new ConnectorError("GitHub: this token cannot write to the repository (needs Contents: read & write).", 401);
      return { account: info.full_name, default_branch: info.default_branch, private: info.private };
    }
    if (act.action === "list_records") return [];
    throw new ConnectorError(`GitHub connections work through the Developer agent (${act.action} not supported here).`, 400);
  }
  if (conn.provider === "ayrshare") {
    switch (act.action) {
      case "test": return ayrshare.test(conn, secret);
      case "publish_post": return ayrshare.publish(conn, secret, act.text, act.platforms, act.scheduleDate);
      case "delete_post": return ayrshare.remove(conn, secret, act.id);
      case "list_records": return [];
      default: throw new ConnectorError(`Social connections only publish (${act.action} not supported).`, 400);
    }
  }
  if (conn.provider === "wordpress") {
    switch (act.action) {
      case "test": return wordpress.test(conn, secret);
      case "list_records": return wordpress.list(conn, secret, limit);
      case "get_record": return wordpress.get(conn, secret, act.id);
      case "update_record": return wordpress.update(conn, secret, act.id, act.fields);
      case "create_record": return wordpress.createDraft(conn, secret, act.fields);
      case "delete_record": return wordpress.trash(conn, secret, act.id);
    }
  }
  if (conn.provider === "shopify") {
    switch (act.action) {
      case "test": return shopify.test(conn, secret);
      case "list_records": return shopify.list(conn, secret, limit);
      case "get_record": return shopify.get(conn, secret, act.id);
      case "update_record": return shopify.update(conn, secret, act.id, act.fields);
      case "create_record": throw new ConnectorError("Creating Shopify products is not supported yet.", 400);
      case "delete_record": throw new ConnectorError("Deleting Shopify products is not supported.", 400);
    }
  }
  throw new ConnectorError(`Unknown provider ${(conn as any).provider}`, 400);
}
