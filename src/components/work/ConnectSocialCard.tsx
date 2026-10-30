import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listConnections, type ToolConnection } from "@/services/connectionService";
import { readSocialAccounts, socialConnections } from "@/services/socialService";
import { ConnectProviders } from "@/components/team/ConnectProviders";

/**
 * "Connect your social": shown in the task conversation when Kinika needs
 * facts about the founder's own accounts. The founder picks the accounts
 * (or connects one first) and Kinika reads them and writes the numbers into
 * the deliverable with their source. Nothing is typed by hand.
 */
export function ConnectSocialCard({ brandId, taskId, onStarted, onSkip }: {
  brandId: string;
  taskId: string;
  /** Kinika has the facts and is answering: the conversation should wait for the reply. */
  onStarted: () => void;
  onSkip: () => void;
}) {
  const [connections, setConnections] = useState<ToolConnection[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const all = await listConnections(brandId);
    setConnections(all);
    setPicked(new Set(socialConnections(all).map((c) => c.id)));
  };
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);
  const social = connections ? socialConnections(connections) : [];
  const read = async () => {
    setBusy(true);
    const r = await readSocialAccounts(brandId, taskId, [...picked]);
    setBusy(false);
    if (r.success === false) { toast.error(r.error); return; }
    if (r.errors.length) toast(`Could not read ${r.errors.map((e) => e.account).join(", ")}; Kinika has the rest.`);
    onStarted();
  };
  return (
    <div role="region" aria-label="Connect your social" className="rounded-2xl border border-[hsl(var(--brand-blue-line))] bg-accent/40 p-4 flex flex-col gap-3 max-w-[85%]">
      <div className="flex flex-col gap-1">
        <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-accent-foreground">Connect your social</span>
        <p className="font-ui text-[14px] text-foreground">Kinika reads your accounts for the follower counts and engagement, and writes the numbers into the deliverable with their source. You never type them.</p>
      </div>
      {connections === null ? (
        <div className="flex items-center gap-2 font-ui text-[12px] text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Looking at what is connected</div>
      ) : (
        <>
          {social.length > 0 && (
            <div className="flex flex-col gap-1.5" role="group" aria-label="Accounts Kinika will read">
              {social.map((c) => {
                const at = c.config?.snapshot_at ? new Date(String(c.config.snapshot_at)).toLocaleDateString() : null;
                return (
                  <label key={c.id} className={cn("flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 cursor-pointer", picked.has(c.id) ? "border-primary/50" : "border-border")}>
                    <input type="checkbox" checked={picked.has(c.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} className="accent-primary" />
                    <span className="font-ui text-[13px] text-foreground flex-1 truncate">{c.display_name}</span>
                    {at && <span className="font-ui text-[11px] text-muted-foreground">last read {at}</span>}
                  </label>
                );
              })}
            </div>
          )}
          <ConnectProviders brandId={brandId} connections={connections} kinds={["social"]} compact onConnected={load} />
        </>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" disabled={busy || picked.size === 0} onClick={read} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground font-ui text-[13px] font-medium disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : null} {busy ? "Reading your accounts" : picked.size > 1 ? `Read these ${picked.size} accounts` : "Read this account"}
        </button>
        <button type="button" disabled={busy} onClick={onSkip} className="h-9 px-3 rounded-lg font-ui text-[13px] text-muted-foreground hover:text-foreground">Not now</button>
      </div>
    </div>
  );
}
