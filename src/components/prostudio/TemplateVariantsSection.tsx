import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  AlertTriangle,
  Trash2,
  Edit2,
  Plus,
  Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getTemplateVariants,
  deleteTemplateVariant,
  type TemplateVariant,
} from "@/services/templateService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  slug: string;
  image_width: number | null;
  image_height: number | null;
  sort_order: number | null;
}

// ─── Variant row ──────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  onEdit,
  onDelete,
}: {
  variant: TemplateVariant;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p = variant.platform;
  const dims =
    p.image_width && p.image_height
      ? `${p.image_width}×${p.image_height}`
      : p.image_width
      ? `${p.image_width}px wide`
      : "variable height";

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-ui font-medium text-foreground">
            {p.name}
          </span>
          <span className="text-[11px] font-ui text-muted-foreground">{dims}</span>
          {variant.is_primary && (
            <span className="flex items-center gap-1 text-[10px] font-ui font-medium px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">
              <Star size={9} />
              Primary
            </span>
          )}
          <span
            className={`text-[10px] font-ui font-medium px-1.5 py-0.5 rounded-sm capitalize ${
              variant.status === "active"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {variant.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {variant.fitness_check_passed ? (
          <CheckCircle size={15} className="text-green-500" />
        ) : (
          <AlertTriangle size={15} className="text-primary" />
        )}
        <button
          onClick={onEdit}
          className="h-7 px-2.5 rounded border border-border text-[12px] font-ui text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1"
        >
          <Edit2 size={12} />
          Edit
        </button>
        {variant.status !== "active" && (
          <button
            onClick={onDelete}
            className="h-7 w-7 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex items-center justify-center"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function TemplateVariantsSection({
  templateId,
}: {
  templateId: string;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [variants, setVariants] = useState<TemplateVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);

  useEffect(() => {
    loadVariants();
  }, [templateId]);

  const loadVariants = async () => {
    setLoadingVariants(true);
    const data = await getTemplateVariants(templateId);
    setVariants(data);
    setLoadingVariants(false);
  };

  const handleDelete = async (variantId: string) => {
    const result = await deleteTemplateVariant(variantId);
    if (result.success) {
      toast({ title: "Variant deleted" });
      loadVariants();
    } else {
      toast({ title: "Delete failed", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-ui font-medium uppercase tracking-wider text-muted-foreground">
          Platform Variants
        </p>
        <button
          onClick={() => navigate(`/creator/templates/${templateId}/variants/new`)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[12px] font-ui text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Plus size={13} />
          Add variant
        </button>
      </div>

      {/* Variants list */}
      {loadingVariants ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : variants.length === 0 ? (
        <p className="text-[12px] font-ui italic text-muted-foreground/60">
          No variants yet — add one for each platform you want to support.
        </p>
      ) : (
        <div className="space-y-2">
          {variants.map((v) => (
            <VariantRow
              key={v.id}
              variant={v}
              onEdit={() => navigate(`/creator/templates/${templateId}/variants/${v.id}`)}
              onDelete={() => handleDelete(v.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}