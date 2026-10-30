import { useEffect, useState } from "react";
import { Check, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { connectProvider, listLiveProviders, type OAuthProviderRow } from "@/services/oauthService";
import type { ToolConnection } from "@/services/connectionService";

/**
 * "Connect what Kinika will run": one card per provider an admin has put
 * live, each with its permission in plain words. Connecting opens the
 * provider's own sign-in in a popup; the page keeps its state. Used on the
 * first run (step 2) and on Kinika's team.
 */
export function ConnectProviders({ brandId, connections, onConnected, compact = false, canConnect = true, kinds }: {
  brandId: string;
  connections: ToolConnection[];
  onConnected: (key: string) => void | Promise<void>;
  compact?: boolean;
  canConnect?: boolean;
  /** Only providers of these kinds (e.g. ["social"]); all when omitted. */
  kinds?: OAuthProviderRow["kind"][];
}) {
  const [providers, setProviders] = useState<OAuthProviderRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { let on = true; listLiveProviders().then((p) => { if (on) setProviders(p); }); return () => { on = false; }; }, []);
  const shown = providers?.filter((p) => !kinds || kinds.includes(p.kind)) ?? [];
  if (!shown.length) return null;
  const connectedKeys = new Set(connections.filter((c) => c.status !== "error").map((c) => String(c.config?.oauth_provider_key ?? "")));

  const connect = async (p: OAuthProviderRow) => {
    setBusy(p.key);
    const r = await connectProvider(p.key, brandId);
    setBusy(null);
    if (!r.ok) { if (r.error && !/closed/i.test(r.error)) toast.error(r.error); return; }
    toast(`${p.name} connected`);
    await onConnected(p.key);
  };

  return (
    <div className={cn("grid gap-2.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
      {shown.map((p) => {
        const on = connectedKeys.has(p.key);
        return (
          <div key={p.id} className={cn("flex items-start justify-between gap-3 rounded-xl border p-3.5 bg-card", on ? "border-[hsl(var(--brand-good))]/40" : "border-border")}>
            <div className="flex items-start gap-3 min-w-0">
              <span aria-hidden className="w-9 h-9 rounded-lg bg-muted inline-flex items-center justify-center font-ui text-[12px] font-semibold shrink-0">{p.icon || p.name.slice(0, 1)}</span>
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="font-ui text-[14px] font-medium">{p.name}</span>
                <span className="font-ui text-[12px] text-muted-foreground leading-relaxed">{p.permission_words || "Kinika reads it and acts only after your yes."}</span>
              </div>
            </div>
            {on ? (
              <span className="shrink-0 inline-flex items-center gap-1 font-ui text-[12px] text-[hsl(var(--brand-good))]"><Check size={12} /> connected</span>
            ) : (
              <button disabled={!canConnect || busy !== null} onClick={() => connect(p)} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card font-ui text-[13px] hover:border-primary/50 disabled:opacity-50">
                {busy === p.key ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Connect
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ConnectProviders;
