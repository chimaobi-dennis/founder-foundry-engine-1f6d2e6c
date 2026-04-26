import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Layers } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import { getBrandOutputs } from "@/services/templateService";

interface OutputRow {
  id: string;
  output_html: string | null;
  output_image_url: string | null;
  aspect_ratio: string | null;
  variation_index: number | null;
  is_saved_to_library: boolean;
  generation_session_id: string | null;
  created_at: string;
  prostudio_templates?: { name: string | null; cover_image_url: string | null } | null;
}

interface SessionGroup {
  sessionId: string;
  templateName: string;
  thumbnail: string | null;
  firstOutputId: string;
  count: number;
  createdAt: string;
}

function groupBySession(rows: OutputRow[]): SessionGroup[] {
  const map = new Map<string, OutputRow[]>();
  for (const row of rows) {
    const key = row.generation_session_id || row.id; // fall back to row id for legacy rows
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  const groups: SessionGroup[] = [];
  for (const [sessionId, list] of map.entries()) {
    const sorted = [...list].sort(
      (a, b) => (a.variation_index || 0) - (b.variation_index || 0),
    );
    const first = sorted[0];
    const withThumb = sorted.find(r => !!r.output_image_url) || first;
    groups.push({
      sessionId,
      templateName: first.prostudio_templates?.name || "Untitled design",
      thumbnail: withThumb.output_image_url || null,
      firstOutputId: first.id,
      count: sorted.length,
      createdAt: first.created_at,
    });
  }
  // Most recent session first
  groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return groups;
}

function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString();
}

export function LibraryGeneratedSessions() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeBrand?.id) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getBrandOutputs(activeBrand.id, true).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setGroups([]);
      } else {
        setGroups(groupBySession(data as OutputRow[]));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeBrand?.id]);

  if (loading) {
    return (
      <div className="px-6 mt-7 flex items-center gap-2 text-muted-foreground text-[12px] font-ui">
        <Loader2 size={14} className="animate-spin" />
        Loading saved designs…
      </div>
    );
  }

  if (groups.length === 0) return null;

  const handleOpen = (g: SessionGroup) => {
    navigate(`/pro-studio/editor?session=${g.sessionId}&active=${g.firstOutputId}`);
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 mt-7 mb-3.5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
          Saved designs <span className="ml-1">({groups.length})</span>
        </p>
      </div>
      <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {groups.map((g) => (
          <button
            key={g.sessionId}
            onClick={() => handleOpen(g)}
            className="group text-left rounded-[10px] overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors"
          >
            <div className="relative aspect-square bg-muted/30">
              {g.thumbnail ? (
                <img
                  src={g.thumbnail}
                  alt={g.templateName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[11px] font-ui">
                  No preview
                </div>
              )}
              {g.count > 1 && (
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-ui px-2 py-0.5 rounded-full bg-background/85 text-foreground border border-border backdrop-blur-sm">
                  <Layers size={10} />
                  {g.count} variants
                </span>
              )}
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[12px] font-ui font-medium text-foreground truncate">
                {g.templateName}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-ui text-muted-foreground">ProStudio</span>
                <span className="text-[10px] font-ui text-muted-foreground">
                  {formatDate(g.createdAt)}
                </span>
              </div>
              <p className="text-[10px] font-ui text-primary mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Open in Studio →
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
