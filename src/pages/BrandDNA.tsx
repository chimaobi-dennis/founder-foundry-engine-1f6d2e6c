import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Fingerprint, Megaphone, Users, Palette, Flag, Plus,
  MessageCircle, Download, Share2, ChevronRight, ChevronDown,
  Sparkles, Film, Calendar, FileText, Lightbulb, AlertCircle
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { useAuth } from "@/contexts/AuthContext";
import {
  getFullBrandProfile,
  exportBrandDNAAsPDF,
  type FullBrandProfile,
  type StageData,
} from "@/services/brandDNAService";
import { getMilestones } from "@/services/mentorService";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const modules = [
  { name: "Mentor", icon: MessageCircle },
  { name: "ProStudio", icon: Sparkles },
  { name: "ContentStudio", icon: Lightbulb },
  { name: "ContentCalendar", icon: Calendar },
  { name: "DocStudio", icon: FileText },
  { name: "ReelBuilder", icon: Film },
];

function getInitials(name: string) {
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatRelative(iso?: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d < 1) return "today";
  if (d === 1) return "1 day ago";
  if (d < 7) return `${d} days ago`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w} week${w > 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo > 1 ? "s" : ""} ago`;
}

function FieldValue({ label, value, onExplore }: { label: string; value: any; onExplore: () => void }) {
  const isEmpty = value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0);
  return (
    <div className="px-4 py-3.5 border-b border-border last:border-b-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1">{label}</p>
      {isEmpty ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground italic">Not yet defined</span>
          <button onClick={onExplore} className="text-[11px] text-primary hover:underline">
            Explore in Mentor →
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-foreground leading-relaxed">
          {Array.isArray(value) ? value.join(", ") : String(value)}
        </p>
      )}
    </div>
  );
}

function ColorSwatch({ label, hex, onExplore }: { label: string; hex?: string; onExplore: () => void }) {
  return (
    <div className="px-4 py-3.5 border-b border-border last:border-b-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{label}</p>
      {hex ? (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: hex }} />
          <span className="text-[13px] text-foreground font-mono">{hex}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground italic">Not yet defined</span>
          <button onClick={onExplore} className="text-[11px] text-primary hover:underline">
            Explore in Mentor →
          </button>
        </div>
      )}
    </div>
  );
}

function StagePanel({
  stage, milestoneCount, onOpenMentor,
}: {
  stage: StageData;
  milestoneCount: number;
  onOpenMentor: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = stage.stageMeta;
  const completion = stage.completion ?? 0;
  const populatedFields = stage.fields.filter(f => f.value && String(f.value).trim() !== "");
  const hasData = populatedFields.length > 0;

  const status = completion >= 100 ? "complete" : hasData || completion > 0 ? "in-progress" : "not-started";
  const statusStyles = {
    complete:     { label: "Complete",    cls: "bg-[hsl(142_71%_45%/0.15)] text-[hsl(142_71%_45%)]" },
    "in-progress":{ label: "In progress", cls: "bg-primary/15 text-primary" },
    "not-started":{ label: "Not started", cls: "bg-muted text-muted-foreground" },
  }[status];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
      >
        {meta.emoji && <span className="text-lg flex-shrink-0">{meta.emoji}</span>}
        <span className="font-display text-[15px] text-foreground flex-shrink-0">{meta.name}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-[10px] font-medium ${statusStyles.cls}`}>
          {statusStyles.label}
        </span>
        <span className="text-[11px] text-muted-foreground">{completion}%</span>
        {milestoneCount > 0 && (
          <span className="text-[11px] text-muted-foreground">· {milestoneCount} milestone{milestoneCount > 1 ? "s" : ""}</span>
        )}
        <ChevronDown size={16} className={`ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border">
          {!hasData ? (
            <div className="px-4 py-5">
              {meta.description && (
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{meta.description}</p>
              )}
              <button onClick={onOpenMentor} className="text-[12px] text-primary hover:underline">
                Start exploring this stage in Mentor →
              </button>
            </div>
          ) : (
            <div>
              {populatedFields.map(f => (
                <div key={f.field_key} className="px-4 py-3.5 border-b border-border last:border-b-0">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1">{f.label}</p>
                  <p className="text-[13px] text-foreground leading-relaxed mb-1.5">{f.value}</p>
                  <button onClick={onOpenMentor} className="text-[11px] text-primary hover:underline">
                    Refine in Mentor →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BrandDNA = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBrand, brands, switchBrand } = useBrand();

  const [profile, setProfile] = useState<FullBrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalMilestones, setTotalMilestones] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!activeBrand?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getFullBrandProfile(activeBrand.id),
      getMilestones(activeBrand.id),
    ])
      .then(([p, ms]) => {
        if (cancelled) return;
        setProfile(p);
        setTotalMilestones(Array.isArray(ms) ? ms.length : 0);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || "Failed to load brand profile");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [activeBrand?.id, user?.id]);

  const goMentor = () => navigate("/mentor");

  const handleExportPDF = async () => {
    if (!activeBrand?.id) return;
    setExporting(true);
    try {
      const blob = await exportBrandDNAAsPDF(activeBrand.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeBrand.name}-brand-dna.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Brand DNA exported");
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    toast.success("Link copied to clipboard");
  };

  const hasAnyData = useMemo(() => {
    if (!profile) return false;
    const dnaPopulated = profile.dna && Object.values(profile.dna).some(v =>
      v !== null && v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0)
    );
    const stageDataPopulated = Object.values(profile.stageData).some(s =>
      s.fields.some(f => f.value && String(f.value).trim() !== "")
    );
    return Boolean(dnaPopulated || stageDataPopulated);
  }, [profile]);

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <div className="text-center max-w-sm">
          <AlertCircle size={32} className="mx-auto text-destructive mb-3" />
          <h2 className="font-display text-[18px] text-foreground mb-1">Couldn't load brand profile</h2>
          <p className="text-[13px] text-muted-foreground mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="text-[12px] text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!profile || !activeBrand) {
    return (
      <div className="flex items-center justify-center flex-1 p-8">
        <p className="text-[13px] text-muted-foreground">No active brand selected.</p>
      </div>
    );
  }

  const brand = profile.brand as any;
  const dna = profile.dna || ({} as any);
  const subtitle = [brand.industry, brand.location].filter(Boolean).join(" · ") || "Add an industry in Mentor";
  const completeness = brand.completeness_score ?? 0;
  const lastUpdatedRel = formatRelative(brand.journey_stage_updated_at) || "—";

  // ─── Empty state ───
  if (!hasAnyData) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-10">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-ui text-base font-medium"
                style={{ backgroundColor: brand.primary_color || "#2D4A3E", color: "#F5F0E8" }}
              >
                {getInitials(brand.name)}
              </div>
              <div>
                <h1 className="font-display text-[28px] text-foreground leading-tight">{brand.name}</h1>
                <p className="text-[13px] text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <div className="text-center py-16 max-w-md mx-auto">
              <Fingerprint size={40} className="mx-auto text-primary mb-4 opacity-60" />
              <h2 className="font-display text-[22px] text-foreground mb-2">
                Your Brand DNA grows with every Mentor conversation
              </h2>
              <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
                Start a conversation in Mentor and your brand insights will automatically appear here.
              </p>
              <button
                onClick={goMentor}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
              >
                Go to Mentor →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showIdentitySection =
    Object.values(profile.stageData.brand?.fields ?? []).some(f => f.value) ||
    [dna.brand_voice, dna.tone_descriptors, dna.brand_references, dna.positioning_statement,
     dna.core_promise, dna.brand_feel].some(v =>
       v !== null && v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0)
    ) ||
    brand.primary_color || brand.secondary_color;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-0">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 font-ui text-base font-medium"
                style={{ backgroundColor: brand.primary_color || "#2D4A3E", color: "#F5F0E8" }}
              >
                {getInitials(brand.name)}
              </div>
              <div>
                <h1 className="font-display text-[28px] text-foreground leading-tight">{brand.name}</h1>
                <p className="text-[13px] text-muted-foreground font-ui">
                  {subtitle}
                  {(brand as any).tagline && <span className="italic"> · {(brand as any).tagline}</span>}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-[10px] bg-primary/15 text-primary font-medium">Pro Plan</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-[10px] font-medium" style={{ background: "hsl(142 71% 45% / 0.15)", color: "hsl(142 71% 45%)" }}>Brand DNA Active</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 px-5 min-w-[220px] bg-card">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Profile completeness</p>
              <p className="font-display text-[32px] text-primary leading-tight mt-0.5">{completeness}%</p>
              <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Last updated from Mentor session · {lastUpdatedRel}
              </p>
            </div>
          </div>

          <div className="border-t border-border my-6" />

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column */}
            <div className="flex-1 min-w-0">
              {/* Section 1: Brand Identity */}
              {showIdentitySection && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Fingerprint size={14} className="text-primary" />
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Brand Identity</span>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden bg-card">
                    <FieldValue label="Brand Name" value={brand.name} onExplore={goMentor} />
                    <FieldValue label="Brand Voice" value={dna.brand_voice} onExplore={goMentor} />
                    <FieldValue label="Tone Descriptors" value={dna.tone_descriptors} onExplore={goMentor} />
                    <FieldValue label="Brand References" value={dna.brand_references} onExplore={goMentor} />
                    <FieldValue label="Positioning Statement" value={dna.positioning_statement} onExplore={goMentor} />
                    <FieldValue label="Core Promise" value={dna.core_promise} onExplore={goMentor} />
                    <FieldValue label="Brand Feel" value={dna.brand_feel} onExplore={goMentor} />
                    <ColorSwatch label="Primary Color" hex={brand.primary_color} onExplore={goMentor} />
                    <ColorSwatch label="Secondary Color" hex={brand.secondary_color} onExplore={goMentor} />
                  </div>
                </div>
              )}

              {/* Section 2: Journey Record */}
              <div>
                <div className="mb-1">
                  <h2 className="font-display text-[18px] text-foreground">Journey Record</h2>
                  <p className="text-[12px] text-muted-foreground mb-4">Everything captured across your brand journey</p>
                </div>
                {Object.values(profile.stageData).map(stage => (
                  <StagePanel
                    key={stage.stageKey}
                    stage={stage}
                    milestoneCount={profile.milestoneCountByStage[stage.stageKey] || 0}
                    onOpenMentor={goMentor}
                  />
                ))}
              </div>

              <div className="rounded-lg bg-muted/50 p-3 px-4 mt-4 flex items-start gap-2.5">
                <MessageCircle size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Brand DNA grows automatically as you chat with your Mentor. The more you build together, the more complete your profile becomes.
                </p>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-full lg:w-[300px] flex-shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Your projects</p>
              {brands.map(b => {
                const isActive = b.id === activeBrand.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => switchBrand(b.id)}
                    className={`h-[52px] rounded-[10px] px-3.5 flex items-center gap-2.5 mb-2 cursor-pointer transition-colors ${
                      isActive ? "border-2 border-primary bg-primary/10" : "border border-border hover:border-primary/30"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                      style={{ backgroundColor: b.primary_color || "#2D4A3E", color: "#F5F0E8" }}
                    >
                      {getInitials(b.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{b.name}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{b.completeness_score ?? 0}%</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer">
                <Plus size={14} className="text-primary" />
                <span className="text-[12px] text-primary">Add new project</span>
              </div>

              <div className="border-t border-border my-4" />

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Milestones</p>
              <div className="rounded-lg border border-border p-3 mb-1">
                <div className="flex items-center gap-2">
                  <Flag size={14} className="text-primary" />
                  <span className="text-[13px] text-foreground font-medium">{totalMilestones}</span>
                  <span className="text-[12px] text-muted-foreground">total milestone{totalMilestones === 1 ? "" : "s"}</span>
                </div>
                <button onClick={goMentor} className="text-[11px] text-primary mt-2 hover:underline">
                  View in Mentor →
                </button>
              </div>

              <div className="border-t border-border my-4" />

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Active in modules</p>
              <div className="grid grid-cols-2 gap-2">
                {modules.map(m => (
                  <div key={m.name} className="rounded-lg border border-border p-2.5 px-3 flex items-center gap-2">
                    <m.icon size={16} className="text-primary flex-shrink-0" />
                    <span className="text-[12px] text-foreground flex-1 truncate">{m.name}</span>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(142 69% 58%)" }} />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2">Brand DNA is powering all 6 modules</p>

              <div className="border-t border-border my-4" />

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Quick actions</p>
              {[
                { label: "Continue Brand Discovery", icon: MessageCircle, onClick: goMentor, disabled: false },
                { label: exporting ? "Exporting..." : "Export Brand DNA as PDF", icon: Download, onClick: handleExportPDF, disabled: exporting },
                { label: "Share brand profile", icon: Share2, onClick: handleShare, disabled: false },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className="w-full h-10 rounded-lg border border-border px-3.5 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors mb-2 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <a.icon size={14} className="text-primary" />
                    <span className="text-[12px] text-foreground">{a.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandDNA;
