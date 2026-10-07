import { useEffect, useState } from "react";
import { Plug, Plus, Loader2, Check, X, RotateCcw, Trash2, Eye, Sparkles, Pause, Play, AlertTriangle, GitPullRequest, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuoteChip } from "@/components/billing/QuoteChip";
import type { Quote } from "@/services/pricingService";
import type { Agent } from "@/services/agentService";
import {
  PROVIDERS, RECIPES, allowedFields, connectionAllowsWrites,
  listConnections, createConnection, updateConnectionScope, removeConnection, testConnection, previewRecords,
  listChangeSets, revertChange, quoteRecipe, startRecipe, pullRequestStatus, mergePullRequest, repoSize,
  type ToolConnection, type ChangeSet, type ConnectorProvider, type RecipeKey, type NormalizedRecord, type PrStatus,
} from "@/services/connectionService";
import { DEFAULT_ALLOWED_PATHS } from "@shared/github";
import { planLimitMessage } from "@/services/subscriptionService";

const SOCIAL_PLATFORMS = ["instagram", "linkedin", "x", "facebook", "tiktok"];

const SHORT = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function ConnectionsSection({ brandId, userId, agents, balance, balanceLoading, onTopUp, onRunStarted, canConnect = true, canRun = true, autonomousAllowed = false, enterprise = false }: {
  brandId: string;
  userId: string;
  /** owner only: credentials are stored under the owner's account */
  canConnect?: boolean;
  /** editors and owners */
  canRun?: boolean;
  agents: Agent[];
  balance: number;
  balanceLoading: boolean;
  onTopUp: () => void;
  onRunStarted: (runId: string) => void;
  /** The owner's plan includes unreviewed changes */
  autonomousAllowed?: boolean;
  /** Enterprise: database connections and auto-merge */
  enterprise?: boolean;
}) {
  const [connections, setConnections] = useState<ToolConnection[]>([]);
  const [changes, setChanges] = useState<ChangeSet[]>([]);
  const [adding, setAdding] = useState(false);
  const [recipeFor, setRecipeFor] = useState<{ connection: ToolConnection; recipe: RecipeKey } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const [c, ch] = await Promise.all([listConnections(brandId), listChangeSets(brandId, 30)]);
    setConnections(c);
    setChanges(ch);
    setLoaded(true);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [brandId]);

  if (!loaded) return null;

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Plug size={14} className="text-muted-foreground" />
            <h2 className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Connected tools</h2>
            {connections.length > 0 && <span className="font-ui text-[11px] text-muted-foreground">· {connections.length}</span>}
          </div>
          {canConnect && (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[12px] font-ui text-muted-foreground hover:text-foreground">
              <Plus size={12} /> Connect a tool
            </button>
          )}
        </div>
        {connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-5">
            <p className="font-display text-[15px] text-foreground">Nothing connected yet.</p>
            <p className="font-ui text-[13px] text-muted-foreground mt-1">Connect Shopify, WordPress, Notion, GitHub, a database or your social accounts and agents can work straight into them. Changes are reviewed first and can be reverted; publishing is always approved by you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {connections.map((c) => (
              <ConnectionCard key={c.id} connection={c} agents={agents} canManage={canConnect} canRun={canRun} onChanged={reload} onRecipe={(recipe) => setRecipeFor({ connection: c, recipe })} />
            ))}
          </div>
        )}
      </section>

      {changes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw size={14} className="text-muted-foreground" />
            <h2 className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Changes made by agents</h2>
            <span className="font-ui text-[11px] text-muted-foreground">· {changes.length}</span>
          </div>
          <div className="grid gap-1.5">
            {changes.map((ch) => <ChangeRow key={ch.id} change={ch} onChanged={reload} />)}
          </div>
        </section>
      )}

      {adding && <AddConnectionDialog enterprise={enterprise} brandId={brandId} userId={userId} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); reload(); }} />}
      {recipeFor && (
        <RecipeDialog autonomousAllowed={autonomousAllowed}
          brandId={brandId}
          userId={userId}
          connection={recipeFor.connection}
          recipe={recipeFor.recipe}
          agents={agents}
          balance={balance}
          balanceLoading={balanceLoading}
          onTopUp={onTopUp}
          onClose={() => setRecipeFor(null)}
          onStarted={(id) => { setRecipeFor(null); onRunStarted(id); }}
        />
      )}
    </>
  );
}

