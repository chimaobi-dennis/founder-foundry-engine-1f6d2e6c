import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Pause, Play, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROVIDERS } from "@shared/connectors";
import {
  OAUTH_PRESETS, clientSecretIsSet, deleteProvider, listAllProviders, redirectUri, saveProvider, setClientSecret, setProviderStatus, verifyProvider,
  type OAuthProviderRow, type OAuthPreset, type ProviderInput,
} from "@/services/oauthService";

/**
 * Admin → Connections: universal OAuth. Add a provider from a preset or by
 * hand, paste the client id and secret (the secret goes straight to Vault),
 * verify it by signing in through it, then Go live. Founders see "Connect
 * <name>" the moment it is live. One redirect URI serves every provider.
 */
const KINDS: { value: OAuthProviderRow["kind"]; label: string }[] = [
  { value: "social", label: "Social (posts, comments; publishing is always approved)" },
  { value: "email", label: "Email (inbox read, drafts)" },
  { value: "chat", label: "Chat (Slack and the like)" },
  { value: "records", label: "Records (a store or table)" },
  { value: "delivery", label: "Delivery (a place to put pages)" },
  { value: "code", label: "Code (repositories)" },
  { value: "other", label: "Other" },
];

const STATUS_WORDS: Record<OAuthProviderRow["status"], string> = { draft: "not verified yet", verified: "verified, not live", live: "live for founders", paused: "paused" };

