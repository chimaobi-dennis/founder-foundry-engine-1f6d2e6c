/**
 * Database connections (Enterprise) — one table per connection, read and
 * update by primary key, never DDL. The SQL is built from validated
 * identifiers and parameterised values only; the pure builders are tested.
 * The driver is loaded lazily so this module can be shared with the browser.
 */
import { ConnectorError, type ConnectionRow, type NormalizedRecord, type Secret } from "./connectors.ts";

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;

export function isIdent(s: unknown): s is string {
  return typeof s === "string" && IDENT.test(s);
}

export function quoteIdent(s: string): string {
  if (!isIdent(s)) throw new ConnectorError(`"${s}" is not a valid column or table name (lowercase letters, digits and underscores only).`, 400);
  return `"${s}"`;
}

export interface TableRef {
  schema: string;
  table: string;
}

/** "orders" → public.orders; "shop.orders" → shop.orders */
export function parseTable(input: unknown): TableRef | null {
  const parts = String(input ?? "").trim().toLowerCase().split(".");
  if (parts.length === 1 && isIdent(parts[0])) return { schema: "public", table: parts[0] };
  if (parts.length === 2 && isIdent(parts[0]) && isIdent(parts[1])) return { schema: parts[0], table: parts[1] };
  return null;
}

export function qualified(t: TableRef): string {
  return `${quoteIdent(t.schema)}.${quoteIdent(t.table)}`;
}

export interface TableScope {
  table: TableRef;
  key: string;
  label: string;
  columns: string[];
}

/** Resolve a connection's table settings; throws a clear error when misconfigured. */
export function tableScope(conn: Pick<ConnectionRow, "config" | "scope">): TableScope {
  const table = parseTable(conn.config.table);
  if (!table) throw new ConnectorError("Database connection needs a table name like orders or shop.orders.", 400);
  const key = String(conn.config.key_column || "id").toLowerCase();
  const label = String(conn.config.label_column || key).toLowerCase();
  const columns = [...new Set((conn.scope?.fields ?? []).map((c) => String(c).toLowerCase()).filter(isIdent))].filter((c) => c !== key);
  if (!isIdent(key) || !isIdent(label)) throw new ConnectorError("Key and label columns must be plain column names.", 400);
  if (!columns.length) throw new ConnectorError("List at least one column agents may change.", 400);
  return { table, key, label, columns };
}

/** SELECT key, label, columns … ORDER BY key LIMIT $1 */
export function sqlSelect(s: TableScope): string {
  const cols = [s.key, s.label, ...s.columns.filter((c) => c !== s.label)];
  return `SELECT ${cols.map((c) => `${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(", ")} FROM ${qualified(s.table)} ORDER BY ${quoteIdent(s.key)} LIMIT $1`;
}

export function sqlSelectOne(s: TableScope): string {
  const cols = [s.key, s.label, ...s.columns.filter((c) => c !== s.label)];
  return `SELECT ${cols.map((c) => `${quoteIdent(c)}::text AS ${quoteIdent(c)}`).join(", ")} FROM ${qualified(s.table)} WHERE ${quoteIdent(s.key)}::text = $1 LIMIT 1`;
}

/** UPDATE … SET c1 = $1, c2 = $2 WHERE key::text = $n RETURNING key — only allowed columns. */
export function sqlUpdate(s: TableScope, fields: Record<string, string>): { text: string; params: string[] } {
  const keys = Object.keys(fields).filter((k) => s.columns.includes(k));
  if (!keys.length) throw new ConnectorError("No allowed columns to update.", 400);
  const sets = keys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`);
  return { text: `UPDATE ${qualified(s.table)} SET ${sets.join(", ")} WHERE ${quoteIdent(s.key)}::text = $${keys.length + 1} RETURNING ${quoteIdent(s.key)}::text AS ${quoteIdent(s.key)}`, params: [...keys.map((k) => fields[k])] };
}

function toRecord(s: TableScope, row: Record<string, unknown>): NormalizedRecord {
  const fields: Record<string, string> = {};
  for (const c of s.columns) fields[c] = row[c] == null ? "" : String(row[c]);
  return { id: String(row[s.key]), label: String(row[s.label] ?? row[s.key] ?? ""), fields };
}

