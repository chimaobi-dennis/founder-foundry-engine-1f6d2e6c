import { useEffect, useMemo, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getStudioElements } from "@/services/templateService";
import { useAuth } from "@/contexts/AuthContext";

interface StudioElementRow {
  id: string;
  name: string;
  element_type: string; // background | text | image | decoration | shape | other
  preview_svg?: string | null;
  html_snippet: string;
  tags?: string[] | null;
}

interface Props {
  onInsert: (htmlSnippet: string) => void;
}

const TYPE_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: "shapes", label: "Shapes", types: ["shape"] },
  { key: "text", label: "Text", types: ["text"] },
  { key: "decorations", label: "Decorations", types: ["decoration", "background"] },
  { key: "images", label: "Images", types: ["image"] },
];

export function ElementsPanel({ onInsert }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<StudioElementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    setLoading(true);
    getStudioElements(user.id)
      .then((rows) => {
        if (!cancelled) setItems((rows ?? []) as StudioElementRow[]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((el) => {
      const tagsStr = (el.tags ?? []).join(" ");
      return (
        el.name.toLowerCase().includes(q) ||
        el.element_type.toLowerCase().includes(q) ||
        tagsStr.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const grouped = useMemo(() => {
    return TYPE_GROUPS.map((g) => ({
      ...g,
      items: filtered.filter((el) => g.types.includes(el.element_type)),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-2 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elements"
            className="h-8 pl-7 text-[12px] font-ui"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-[11px] font-ui text-muted-foreground text-center px-4 py-6">
            {items.length === 0
              ? "No elements available yet"
              : "No matches"}
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.key}>
              <div className="px-1 mb-1.5 text-[10px] font-ui font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {group.items.map((el) => (
                  <ElementCard
                    key={el.id}
                    item={el}
                    onClick={() => onInsert(el.html_snippet)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ElementCard({
  item,
  onClick,
}: {
  item: StudioElementRow;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group aspect-square rounded-md border border-border bg-background overflow-hidden",
        "transition-colors hover:border-primary hover:bg-primary/5",
        "flex flex-col items-center justify-center p-1.5",
      )}
      title={`Insert ${item.name}`}
    >
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
        {item.preview_svg ? (
          <div
            className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full"
            // preview_svg is a controlled, sanitized string from our DB
            dangerouslySetInnerHTML={{ __html: item.preview_svg }}
          />
        ) : (
          <div
            className="w-full h-full relative overflow-hidden"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="absolute inset-0 origin-top-left"
              style={{ transform: "scale(0.18)", width: 600, height: 600 }}
              dangerouslySetInnerHTML={{ __html: item.html_snippet }}
            />
          </div>
        )}
      </div>
      <span className="block mt-1 text-[10px] font-ui text-muted-foreground truncate w-full text-center group-hover:text-foreground">
        {item.name}
      </span>
    </button>
  );
}