export default function AdminConnections() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<OAuthProviderRow[] | null>(null);
  const [editing, setEditing] = useState<{ row: OAuthProviderRow | null; preset?: OAuthPreset } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const uri = redirectUri();

  const reload = useCallback(async () => setRows(await listAllProviders()), []);
  useEffect(() => { reload(); }, [reload]);

  // Back from a full-page verify (popup blocked): say what happened once.
  useEffect(() => {
    const v = params.get("verified"), e = params.get("oauth_error");
    if (!v && !e) return;
    if (v) toast(`${v} verified`); else toast.error(e ?? "Verification failed");
    setParams({}, { replace: true });
    reload();
  }, [params, setParams, reload]);

  const act = async (what: string, fn: () => Promise<unknown>) => { setBusy(what); try { await fn(); } finally { setBusy(null); await reload(); } };
  const verify = (r: OAuthProviderRow) => act(`verify-${r.id}`, async () => {
    const o = await verifyProvider(r.key);
    if (o.ok) toast(`${r.name} verified: the app details work`); else if (o.error && !/closed/i.test(o.error)) toast.error(o.error);
  });

  return (
    <FadeIn>
      <div className="max-w-[1100px] flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] leading-tight">Connections</h1>
            <p className="font-ui text-[14px] text-muted-foreground max-w-[70ch] leading-relaxed">Add a provider's app details, verify them by signing in through it, then press Go live. Founders see "Connect" for every live provider on the first run and on Kinika's team. The client secret goes to Vault and never comes back here.</p>
          </div>
          <button onClick={() => setEditing({ row: null })} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium"><Plus size={14} /> Add a provider</button>
        </header>

        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Redirect URI, the same for every provider</p>
            <p className="font-mono text-[12px] text-foreground truncate">{uri}</p>
          </div>
          <button onClick={async () => { try { await navigator.clipboard.writeText(uri); toast("Copied"); } catch { toast.error("Could not copy"); } }} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card font-ui text-[12px]"><Copy size={12} /> Copy</button>
        </div>

        {rows === null ? (
          <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6">
            <p className="font-display text-[16px]">No providers yet.</p>
            <p className="font-ui text-[13px] text-muted-foreground mt-1">A provider appears here when you add one. Start from a preset: Instagram and Facebook, Gmail, Slack, TikTok, LinkedIn, X, Notion, GitHub.</p>
            <button onClick={() => setEditing({ row: null })} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-card font-ui text-[13px]"><Plus size={13} /> Add a provider</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <span aria-hidden className="w-10 h-10 rounded-lg bg-muted inline-flex items-center justify-center font-ui text-[13px] font-semibold shrink-0">{r.icon || r.name.slice(0, 1)}</span>
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-[17px]">{r.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{r.key}</span>
                        <span className={cn("font-ui text-[11px] px-2 py-0.5 rounded-full", r.status === "live" ? "bg-[hsl(var(--brand-good-soft))] text-[hsl(var(--brand-good))]" : r.status === "verified" ? "bg-accent text-accent-foreground" : r.status === "paused" ? "bg-[hsl(var(--brand-needs-you-soft))] text-[hsl(var(--brand-needs-you))]" : "bg-muted text-muted-foreground")}>{STATUS_WORDS[r.status]}</span>
                      </div>
                      <span className="font-ui text-[12px] text-muted-foreground">{r.permission_words || "No permission words yet."}</span>
                      <span className="font-ui text-[11px] text-muted-foreground">{r.scopes.length ? `${r.scopes.length} scope${r.scopes.length === 1 ? "" : "s"}` : "no scopes"} · {r.pkce ? "PKCE" : "no PKCE"} · client id {r.client_id ? "set" : "missing"}{r.connector_provider ? ` · drives the ${PROVIDERS[r.connector_provider as keyof typeof PROVIDERS]?.name ?? r.connector_provider} connector` : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setEditing({ row: r })} className="h-9 px-3 rounded-lg border border-border bg-card font-ui text-[12px]">Edit</button>
                    <button disabled={busy !== null} onClick={() => verify(r)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card font-ui text-[12px] disabled:opacity-50">{busy === `verify-${r.id}` ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} {r.verified_at ? "Verify again" : "Verify by signing in"}</button>
                    {r.status === "live" ? (
                      <button disabled={busy !== null} onClick={() => act("pause", () => setProviderStatus(r.id, "paused"))} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card font-ui text-[12px]"><Pause size={12} /> Pause</button>
                    ) : (
                      <button disabled={busy !== null || !r.verified_at} title={r.verified_at ? undefined : "Verify it first"} onClick={() => act("live", () => setProviderStatus(r.id, "live"))} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground font-ui text-[12px] font-medium disabled:opacity-50"><Play size={12} /> Go live</button>
                    )}
                    <button disabled={busy !== null} onClick={() => { if (confirm(`Remove ${r.name}? Founders' existing connections keep working until their tokens expire.`)) act("delete", () => deleteProvider(r.id)); }} className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive" aria-label="Remove provider"><Trash2 size={13} /></button>
                  </div>
                </div>
                {r.last_error && <p className="font-ui text-[12px] text-destructive flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {r.last_error}</p>}
                {r.verification && (
                  <p className="font-ui text-[12px] text-muted-foreground flex items-start gap-1.5">
                    <Check size={12} className="mt-0.5 shrink-0 text-[hsl(var(--brand-good))]" />
                    <span>Signed in {new Date(r.verification.at).toLocaleString()} as {r.verification.account.name ?? r.verification.account.handle ?? r.verification.account.email ?? r.verification.account.id ?? "an account"}{r.verification.granted_scopes.length ? ` · granted: ${r.verification.granted_scopes.join(", ")}` : ""}{r.verification.has_refresh_token ? " · refresh token received" : " · no refresh token (tokens expire; founders reconnect)"}.</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {editing && <ProviderDialog row={editing.row} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </FadeIn>
  );
}

function blank(): ProviderInput {
  return { key: "", name: "", kind: "other", connector_provider: null, authorize_url: "", token_url: "", userinfo_url: "", scopes: [], extra_authorize_params: {}, token_auth: "post", pkce: false, client_id: "", permission_words: "", icon: "", sort_order: 100 };
}

function ProviderDialog({ row, onClose, onSaved }: { row: OAuthProviderRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ProviderInput>(row ? { key: row.key, name: row.name, kind: row.kind, connector_provider: row.connector_provider, authorize_url: row.authorize_url, token_url: row.token_url, userinfo_url: row.userinfo_url ?? "", scopes: row.scopes, extra_authorize_params: row.extra_authorize_params ?? {}, token_auth: row.token_auth, pkce: row.pkce, client_id: row.client_id, permission_words: row.permission_words, icon: row.icon, sort_order: row.sort_order } : blank());
  const [secret, setSecret] = useState("");
  const [secretSet, setSecretSet] = useState<boolean | null>(row ? null : false);
  const [extraText, setExtraText] = useState(JSON.stringify(row?.extra_authorize_params ?? {}));
  const [preset, setPreset] = useState<OAuthPreset | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (row) clientSecretIsSet(row.id).then(setSecretSet); }, [row]);

  const applyPreset = (p: OAuthPreset) => {
    setPreset(p);
    setForm((f) => ({ ...f, key: p.key, name: p.name, kind: p.kind, connector_provider: p.connector_provider, authorize_url: p.authorize_url, token_url: p.token_url, userinfo_url: p.userinfo_url ?? "", scopes: p.scopes, extra_authorize_params: p.extra_authorize_params, token_auth: p.token_auth, pkce: p.pkce, permission_words: p.permission_words, icon: p.icon }));
    setExtraText(JSON.stringify(p.extra_authorize_params));
  };
  const set = <K extends keyof ProviderInput>(k: K, v: ProviderInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    let extra: Record<string, string> = {};
    try { const parsed = JSON.parse(extraText || "{}"); extra = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)])); } catch { toast.error("Extra parameters must be JSON, e.g. {\"prompt\":\"consent\"}"); return; }
    if (!form.key.trim() || !form.name.trim() || !form.authorize_url.trim() || !form.token_url.trim()) { toast.error("Key, name, authorize URL and token URL are needed."); return; }
    setBusy(true);
    const r = await saveProvider(row?.id ?? null, { ...form, userinfo_url: form.userinfo_url?.trim() || null, extra_authorize_params: extra });
    if (!r.success || !r.provider) { setBusy(false); toast.error(r.error ?? "Could not save"); return; }
    if (secret.trim()) {
      const s = await setClientSecret(r.provider.id, secret.trim());
      if (!s.success) { setBusy(false); toast.error(s.error ?? "Could not save the secret"); return; }
    }
    setBusy(false);
    toast(row ? "Saved" : "Added. Verify it by signing in, then Go live.");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[760px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">{row ? `Edit ${row.name}` : "Add a provider"}</DialogTitle>
          <DialogDescription className="font-ui text-[13px]">Everything except the secret is plain configuration. The secret goes to Vault when you save.</DialogDescription>
        </DialogHeader>
        {!row && (
          <div className="flex flex-col gap-2">
            <Label className="font-ui text-[12px]">Start from a preset</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {OAUTH_PRESETS.map((p) => <button key={p.key} type="button" onClick={() => applyPreset(p)} className={cn("h-8 px-3 rounded-full border font-ui text-[12px]", preset?.key === p.key ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card")}>{p.name}</button>)}
            </div>
            {preset && <p className="font-ui text-[12px] text-muted-foreground">{preset.note} <a href={preset.console_url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">Open the developer console <ExternalLink size={11} /></a></p>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name founders see"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Instagram and Facebook" /></Field>
          <Field label="Key"><Input value={form.key} onChange={(e) => set("key", e.target.value)} placeholder="meta" disabled={!!row} /></Field>
          <Field label="Kind">
            <select value={form.kind} onChange={(e) => set("kind", e.target.value as ProviderInput["kind"])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] font-ui">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="Drives an existing connector (optional)">
            <select value={form.connector_provider ?? ""} onChange={(e) => set("connector_provider", e.target.value || null)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] font-ui">
              <option value="">None: a new kind of connection</option>
              {Object.values(PROVIDERS).map((p) => <option key={p.provider} value={p.provider}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Authorize URL"><Input value={form.authorize_url} onChange={(e) => set("authorize_url", e.target.value)} placeholder="https://…/oauth/authorize" /></Field>
          <Field label="Token URL"><Input value={form.token_url} onChange={(e) => set("token_url", e.target.value)} placeholder="https://…/oauth/token" /></Field>
          <Field label="Who-signed-in URL (optional)"><Input value={form.userinfo_url ?? ""} onChange={(e) => set("userinfo_url", e.target.value)} placeholder="https://…/me" /></Field>
          <Field label="Scopes, one per line or space-separated"><Textarea rows={3} value={form.scopes.join("\n")} onChange={(e) => set("scopes", e.target.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))} /></Field>
          <Field label="Extra authorize parameters (JSON)"><Input value={extraText} onChange={(e) => setExtraText(e.target.value)} placeholder='{"access_type":"offline","prompt":"consent"}' /></Field>
          <Field label="How the client secret is sent">
            <select value={form.token_auth} onChange={(e) => set("token_auth", e.target.value as "post" | "basic")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px] font-ui">
              <option value="post">In the form body (most providers)</option>
              <option value="basic">HTTP Basic header (X, Notion)</option>
            </select>
          </Field>
          <Field label="Client id"><Input value={form.client_id} onChange={(e) => set("client_id", e.target.value)} autoComplete="off" /></Field>
          <Field label={secretSet ? "Client secret (set; paste to replace)" : "Client secret"}><Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" placeholder={secretSet ? "••••••••" : ""} /></Field>
          <Field label="Permission in plain words (founders read this)"><Textarea rows={2} value={form.permission_words} onChange={(e) => set("permission_words", e.target.value)} placeholder="Kinika can read your posts and comments, and reply after your yes." /></Field>
          <div className="flex flex-col gap-3">
            <Field label="Icon letters"><Input value={form.icon} onChange={(e) => set("icon", e.target.value.slice(0, 3))} placeholder="M" /></Field>
            <label className="inline-flex items-center gap-2 font-ui text-[13px] cursor-pointer"><Switch checked={form.pkce} onCheckedChange={(v) => set("pkce", v)} /> Use PKCE (Google, TikTok, X)</label>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border bg-card font-ui text-[13px]">Cancel</button>
          <button disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : null} {row ? "Save" : "Add the provider"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label className="font-ui text-[12px]">{label}</Label>{children}</div>;
}
