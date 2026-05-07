import { Plus, Download, FileText, Handshake, File, Tag, BarChart3, ClipboardList, Mail, Link2 } from "lucide-react";
import type { DocType } from "@/pages/DocStudio";

interface Props {
  brandName: string;
  onSelectType: (type: DocType) => void;
  onOpenRecent: () => void;
}

const recentDocs = [
  { type: "One-Pager" as const, name: "Nordform Brand Overview", date: "Created 3 days ago" },
  { type: "Pitch Deck" as const, name: "Investor Deck — Pre-Seed Round", date: "Created 1 week ago" },
  { type: "Client Proposal" as const, name: "Wholesale Partnership — Apotek Hjärtat", date: "Created 2 weeks ago" },
];

const docTypes: { type: DocType; icon: typeof FileText; desc: string }[] = [
  { type: "Pitch Deck", icon: FileText, desc: "Tell your story to investors" },
  { type: "Client Proposal", icon: Handshake, desc: "Win new business" },
  { type: "One-Pager", icon: File, desc: "Your brand on one page" },
  { type: "Rate Card", icon: Tag, desc: "Your services and pricing" },
  { type: "Case Study", icon: BarChart3, desc: "Prove your results" },
  { type: "Project Brief", icon: ClipboardList, desc: "Define your project scope" },
  { type: "Invoice Cover Letter", icon: Mail, desc: "Professional payment requests" },
  { type: "Partnership Proposal", icon: Link2, desc: "Propose collaborations" },
];

export function DocHome({ brandName, onSelectType, onOpenRecent }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="hidden md:block font-display text-[24px] text-foreground">DocStudio</h1>
          <p className="text-[13px] text-muted-foreground md:mt-0.5">{brandName}</p>
        </div>
        <button
          onClick={() => onSelectType("One-Pager")}
          className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} /> New document
        </button>
      </div>

      {/* Recent documents */}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui mb-4">Recent documents</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {recentDocs.map((doc, i) => (
          <button
            key={i}
            onClick={onOpenRecent}
            className="group text-left rounded-xl border border-border overflow-hidden cursor-pointer transition-all hover:-translate-y-px hover:border-primary/40"
          >
            <div className="h-[120px] bg-muted/50 relative p-5">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              <div className="space-y-2.5 pl-3">
                <div className="h-2 w-3/4 rounded bg-muted-foreground/15" />
                <div className="h-1.5 w-full rounded bg-muted-foreground/10" />
                <div className="h-1.5 w-5/6 rounded bg-muted-foreground/10" />
                <div className="h-1.5 w-2/3 rounded bg-muted-foreground/10" />
                <div className="h-1.5 w-4/5 rounded bg-muted-foreground/10" />
              </div>
            </div>
            <div className="p-3.5 px-4">
              <span className="inline-block text-[10px] font-ui bg-primary/15 text-primary rounded-[10px] px-2 py-0.5 mb-1.5">
                {doc.type}
              </span>
              <p className="text-[14px] font-medium text-foreground font-ui">{doc.name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-muted-foreground">{doc.date}</span>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <Download size={14} />
                  </span>
                  <span className="text-[12px] text-primary font-ui">Open</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Create new */}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui mt-8 mb-4">Create new</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {docTypes.map(({ type, icon: Icon, desc }) => (
          <button
            key={type}
            onClick={() => onSelectType(type)}
            className="text-left rounded-xl border border-border p-5 cursor-pointer transition-all hover:-translate-y-px hover:border-primary/40 border-t-2 border-t-primary"
          >
            <Icon size={22} className="text-primary" />
            <p className="text-[14px] font-medium text-foreground font-ui mt-2.5">{type}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
