import { useState } from "react";
import { Search } from "lucide-react";
import { Template } from "./types";
import { TemplateCardPreview } from "./TemplateCardPreview";
import { TemplatePreviewModal } from "./TemplatePreviewModal";

interface Props {
  templates: Template[];
  categories: string[];
  onSelect: (t: Template) => void;
  brandName?: string;
}

export function TemplateGrid({ templates, categories, onSelect, brandName }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Popular");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const filtered = templates
    .filter((t) => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "All" || t.category === category;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sort === "Newest") return 0;
      if (sort === "Featured") return 0;
      const parseUses = (u: string) => parseFloat(u.replace("k", "")) * (u.includes("k") ? 1000 : 1);
      return parseUses(b.uses) - parseUses(a.uses);
    });

  return (
    <div>
      {/* Search & filter bar */}
      <div className="flex items-center gap-3 mb-6 p-2 rounded-xl border border-border bg-card">
        <div className="flex-1 flex items-center gap-2 px-3">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full h-[44px] bg-transparent text-[13px] font-ui text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-[36px] px-3 rounded-md border border-border bg-background text-[12px] font-ui text-foreground outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-[36px] px-3 rounded-md border border-border bg-background text-[12px] font-ui text-foreground outline-none"
        >
          {["Popular", "Newest", "Featured"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Masonry grid */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="break-inside-avoid rounded-xl border border-border overflow-hidden cursor-pointer group bg-card transition-shadow hover:shadow-md"
          >
            <div className="relative overflow-hidden">
              <TemplateCardPreview template={t} brandName={brandName || ''} />
              {/* Hover overlay with two buttons - always visible on mobile, hover on desktop */}
              <div className="absolute inset-0 bg-black/40 md:bg-black/0 md:group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 md:p-0">
                <div className="flex flex-row gap-2 w-full md:w-auto mx-[5px] px-[5px]">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewTemplate(t); }}
                    className="w-full md:w-auto px-3 md:px-4 py-1.5 md:py-[7px] rounded-full text-[10px] md:text-[12px] font-ui text-white border cursor-pointer transition-colors hover:bg-white/25 whitespace-nowrap text-center"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', borderColor: 'rgba(255,255,255,0.25)' }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(t); }}
                    className="w-full md:w-auto px-3 md:px-4 py-1.5 md:py-[7px] rounded-full text-[10px] md:text-[12px] font-ui font-medium cursor-pointer transition-colors hover:opacity-90 whitespace-nowrap text-center"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    Use template
                  </button>
                </div>
              </div>
            </div>
            <div className="p-[10px_12px] flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-ui font-medium text-foreground truncate">
                  {t.name}
                </div>
                <div className="text-[11px] font-ui text-muted-foreground">
                  by {t.creator}
                </div>
              </div>
              <span className="text-[11px] font-ui text-muted-foreground whitespace-nowrap mt-0.5">
                {t.uses} uses
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUseTemplate={(t) => { setPreviewTemplate(null); onSelect(t); }}
        brandName={brandName || ''}
      />
    </div>
  );
}
