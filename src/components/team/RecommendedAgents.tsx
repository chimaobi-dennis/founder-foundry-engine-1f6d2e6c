import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { listAgents, listHires, hireAgent, type Agent } from "@/services/agentService";
import { agentSuitsStage } from "@shared/runner";
import { cn } from "@/lib/utils";

/**
 * Mentor's hiring suggestions: agents suited to the brand's current journey
 * stage that aren't on the team yet. Stays quiet when there's nothing to add.
 */
export function RecommendedAgents({ brandId, stage, className }: { brandId: string | null | undefined; stage: string | null | undefined; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggested, setSuggested] = useState<Agent[]>([]);
  const [hiring, setHiring] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    let active = true;
    Promise.all([listAgents(), listHires(brandId)]).then(([agents, hires]) => {
      if (!active) return;
      const hired = new Set(hires.map((h) => h.agent_id));
      const fit = agents.filter((a) => !hired.has(a.id) && agentSuitsStage(a.suited_stages, stage));
      setSuggested(fit.slice(0, 2));
      setLoaded(true);
    });
    return () => { active = false; };
  }, [brandId, stage]);

  if (!brandId || !loaded || suggested.length === 0) return null;

  return (
    <div className={cn("px-4 py-4 border-t border-border/60", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Worth adding now</span>
        <button onClick={() => navigate("/team")} className="font-ui text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Kinika's team <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="space-y-2">
        {suggested.map((a) => (
          <div key={a.id} className="rounded-lg border border-border/60 bg-card/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[14px] text-foreground">{a.name}</span>
              <button
                disabled={hiring === a.id}
                onClick={async () => {
                  if (!user?.id) return;
                  setHiring(a.id);
                  const r = await hireAgent(brandId, user.id, a.id);
                  setHiring(null);
                  if (r.success) {
                    toast(`${a.name} joined your team`);
                    setSuggested((s) => s.filter((x) => x.id !== a.id));
                  } else toast.error(r.error ?? "Could not hire");
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] font-ui hover:border-primary disabled:opacity-50"
              >
                {hiring === a.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
              </button>
            </div>
            <p className="font-ui text-[11px] text-muted-foreground mt-1 leading-snug">{a.tagline}</p>
          </div>
        ))}
      </div>
      <p className="font-ui text-[10px] text-muted-foreground/80 mt-2">Suggested for the {stage} stage. Nothing runs until you give a task.</p>
    </div>
  );
}

export default RecommendedAgents;
