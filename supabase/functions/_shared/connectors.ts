/**
 * Connectors — provider catalog, adapters and change-set helpers.
 *
 * The pure parts (catalog, field allowlists, diffs) are shared with the
 * frontend. The adapters only run in edge functions, where the secret is.
 */

export type ConnectorProvider = "wordpress" | "shopify";
export type Capability = "read" | "data_write" | "code_write";

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
  targetType: "post" | "product";
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
};

export const DEFAULT_MAX_RECORDS = 50;

export interface ConnectionScope {
  fields?: string[];
  max_records_per_run?: number;
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

// Dispatch ──────────────────────────────────────────────────────────────────

export type ConnectorAction =
  | { action: "test" }
  | { action: "list_records"; limit?: number }
  | { action: "get_record"; id: string }
  | { action: "update_record"; id: string; fields: Record<string, string> }
  | { action: "create_record"; fields: Record<string, string> }
  | { action: "delete_record"; id: string };

export async function runConnector(conn: ConnectionRow, secret: Secret, act: ConnectorAction): Promise<any> {
  const limit = Math.max(1, Math.min(conn.scope?.max_records_per_run ?? DEFAULT_MAX_RECORDS, (act as any).limit ?? DEFAULT_MAX_RECORDS));
  const needsWrite = act.action === "update_record" || act.action === "create_record" || act.action === "delete_record";
  if (needsWrite && !conn.capabilities.includes("data_write")) {
    throw new ConnectorError("This connection is read-only. Allow data writes on the connection to let agents change records.", 403);
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
