import { useState } from "react";
import {
  Fingerprint, Megaphone, Users, Palette, Flag, Pencil, Plus,
  MessageCircle, Download, Share2, ChevronRight, Upload,
  Sparkles, BookOpen, Film, BarChart3, Calendar, FileText, Link2, Lightbulb
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DNAField {
  key: string;
  value: string | null;
  flagMilestone?: string;
  flagDate?: string;
  type?: "color" | "upload";
  colorHex?: string;
}

interface MilestoneItem {
  name: string;
  category: string;
  categoryColor: string;
  timeAgo: string;
}

interface BrandProfile {
  id: string;
  initials: string;
  name: string;
  subtitle: string;
  circleColor: string;
  completeness: number;
  lastUpdated: string;
  fieldsAdded: string;
  milestones: MilestoneItem[];
  identity: DNAField[];
  voice: DNAField[];
  audience: DNAField[];
  visual: DNAField[];
}

const nordformProfile: BrandProfile = {
  id: "1",
  initials: "NF",
  name: "Nordform",
  subtitle: "Functional Wellness · Stockholm, Sweden",
  circleColor: "#2D4A3E",
  completeness: 74,
  lastUpdated: "Last updated from Mentor session · 2 days ago",
  fieldsAdded: "6 fields added this session",
  milestones: [
    { name: "Identity and skeptic positioning", category: "Brand Discovery", categoryColor: "hsl(160 25% 30%)", timeAgo: "2 days ago" },
    { name: "Packaging direction", category: "Brand Discovery", categoryColor: "hsl(160 25% 30%)", timeAgo: "5 days ago" },
    { name: "Target audience profile", category: "Customer Insight", categoryColor: "hsl(174 72% 40%)", timeAgo: "1 week ago" },
    { name: "Ritual and consistency positioning", category: "Product Positioning", categoryColor: "hsl(271 60% 55%)", timeAgo: "2 weeks ago" },
    { name: "Launch strategy", category: "Campaign Strategy", categoryColor: "hsl(217 91% 60%)", timeAgo: "3 weeks ago" },
  ],
  identity: [
    { key: "Brand name", value: "Nordform", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Industry", value: "Functional wellness and adaptogens", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Tagline", value: "Clarity from the north", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Location / market", value: "Stockholm, Sweden", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Founded", value: "2024" },
  ],
  voice: [
    { key: "Brand voice", value: "Clean, evidence-based, quietly confident — no wellness-industry fluff", flagMilestone: "Identity and skeptic positioning", flagDate: "2 days ago" },
    { key: "Tone descriptors", value: "Minimal and considered. Speaks to intelligent adults. Never over-claims.", flagMilestone: "Identity and skeptic positioning", flagDate: "2 days ago" },
    { key: "Brand references", value: "Aesop meets Oatly — design-led but scientifically grounded", flagMilestone: "Identity and skeptic positioning", flagDate: "2 days ago" },
    { key: "Positioning statement", value: "Premium functional supplements for Stockholm professionals who are skeptical of wellness culture but serious about performance and recovery", flagMilestone: "Identity and skeptic positioning", flagDate: "2 days ago" },
    { key: "Core promise", value: "Supplements that respect your intelligence", flagMilestone: "Identity and skeptic positioning", flagDate: "2 days ago" },
  ],
  audience: [
    { key: "Target audience", value: "Stockholm professionals 28–42, health-conscious, design-aware, internationally oriented, high disposable income", flagMilestone: "Target audience profile", flagDate: "1 week ago" },
    { key: "Customer profile", value: "28–42, works in tech or design, goes to Lidingöloppet, reads about longevity, slightly embarrassed by wellness industry", flagMilestone: "Target audience profile", flagDate: "1 week ago" },
    { key: "Pain points", value: null },
    { key: "Why they choose us", value: null },
  ],
  visual: [
    { key: "Primary color", value: "#2D4A3E", type: "color", colorHex: "#2D4A3E", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Secondary color", value: "#F5F0E8", type: "color", colorHex: "#F5F0E8", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Brand feel", value: "Nordic minimalism, muted natural tones, clean typography, tactile packaging", flagMilestone: "Brand Discovery", flagDate: "2 days ago" },
    { key: "Logo", value: null, type: "upload" },
  ],
};

const sthlmProfile: BrandProfile = {
  id: "2",
  initials: "SS",
  name: "Sthlm Studio",
  subtitle: "SaaS · Stockholm, Sweden",
  circleColor: "#1A3A5C",
  completeness: 31,
  lastUpdated: "Last updated from Mentor session · 3 days ago",
  fieldsAdded: "2 fields added this session",
  milestones: [
    { name: "Initial brand exploration", category: "Brand Discovery", categoryColor: "hsl(160 25% 30%)", timeAgo: "3 days ago" },
  ],
  identity: [
    { key: "Brand name", value: "Sthlm Studio", flagMilestone: "Brand Discovery", flagDate: "3 days ago" },
    { key: "Industry", value: "SaaS — freelance and creative studio management", flagMilestone: "Brand Discovery", flagDate: "3 days ago" },
    { key: "Tagline", value: "Built for how Stockholm works" },
    { key: "Location / market", value: "Stockholm, Sweden" },
    { key: "Founded", value: null },
  ],
  voice: [
    { key: "Brand voice", value: "Direct, practical, respectful of the user's time" },
    { key: "Tone descriptors", value: null },
    { key: "Brand references", value: null },
    { key: "Positioning statement", value: null },
    { key: "Core promise", value: null },
  ],
  audience: [
    { key: "Target audience", value: "Swedish creative freelancers and small studios" },
    { key: "Customer profile", value: null },
    { key: "Pain points", value: null },
    { key: "Why they choose us", value: null },
  ],
  visual: [
    { key: "Primary color", value: "#1A3A5C", type: "color", colorHex: "#1A3A5C" },
    { key: "Secondary color", value: "#F0F4F8", type: "color", colorHex: "#F0F4F8" },
    { key: "Brand feel", value: null },
    { key: "Logo", value: null, type: "upload" },
  ],
};

const modules = [
  { name: "Mentor", icon: MessageCircle },
  { name: "ProStudio", icon: Sparkles },
  { name: "CampaignKit", icon: Lightbulb },
  { name: "ContentCalendar", icon: Calendar },
  { name: "DocStudio", icon: FileText },
  { name: "ReelBuilder", icon: Film },
];

function FieldRow({ field, isLast }: { field: DNAField; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(field.value || "");
  const [hover, setHover] = useState(false);

  const renderValue = () => {
    if (field.type === "color" && field.value) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: field.colorHex || field.value }} />
          <span className="text-[13px] text-foreground">{field.value}</span>
        </div>
      );
    }
    if (field.type === "upload" && !field.value) {
      return (
        <div className="h-12 border border-dashed border-border rounded-lg flex items-center justify-center gap-2 cursor-pointer">
          <Upload size={14} className="text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Upload logo</span>
        </div>
      );
    }
    if (!field.value) {
      return (
        <span className="text-muted-foreground">
          — <span className="text-[11px] italic ml-1">Not yet defined</span>
        </span>
      );
    }
    return <span className="text-[13px] text-foreground">{field.value}</span>;
  };

  return (
    <div
      className={`flex items-center px-4 py-3.5 ${!isLast ? "border-b border-border" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground w-[40%] flex-shrink-0">
        {field.key}
      </span>
      <div className="w-[60%] flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="flex-1 bg-transparent border-b border-primary text-[13px] text-foreground outline-none py-0.5"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              autoFocus
            />
            <button onClick={() => setEditing(false)} className="text-[12px] text-primary font-medium">Save</button>
            <button onClick={() => { setEditing(false); setEditVal(field.value || ""); }} className="text-[12px] text-muted-foreground">Cancel</button>
          </div>
        ) : (
          <>
            <div className="flex-1">{renderValue()}</div>
            {field.flagMilestone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Flag size={12} className="text-primary flex-shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-[hsl(213_52%_11%)] text-[hsl(36_33%_94%)] text-[11px] px-2.5 py-1 rounded-md border-0">
                  Saved from {field.flagMilestone} · {field.flagDate}
                </TooltipContent>
              </Tooltip>
            )}
            {hover && field.type !== "upload" && (
              <button onClick={() => { setEditVal(field.value || ""); setEditing(true); }} className="flex-shrink-0">
                <Pencil size={14} className="text-muted-foreground" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ icon: Icon, title, fields }: { icon: React.ElementType; title: string; fields: DNAField[] }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-primary" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {fields.map((f, i) => (
          <FieldRow key={f.key} field={f} isLast={i === fields.length - 1} />
        ))}
      </div>
    </div>
  );
}

const BrandDNA = () => {
  const { activeBrand, switchBrand, brands } = useBrand();
  const [activeProfileId, setActiveProfileId] = useState(activeBrand?.id || "1");

  const profile = activeProfileId === "1" ? nordformProfile : sthlmProfile;

  const handleSwitchBrand = (id: string) => {
    setActiveProfileId(id);
    const brand = brands.find((b) => b.id === id);
    if (brand) switchBrand(brand.id);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Page header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-0">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 font-ui text-base font-medium"
                style={{ backgroundColor: profile.circleColor, color: "#F5F0E8" }}
              >
                {profile.initials}
              </div>
              <div>
                <h1 className="font-display text-[28px] text-foreground leading-tight">{profile.name}</h1>
                <p className="text-[13px] text-muted-foreground font-ui">{profile.subtitle}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-[10px] bg-primary/15 text-primary font-medium">Pro Plan</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-[10px] font-medium" style={{ background: "hsl(142 71% 45% / 0.15)", color: "hsl(142 71% 45%)" }}>Brand DNA Active</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 px-5 min-w-[220px] bg-card">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Profile completeness</p>
              <p className="font-display text-[32px] text-primary leading-tight mt-0.5">{profile.completeness}%</p>
              <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${profile.completeness}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{profile.lastUpdated}</p>
              <p className="text-[11px] text-primary">{profile.fieldsAdded}</p>
            </div>
          </div>

          <div className="border-t border-border my-6" />

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column */}
            <div className="flex-1 min-w-0">
              <CategoryCard icon={Fingerprint} title="Identity" fields={profile.identity} />
              <CategoryCard icon={Megaphone} title="Voice and positioning" fields={profile.voice} />
              <CategoryCard icon={Users} title="Audience" fields={profile.audience} />
              <CategoryCard icon={Palette} title="Visual" fields={profile.visual} />

              <div className="rounded-lg bg-muted/50 p-3 px-4 mt-4 flex items-start gap-2.5">
                <MessageCircle size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Brand DNA grows automatically as you chat with your Mentor. The more you build together, the more complete your profile becomes.
                </p>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-full lg:w-[300px] flex-shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Your brands</p>

              {[nordformProfile, sthlmProfile].map((bp) => {
                const isActive = bp.id === activeProfileId;
                return (
                  <div
                    key={bp.id}
                    onClick={() => handleSwitchBrand(bp.id)}
                    className={`h-[52px] rounded-[10px] px-3.5 flex items-center gap-2.5 mb-2 cursor-pointer transition-colors ${
                      isActive
                        ? "border-2 border-primary bg-primary/10"
                        : "border border-border hover:border-primary/30"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
                      style={{ backgroundColor: bp.circleColor, color: "#F5F0E8" }}
                    >
                      {bp.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{bp.name}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{bp.completeness}% complete</span>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 14 14" className="text-primary flex-shrink-0">
                        <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer">
                <Plus size={14} className="text-primary" />
                <span className="text-[12px] text-primary">Add new brand</span>
              </div>

              <div className="border-t border-border my-4" />

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Milestones</p>
              <div className="flex flex-col gap-2.5 mb-1">
                {profile.milestones.map((m, i) => (
                  <div key={i} className="pl-3 relative" style={{ borderLeft: `2px solid ${m.categoryColor}` }}>
                    <div className="flex items-center gap-1.5">
                      <Flag size={12} className="text-primary" />
                      <span className="text-[12px] text-foreground">{m.name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 ml-[18px]">{m.timeAgo}</p>
                    <p className="text-[11px] text-primary mt-0.5 ml-[18px] cursor-pointer">Jump to conversation</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border my-4" />

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Active in modules</p>
              <div className="grid grid-cols-2 gap-2">
                {modules.map((m) => (
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
                { label: "Continue Brand Discovery", icon: MessageCircle },
                { label: "Export Brand DNA as PDF", icon: Download },
                { label: "Share brand profile", icon: Share2 },
              ].map((a) => (
                <div
                  key={a.label}
                  className="h-10 rounded-lg border border-border px-3.5 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors mb-2"
                >
                  <div className="flex items-center gap-2">
                    <a.icon size={14} className="text-primary" />
                    <span className="text-[12px] text-foreground">{a.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandDNA;