// ─── Connection card ────────────────────────────────────────

function ConnectionCard({ connection: c, agents, canManage = true, canRun = true, onChanged, onRecipe }: { connection: ToolConnection; agents: Agent[]; canManage?: boolean; canRun?: boolean; onChanged: () => Promise<void>; onRecipe: (r: RecipeKey) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<NormalizedRecord[] | null>(null);
  const spec = PROVIDERS[c.provider];
  const writes = connectionAllowsWrites(c);
  const recipes = Object.values(RECIPES).filter((r) => r.provider === c.provider && agents.some((a) => a.slug === r.agentSlug));
  const fields = allowedFields(c.provider, c.scope);
  const isPublish = spec.kind === "publish";
  const linked = Array.isArray((c.config as any).linked_platforms) ? ((c.config as any).linked_platforms as string[]) : null;

  const act = async (what: string, fn: () => Promise<unknown>) => { setBusy(what); await fn(); setBusy(null); await onChanged(); };

  return (
    <div className="rounded-xl border border-card-border bg-card/60 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg text-foreground truncate">{c.display_name}</h3>
            <span className="font-ui text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{spec.name}</span>
            {c.status === "error" && <span className="inline-flex items-center gap-1 text-[11px] font-ui text-destructive"><AlertTriangle size={11} /> needs attention</span>}
            {c.status === "paused" && <span className="text-[11px] font-ui text-muted-foreground">paused</span>}
          </div>
          <p className="font-ui text-[12px] text-muted-foreground mt-0.5 truncate">
            {c.config.site_url ?? c.config.shop_domain ?? c.config.repo ?? c.config.table ?? (c.config.database_id ? `Database ${String(c.config.database_id).slice(0, 8)}…` : null) ?? c.config.account ?? ""}
            {c.provider === "postgres" && c.config.account ? ` · ${c.config.account}` : ""}
            {spec.kind === "code" && c.scope.auto_merge_paths?.length ? ` · auto-merge under ${c.scope.auto_merge_paths.join(", ")}` : ""}
            {spec.kind === "code" && (c.config as any).default_branch ? ` · base ${c.config.base_branch || (c.config as any).default_branch}` : ""}
            {isPublish && linked ? (linked.length ? ` · linked: ${linked.join(", ")}` : " · no social accounts linked yet") : ""}
          </p>
        </div>
        <button onClick={() => act("toggle", () => updateConnectionScope(c.id, { status: c.status === "paused" ? "active" : "paused" }))} className="text-muted-foreground hover:text-foreground" title={c.status === "paused" ? "Resume" : "Pause"} aria-label={c.status === "paused" ? "Resume connection" : "Pause connection"}>
          {c.status === "paused" ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>

      {c.last_error && c.status === "error" && <p className="font-ui text-[12px] text-destructive">{SHORT(c.last_error, 160)}</p>}

      <div className="font-ui text-[12px] text-muted-foreground">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={writes} disabled={!canManage} onChange={(e) => act("writes", () => updateConnectionScope(c.id, { allowWrites: e.target.checked }))} />
          {isPublish ? (
            <>Agents may publish here <span className="text-foreground">(every post approved by you first)</span></>
          ) : spec.kind === "delivery" ? (
            <>Agents may create {spec.targetLabel} here</>
          ) : spec.kind === "code" ? (
            <>The Developer may open pull requests under: <span className="text-foreground">{(c.scope.paths?.length ? c.scope.paths : DEFAULT_ALLOWED_PATHS).join(", ")}</span></>
          ) : (
            <>Agents may change: <span className="text-foreground">{fields.map((f) => spec.fields.find((x) => x.key === f)?.label ?? f).join(", ")}</span></>
          )}
        </label>
        {!writes && <span className="block text-[11px] mt-0.5">{isPublish ? "Nothing is published until you tick this." : spec.kind === "code" ? "Read-only until you tick this. Every change is a pull request you merge." : "Read-only until you tick this. Writes are always reviewed and revertible."}</span>}
      </div>

      {preview && (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3 font-ui text-[12px]">
          <p className="text-muted-foreground mb-1">{preview.length} {spec.targetLabel} an agent would read:</p>
          <ul className="space-y-0.5 text-foreground">{preview.map((r) => <li key={r.id} className="truncate">• {r.label}</li>)}</ul>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        {recipes.map((r) => (
          <button key={r.key} onClick={() => onRecipe(r.key)} disabled={!writes || c.status !== "active" || !canRun} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50" title={!writes ? "Allow changes first" : undefined}>
            <Sparkles size={12} /> {r.name}
          </button>
        ))}
        <button disabled={!!busy} onClick={() => act("test", async () => { const r = await testConnection(c.id); if (r.success) toast(`Connected as ${(r.info as any)?.account ?? "ok"}`); else toast.error(r.error ?? "Connection failed"); })} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[12px] font-ui">
          {busy === "test" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Test
        </button>
        {spec.kind === "records" && (
          <button disabled={!!busy} onClick={async () => { setBusy("preview"); const r = await previewRecords(c.id, 5); setBusy(null); if (r.success) setPreview(r.records ?? []); else toast.error(r.error ?? "Could not read"); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[12px] font-ui">
            {busy === "preview" ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Preview
          </button>
        )}
        {canManage && (
          <button disabled={!!busy} onClick={() => act("remove", async () => { if (await removeConnection(c.id)) toast("Connection removed"); })} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Remove connection" title="Remove">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add connection ─────────────────────────────────────────

function AddConnectionDialog({ brandId, userId, onClose, onCreated, enterprise = false }: { brandId: string; userId: string; onClose: () => void; onCreated: () => void; enterprise?: boolean }) {
  const [provider, setProvider] = useState<ConnectorProvider>("shopify");
  const [columns, setColumns] = useState("");
  const [autoMergePaths, setAutoMergePaths] = useState("");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState<Record<string, string>>({});
  const [allowWrites, setAllowWrites] = useState(false);
  const [paths, setPaths] = useState(DEFAULT_ALLOWED_PATHS.join("\n"));
  const [fields, setFields] = useState<string[]>(PROVIDERS.shopify.fields.filter((f) => f.defaultAllowed).map((f) => f.key));
  const [submitting, setSubmitting] = useState(false);
  const spec = PROVIDERS[provider];

  const pick = (p: ConnectorProvider) => { setProvider(p); setConfig({}); setSecret({}); setFields(PROVIDERS[p].fields.filter((f) => f.defaultAllowed).map((f) => f.key)); };
  const optionalConfig = new Set(["base_branch", "key_column", "label_column"]);
  const columnList = columns.split(/[\n,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const ready = spec.config.every((c) => optionalConfig.has(c.key) || (config[c.key] ?? "").trim()) && spec.secret.every((s) => (secret[s.key] ?? "").trim()) && (provider !== "postgres" || columnList.length > 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Connect a tool</DialogTitle>
          <DialogDescription className="font-ui text-[12px]">Credentials are stored on the server and never shown again. Agents only read until you allow changes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(Object.keys(PROVIDERS) as ConnectorProvider[]).map((p) => (
              <button key={p} type="button" onClick={() => pick(p)} className={cn("px-3 py-1.5 rounded-full text-[12px] font-ui border", provider === p ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>{PROVIDERS[p].name}{p === "postgres" && !enterprise ? " · Enterprise" : ""}</button>
            ))}
          </div>
          <p className="font-ui text-[12px] text-muted-foreground">{spec.help}</p>
          {provider === "postgres" && !enterprise && <p className="font-ui text-[12px] text-amber-600">Database connections come with the Enterprise plan. You can fill this in, but connecting will be refused until you upgrade on Billing.</p>}
          <div>
            <Label htmlFor="conn-name" className="text-[12px]">Name</Label>
            <Input id="conn-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`My ${spec.name}`} className="mt-1" />
          </div>
          {spec.config.map((c) => (
            <div key={c.key}>
              <Label htmlFor={`conn-${c.key}`} className="text-[12px]">{c.label}</Label>
              <Input id={`conn-${c.key}`} value={config[c.key] ?? ""} onChange={(e) => setConfig({ ...config, [c.key]: e.target.value })} placeholder={c.placeholder} className="mt-1" autoComplete="off" />
            </div>
          ))}
          {spec.secret.map((s) => (
            <div key={s.key}>
              <Label htmlFor={`conn-${s.key}`} className="text-[12px]">{s.label}</Label>
              <Input id={`conn-${s.key}`} type="password" value={secret[s.key] ?? ""} onChange={(e) => setSecret({ ...secret, [s.key]: e.target.value })} placeholder={s.placeholder} className="mt-1" autoComplete="new-password" />
            </div>
          ))}
          {spec.kind === "code" && (
            <div>
              <Label htmlFor="conn-paths" className="text-[12px]">Paths the Developer may change (one glob per line)</Label>
              <Textarea id="conn-paths" rows={4} value={paths} onChange={(e) => setPaths(e.target.value)} className="mt-1 font-mono text-[12px]" />
              <p className="font-ui text-[11px] text-muted-foreground mt-1">Secrets, CI, lockfiles, dependencies and migrations are always off limits, whatever you list here.</p>
            </div>
          )}
          {spec.kind === "code" && enterprise && (
            <div>
              <Label htmlFor="conn-automerge" className="text-[12px]">Paths where an autonomous pull request may merge itself (optional, one glob per line)</Label>
              <Textarea id="conn-automerge" rows={3} value={autoMergePaths} onChange={(e) => setAutoMergePaths(e.target.value)} placeholder={"content/**\npublic/**"} className="mt-1 font-mono text-[12px]" />
              <p className="font-ui text-[11px] text-muted-foreground mt-1">Only when you skip review and every file sits under these paths, and only after every check passes. Leave empty to always merge by hand.</p>
            </div>
          )}
          {provider === "postgres" && (
            <div>
              <Label htmlFor="conn-columns" className="text-[12px]">Columns agents may change (one per line)</Label>
              <Textarea id="conn-columns" rows={3} value={columns} onChange={(e) => setColumns(e.target.value)} placeholder={"name\ndescription\nmeta_description"} className="mt-1 font-mono text-[12px]" />
              <p className="font-ui text-[11px] text-muted-foreground mt-1">Rows are read and updated by the primary key only. Nothing outside these columns is ever written.</p>
            </div>
          )}
          {spec.fields.length > 0 && (
          <div>
            <Label className="text-[12px]">Fields agents may change</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {spec.fields.map((f) => {
                const on = fields.includes(f.key);
                return <button key={f.key} type="button" onClick={() => setFields(on ? fields.filter((x) => x !== f.key) : [...fields, f.key])} className={cn("px-2.5 py-1 rounded-full text-[11px] font-ui border", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>{f.label}</button>;
              })}
            </div>
          </div>
          )}
          <label className="flex items-start gap-2 text-[12px] font-ui text-muted-foreground">
            <input type="checkbox" checked={allowWrites} onChange={(e) => setAllowWrites(e.target.checked)} className="mt-0.5" />
            <span>{spec.kind === "publish" ? "Allow agents to publish here. Every post is approved by you before it goes out." : spec.kind === "delivery" ? "Allow agents to create pages here (after your review)." : spec.kind === "code" ? "Allow the Developer to open pull requests (you still merge them)." : "Allow agents to change these fields (after your review). Leave off to start read-only."}</span>
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-[12px] font-ui text-muted-foreground">Cancel</button>
          <button
            disabled={submitting || !ready}
            onClick={async () => {
              setSubmitting(true);
              const r = await createConnection({ brandId, userId, provider, displayName: name, config, secret, allowWrites, fields: provider === "postgres" ? columnList : fields, paths: provider === "github" ? paths.split(/\n+/).map((x) => x.trim()).filter(Boolean) : undefined, autoMergePaths: provider === "github" && enterprise ? autoMergePaths.split(/\n+/).map((x) => x.trim()).filter(Boolean) : undefined });
              if (!r.success) { setSubmitting(false); toast.error(planLimitMessage(r.error) ?? r.error ?? "Could not connect"); return; }
              const t = await testConnection(r.connection!.id);
              setSubmitting(false);
              if (t.success) toast(`Connected as ${(t.info as any)?.account ?? "ok"}`); else toast.error(`Saved, but the test failed: ${t.error}`);
              onCreated();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />} Connect and test
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recipe dialog ──────────────────────────────────────────

function RecipeDialog({ brandId, userId, connection, recipe, agents, balance, balanceLoading, onTopUp, onClose, onStarted, autonomousAllowed = false }: {
  brandId: string; userId: string; connection: ToolConnection; recipe: RecipeKey; agents: Agent[];
  balance: number; balanceLoading: boolean; onTopUp: () => void; onClose: () => void; onStarted: (runId: string) => void; autonomousAllowed?: boolean;
}) {
  const spec = RECIPES[recipe];
  const agent = agents.find((a) => a.slug === spec.agentSlug);
  const [brief, setBrief] = useState("");
  const [limit, setLimit] = useState(10);
  const [repoFiles, setRepoFiles] = useState<number | undefined>(undefined);
  // The Developer's quote scales with the repository it has to read.
  useEffect(() => {
    if (recipe !== "code_change") return;
    let active = true;
    repoSize(connection.id).then((n) => { if (active && n != null) setRepoFiles(n); });
    return () => { active = false; };
  }, [recipe, connection.id]);
  const [autonomous, setAutonomous] = useState(false);
  const linked = Array.isArray((connection.config as any).linked_platforms) ? ((connection.config as any).linked_platforms as string[]) : null;
  const platformChoices = linked && linked.length ? SOCIAL_PLATFORMS.filter((p) => linked.includes(p === "x" ? "twitter" : p)) : SOCIAL_PLATFORMS;
  const [platforms, setPlatforms] = useState<string[]>(platformChoices.slice(0, 1));
  const [scheduleAt, setScheduleAt] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!agent) return;
    let active = true;
    quoteRecipe(recipe, agent, { brief, connection_id: connection.id, record_limit: limit, platforms, repo_files: repoFiles }).then((q) => { if (active) setQuote(q); });
    return () => { active = false; };
  }, [agent, recipe, limit, brief, connection.id, platforms, repoFiles]);

  if (!agent) {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle className="font-display text-xl">{spec.name}</DialogTitle><DialogDescription className="font-ui text-[12px]">This recipe needs the {spec.agentSlug.replace(/_/g, " ")} agent, which isn't available yet.</DialogDescription></DialogHeader></DialogContent>
      </Dialog>
    );
  }
  const insufficient = !balanceLoading && !!quote && quote.max > balance;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{spec.name}</DialogTitle>
          <DialogDescription className="font-ui text-[12px]">{spec.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-ui text-[12px] text-muted-foreground">
            {agent.name} on <span className="text-foreground">{connection.display_name}</span>. May change: {allowedFields(connection.provider, connection.scope).join(", ")}.
          </p>
          <div>
            <Label htmlFor="recipe-brief" className="text-[12px]">{recipe === "seo_refresh" ? "Anything the agent should know? (optional)" : "What should it be about?"}</Label>
            <Textarea id="recipe-brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={recipe === "code_change" ? "e.g. Change the homepage hero headline to 'Beyond Borders' and use our gold (#D4A017) for the primary button" : recipe === "social_publish" ? "e.g. Announce Saturday's cultural night: food, music, dance, 18:00 at the student union" : recipe === "seo_refresh" ? "e.g. Focus on the autumn collection; keep 'hand-glazed' in every title" : "e.g. Why we started the association, and what new students can expect this term"} className="mt-1" />
          </div>
          {recipe === "seo_refresh" && (
            <div>
              <Label htmlFor="recipe-limit" className="text-[12px]">How many {spec.unitLabel}s to review</Label>
              <Input id="recipe-limit" type="number" min={1} max={250} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(250, Number(e.target.value) || 1)))} className="mt-1 w-32" />
            </div>
          )}
          {recipe === "social_publish" && (
            <>
              <div>
                <Label className="text-[12px]">Platforms</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {platformChoices.map((p) => {
                    const on = platforms.includes(p);
                    return <button key={p} type="button" onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])} className={cn("px-2.5 py-1 rounded-full text-[11px] font-ui border capitalize", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>{p}</button>;
                  })}
                </div>
                {linked && !linked.length && <p className="font-ui text-[11px] text-muted-foreground mt-1">No social accounts are linked in Ayrshare yet; link them there, then Test this connection.</p>}
              </div>
              <div>
                <Label htmlFor="recipe-schedule" className="text-[12px]">Schedule for (optional, leave empty to post right after approval)</Label>
                <Input id="recipe-schedule" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="mt-1 w-60" />
              </div>
            </>
          )}
          {spec.irreversible ? (
            <p className="font-ui text-[12px] text-muted-foreground">Publishing can't be undone, so you approve each post before it goes out.</p>
          ) : (
            <label className="flex items-start gap-2 text-[12px] font-ui text-muted-foreground">
              <input type="checkbox" checked={autonomous} onChange={(e) => setAutonomous(e.target.checked)} className="mt-0.5" />
              <span>Apply without my review. Changes are still logged and revertible one by one.{!autonomousAllowed && autonomous ? " Your plan reviews every change, so this run will still stop for your approval before it applies. Startup and Enterprise skip that stop." : ""}</span>
            </label>
          )}
          {quote && (
            <QuoteChip estimate={quote.estimate} max={quote.max} mode={quote.mode} balance={balance} balanceLoading={balanceLoading} retailUsd={quote.retailUsd} breakdown={quote.breakdown} onTopUp={onTopUp} />
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-[12px] font-ui text-muted-foreground">Cancel</button>
          <button
            disabled={submitting || !quote || insufficient || ((recipe === "blog_draft" || recipe === "notion_draft" || recipe === "social_publish" || recipe === "code_change") && !brief.trim()) || (recipe === "social_publish" && platforms.length === 0)}
            onClick={async () => {
              setSubmitting(true);
              const schedule_at = scheduleAt ? new Date(scheduleAt).toISOString() : undefined;
              const r = await startRecipe({ recipe, brandId, userId, agent, connection, name: `${spec.name} · ${connection.display_name}`, input: { brief: brief.trim(), connection_id: connection.id, record_limit: limit, platforms, schedule_at, repo_files: repoFiles }, policy: { approval: autonomous ? "autonomous" : "review_first" } });
              setSubmitting(false);
              if (!r.success) { toast.error(r.error ?? "Could not start"); return; }
              toast(`${agent.name} is on it`);
              onStarted(r.run!.id);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-ui font-medium disabled:opacity-50"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {insufficient ? "Top up to run" : "Run"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change row ─────────────────────────────────────────────

function ChangeRow({ change: ch, onChanged }: { change: ChangeSet; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const fields = Object.keys(ch.after);
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 px-4 py-2.5 flex items-start gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[13px] text-foreground truncate">
          {ch.action === "create_record" ? "Created" : ch.action === "publish_post" ? (ch.after.scheduled_for ? "Scheduled" : "Published") : ch.action === "open_pr" ? "Opened PR" : "Updated"} <span className="font-medium">{ch.target_label ?? ch.target_id}</span>
          <span className="text-muted-foreground"> · {ch.provider} · {new Date(ch.created_at).toLocaleString()}</span>
          {ch.reverted_at && <span className="text-muted-foreground"> · reverted</span>}
        </p>
        {ch.action === "update_record" && (
          <ul className="font-ui text-[12px] mt-1 space-y-0.5">
            {fields.map((f) => (
              <li key={f} className="truncate"><span className="text-muted-foreground">{f}:</span> <span className="line-through text-muted-foreground/70">{SHORT(ch.before[f] ?? "") || "—"}</span> → <span className="text-foreground">{SHORT(ch.after[f] ?? "")}</span></li>
            ))}
          </ul>
        )}
        {ch.action === "publish_post" && (
          <p className="font-ui text-[12px] text-muted-foreground mt-1">
            {ch.after.platforms}{ch.after.scheduled_for ? ` · for ${new Date(ch.after.scheduled_for).toLocaleString()}` : ""}
            {Object.entries(ch.after).filter(([k]) => k.startsWith("url_")).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noreferrer" className="ml-2 underline">{k.slice(4)}</a>)}
          </p>
        )}
        {ch.action === "open_pr" && <PrLine change={ch} />}
        {ch.revert_error && <p className="font-ui text-[11px] text-destructive mt-1">Revert failed: {SHORT(ch.revert_error, 140)}</p>}
      </div>
      {!ch.reverted_at && (
        <button disabled={busy} onClick={async () => { setBusy(true); const r = await revertChange(ch.id); setBusy(false); if (r.success) toast("Reverted"); else toast.error(r.error ?? "Could not revert"); await onChanged(); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[12px] font-ui hover:border-primary disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} {ch.action === "publish_post" ? "Delete post" : ch.action === "open_pr" ? "Close PR" : "Revert"}
        </button>
      )}
      {ch.reverted_at && <X size={14} className="text-muted-foreground mt-1" aria-hidden />}
    </div>
  );
}

/** Diff table shown inside an approval for review_changes. */
export function DiffTable({ diff }: { diff: { lines: { target_label: string; field: string; before: string; after: string }[]; rejected?: { target_id: string; field: string; reason: string }[]; applied_count?: number; connection_name?: string } }) {
  if (!diff?.lines?.length) return <p className="font-ui text-[12px] text-muted-foreground mt-3">No changes proposed{diff?.rejected?.length ? ` (${diff.rejected.length} rejected by the field allowlist)` : ""}.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="font-ui text-[12px] text-muted-foreground mb-1">{diff.applied_count ?? diff.lines.length} record{(diff.applied_count ?? 1) === 1 ? "" : "s"} will change in {diff.connection_name ?? "the connected tool"}:</p>
      <table className="w-full text-[12px] font-ui">
        <thead><tr className="text-muted-foreground text-left"><th className="py-1 pr-2 font-normal">Record</th><th className="py-1 pr-2 font-normal">Field</th><th className="py-1 pr-2 font-normal">Before</th><th className="py-1 font-normal">After</th></tr></thead>
        <tbody>
          {diff.lines.slice(0, 40).map((l, i) => (
            <tr key={i} className="border-t border-border/50 align-top">
              <td className="py-1 pr-2 text-foreground whitespace-nowrap">{SHORT(l.target_label, 32)}</td>
              <td className="py-1 pr-2 text-muted-foreground whitespace-nowrap">{l.field}</td>
              <td className="py-1 pr-2 text-muted-foreground/80">{SHORT(l.before, 70) || "—"}</td>
              <td className="py-1 text-foreground">{SHORT(l.after, 90)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {diff.lines.length > 40 && <p className="font-ui text-[11px] text-muted-foreground mt-1">+ {diff.lines.length - 40} more</p>}
      {!!diff.rejected?.length && <p className="font-ui text-[11px] text-muted-foreground mt-1">{diff.rejected.length} proposed change{diff.rejected.length === 1 ? "" : "s"} skipped by the field allowlist or length limits.</p>}
    </div>
  );
}


function PrLine({ change: ch }: { change: ChangeSet }) {
  const [status, setStatus] = useState<PrStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [merged, setMerged] = useState<boolean>(!!ch.after.merged_at);
  const url = ch.after.pr_url;
  const settled = !ch.after.checks || ch.after.checks === "passed" || ch.after.checks === "none";
  const canMerge = settled && !!status && status.state === "open" && !status.merged && !merged && !status.checks.failure && !status.checks.pending && status.mergeable !== false;
  const merge = async () => {
    setBusy(true);
    const r = await mergePullRequest(ch.id);
    setBusy(false);
    if (r.success) { setMerged(true); toast(`PR #${ch.target_id} merged`); } else toast.error(r.error ?? "Could not merge");
  };
  const check = async () => {
    if (!ch.connection_id) return;
    setBusy(true);
    const r = await pullRequestStatus(ch.connection_id, Number(ch.target_id));
    setBusy(false);
    if (r.success && r.status) setStatus(r.status); else toast.error(r.error ?? "Could not read PR status");
  };
  return (
    <p className="font-ui text-[12px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
      <GitPullRequest size={12} />
      {url && <a href={url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">#{ch.target_id} <ExternalLink size={10} /></a>}
      <span className="truncate">{ch.after.files}</span>
      {merged ? <span className="text-emerald-500">merged</span> : <button onClick={check} disabled={busy} className="underline disabled:opacity-50">{busy ? "checking…" : "checks?"}</button>}
      {canMerge && <button onClick={merge} disabled={busy} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50">Merge</button>}
      {!merged && ch.after.checks === "pending" && <span className="text-amber-500">waiting for checks before it is ready</span>}
      {!merged && ch.after.checks === "failed" && <span className="text-destructive">checks failed{Array.isArray(ch.after.checks_failed) && ch.after.checks_failed.length ? ` (${ch.after.checks_failed.join(", ")})` : ""}</span>}
      {ch.after.auto_merge === true && !merged && <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">merges itself after checks</span>}
      {ch.after.auto_merge_note ? <span className="text-amber-600">{String(ch.after.auto_merge_note)}</span> : null}
      {status?.preview?.url && <a href={status.preview.url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">preview <ExternalLink size={10} /></a>}
      {status && !merged && (
        <span className={cn(status.merged ? "text-emerald-500" : status.checks.failure ? "text-destructive" : status.checks.pending ? "text-amber-500" : "text-foreground")}>
          {status.merged ? "merged" : status.state === "closed" ? "closed" : status.checks.total === 0 ? "no checks" : status.checks.failure ? `${status.checks.failure} failing (${status.checks.names.join(", ")})` : status.checks.pending ? `${status.checks.pending} pending` : `${status.checks.success}/${status.checks.total} passing`}
        </span>
      )}
    </p>
  );
}

/** Code review shown inside an approval for review_code. */
export function CodeReview({ code }: { code: { connection_name?: string | null; commit_message?: string | null; pr_title?: string | null; pr_body?: string | null; files: { path: string; action: string; bytes: number; preview: string }[]; rejected?: { path: string; reason: string }[] } }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!code?.files?.length) return <p className="font-ui text-[12px] text-muted-foreground mt-3">No acceptable file changes{code?.rejected?.length ? ` (${code.rejected.map((r) => `${r.path}: ${r.reason}`).join("; ")})` : ""}.</p>;
  return (
    <div className="mt-3 space-y-2">
      <p className="font-ui text-[13px] text-foreground"><GitPullRequest size={12} className="inline mr-1" />{code.pr_title ?? code.commit_message}</p>
      {code.pr_body && <p className="font-ui text-[12px] text-muted-foreground whitespace-pre-wrap">{SHORT(code.pr_body, 600)}</p>}
      <ul className="space-y-1">
        {code.files.map((f) => (
          <li key={f.path} className="rounded-lg border border-border/60 bg-background/40">
            <button onClick={() => setOpen(open === f.path ? null : f.path)} className="w-full text-left px-3 py-1.5 font-ui text-[12px] flex items-center gap-2">
              <span className={cn("uppercase text-[10px] tracking-wider", f.action === "delete" ? "text-destructive" : f.action === "create" ? "text-emerald-500" : "text-muted-foreground")}>{f.action}</span>
              <span className="font-mono text-foreground truncate">{f.path}</span>
              <span className="text-muted-foreground ml-auto">{f.bytes.toLocaleString()} b</span>
            </button>
            {open === f.path && f.preview && <pre className="px-3 pb-2 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-48 overflow-auto">{f.preview}{f.bytes > f.preview.length ? "\n…" : ""}</pre>}
          </li>
        ))}
      </ul>
      {!!code.rejected?.length && <p className="font-ui text-[11px] text-muted-foreground">{code.rejected.length} proposed file{code.rejected.length === 1 ? "" : "s"} refused by the path policy: {code.rejected.map((r) => r.path).join(", ")}.</p>}
      <p className="font-ui text-[11px] text-muted-foreground">Approving opens a pull request on a new branch in {code.connection_name ?? "the repository"}; nothing reaches your base branch until you merge it.</p>
    </div>
  );
}