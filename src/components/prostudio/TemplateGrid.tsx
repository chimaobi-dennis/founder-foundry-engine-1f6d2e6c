import { useState, useEffect } from "react";
import { Search, Heart } from "lucide-react";
import { Template } from "./types";
import { TemplateCardPreview } from "./TemplateCardPreview";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { getPublishedTemplates } from "@/services/templateService";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  templates: Template[];
  categories: string[];
  onSelect: (t: Template) => void;
  brandName?: string;
  templateType?: "physical" | "digital";
  loading?: boolean;
}

const getAspectRatio = (index: number) => {
  const ratios = ['1/1', '4/5', '3/4', '1/1', '4/3', '3/4', '1/1', '4/5'];
  return ratios[index % ratios.length];
};

function LoadingSkeleton() {
  return (
    <div className="columns-2 md:columns-3 xl:columns-4" style={{ columnGap: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="break-inside-avoid mb-2 inline-block w-full">
          <Skeleton
            className="w-full rounded-xl bg-amber-500/10"
            style={{ aspectRatio: getAspectRatio(i) }}
          />
        </div>
      ))}
    </div>
  );
}

export function TemplateGrid({ templates, categories, onSelect, brandName, templateType, loading: externalLoading = false }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Use passed-in templates directly
  const filtered = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || t.category === category;
    return matchSearch && matchCat;
  });

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-medium font-ui text-foreground">
          {templateType === "digital" ? "Digital Product" : "Physical Product"}
        </h2>
        <span className="text-[12px] font-ui text-muted-foreground">
          {filtered.length} template{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full h-[40px] rounded-[20px] border border-[#2A3A4A] bg-[#0D1B2A] dark:bg-[#0D1B2A] pl-9 pr-4 text-[13px] font-ui text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="flex-shrink-0 rounded-[20px] px-4 py-1.5 text-[12px] font-ui whitespace-nowrap cursor-pointer transition-colors"
            style={
              category === c
                ? { background: "#D4A017", color: "#0D1B2A", fontWeight: 500 }
                : { border: "0.5px solid #2A3A4A", color: "#8A96A3", background: "transparent" }
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* Masonry grid */}
      {externalLoading ? (
        <LoadingSkeleton />
      ) : (
        <div
          className="columns-2 md:columns-3 xl:columns-4"
          style={{ columnGap: 8 }}
        >
          {filtered.map((t, idx) => {
            const hasCover = !!(t as any).cover_image_url;
            const saved = savedIds.has(t.id);
            const aspectRatio = getAspectRatio(idx);
            const imageUrl = hasCover
              ? (t as any).cover_image_url
              : (t as any).template_preview_images?.[0]?.image_url;

            return (
              <div
                key={t.id}
                className="break-inside-avoid mb-2 inline-block w-full relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30"
                style={{ aspectRatio }}
                onClick={() => onSelect(t)}
              >
                {/* Full-bleed image */}
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={t.name}
                    className="w-full h-full object-cover absolute inset-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-amber-500/20 to-amber-600/20">
                    <TemplateCardPreview template={t} brandName={brandName || ""} />
                  </div>
                )}

                {/* Gradient overlay at bottom - always visible */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

                {/* Category badge - top-left */}
                <div
                  className="absolute top-[10px] left-[10px] rounded-[20px] px-[10px] py-[3px] text-[10px] tracking-wide font-medium"
                  style={{
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(4px)",
                    color: "rgba(255,255,255,0.95)",
                  }}
                >
                  {t.category}
                </div>

                {/* Heart/save icon - top-right */}
                <button
                  className="absolute top-[10px] right-[10px] w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{
                    background: "rgba(0,0,0,0.45)",
                    backdropFilter: "blur(4px)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSave(t.id);
                  }}
                >
                  <Heart
                    size={14}
                    className={saved ? "fill-amber-500 text-amber-500" : "text-white/70"}
                  />
                </button>

                {/* Template name - always visible at bottom-left */}
                <div className="absolute bottom-[10px] left-[10px] right-[10px]">
                  <div className="text-[14px] font-semibold text-white truncate drop-shadow-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {t.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onUseTemplate={(t) => {
          setPreviewTemplate(null);
          onSelect(t);
        }}
        brandName={brandName || ""}
      />
    </div>
  );
}