type Sql = any;

async function open(secret: Secret): Promise<Sql> {
  const url = String(secret.connection_string ?? "").trim();
  if (!/^postgres(ql)?:\/\//.test(url)) throw new ConnectorError("Connection string must start with postgres://", 400);
  // Resolved at runtime by the edge runtime only; the browser bundle never calls this.
  const specifier = "https://esm.sh/postgres@3.4.5";
  const mod: any = await import(/* @vite-ignore */ specifier);
  const postgres = (mod.default ?? mod) as (url: string, opts: Record<string, unknown>) => Sql;
  return postgres(url, { max: 1, connect_timeout: 10, idle_timeout: 5, prepare: false, ssl: "prefer", onnotice: () => {} });
}

function wrap(e: unknown): ConnectorError {
  if (e instanceof ConnectorError) return e;
  const msg = String((e as Error)?.message ?? e);
  return new ConnectorError(`Database: ${msg.slice(0, 240)}`, /password|authentication|permission denied/i.test(msg) ? 401 : 502);
}

export const pg = {
  async test(conn: ConnectionRow, secret: Secret) {
    const s = tableScope(conn);
    const sql = await open(secret);
    try {
      const [info] = await sql.unsafe("SELECT current_database() AS db, current_user AS usr");
      const cols = await sql.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2", [s.table.schema, s.table.table]);
      const present = new Set(cols.map((c: any) => String(c.column_name)));
      if (!present.size) throw new ConnectorError(`Table ${s.table.schema}.${s.table.table} was not found or this role cannot see it.`, 404);
      const missing = [s.key, s.label, ...s.columns].filter((c) => !present.has(c));
      if (missing.length) throw new ConnectorError(`Column${missing.length === 1 ? "" : "s"} not in ${s.table.table}: ${missing.join(", ")}`, 400);
      const [{ n }] = await sql.unsafe(`SELECT count(*)::int AS n FROM ${qualified(s.table)}`);
      return { account: `${info.usr}@${info.db}`, table: `${s.table.schema}.${s.table.table}`, rows: Number(n) || 0, columns: s.columns };
    } catch (e) {
      throw wrap(e);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  },

  async list(conn: ConnectionRow, secret: Secret, limit: number): Promise<NormalizedRecord[]> {
    const s = tableScope(conn);
    const sql = await open(secret);
    try {
      const rows = await sql.begin(async (tx: Sql) => {
        await tx.unsafe("SET TRANSACTION READ ONLY");
        await tx.unsafe("SET LOCAL statement_timeout = '8s'");
        return tx.unsafe(sqlSelect(s), [Math.max(1, Math.min(250, limit))]);
      });
      return rows.map((r: any) => toRecord(s, r));
    } catch (e) {
      throw wrap(e);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  },

  async get(conn: ConnectionRow, secret: Secret, id: string): Promise<NormalizedRecord> {
    const s = tableScope(conn);
    const sql = await open(secret);
    try {
      const [row] = await sql.unsafe(sqlSelectOne(s), [String(id)]);
      if (!row) throw new ConnectorError(`Row ${id} not found`, 404);
      return toRecord(s, row);
    } catch (e) {
      throw wrap(e);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  },

  async update(conn: ConnectionRow, secret: Secret, id: string, fields: Record<string, string>): Promise<NormalizedRecord> {
    const s = tableScope(conn);
    const { text, params } = sqlUpdate(s, fields);
    const sql = await open(secret);
    try {
      await sql.begin(async (tx: Sql) => {
        await tx.unsafe("SET LOCAL statement_timeout = '8s'");
        const out = await tx.unsafe(text, [...params, String(id)]);
        if (out.length !== 1) throw new ConnectorError(out.length === 0 ? `Row ${id} not found` : `Key ${s.key} is not unique; refused to update ${out.length} rows.`, 409);
      });
      const [row] = await sql.unsafe(sqlSelectOne(s), [String(id)]);
      return row ? toRecord(s, row) : { id: String(id), label: String(id), fields };
    } catch (e) {
      throw wrap(e);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  },
};
