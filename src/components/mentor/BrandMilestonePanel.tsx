import { Flag, Plus, ChevronDown, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrand } from "@/contexts/BrandContext";
import { MentorBrand, Milestone, MilestoneCategory, categoryColors } from "./types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BrandMilestonePanelProps {
  brands: MentorBrand[];
  activeBrand: MentorBrand;
  onSelectBrand: (brand: MentorBrand) => void;
  onAddBrand: () => void;
  milestones: Milestone[];
  onSelectMilestone: (id: string) => void;
  onRenameMilestone?: (id: string, newName: string) => void;
  onDeleteMilestone?: (id: string) => void;
  onEditMilestoneCategory?: (id: string, newCategory: MilestoneCategory) => void;
}

const CATEGORIES: MilestoneCategory[] = [
  "Brand Discovery",
  "Campaign Strategy",
  "Customer Insight",
  "Product Positioning",
  "Growth Brainstorm",
  "Pitch Preparation",
];

export function BrandMilestonePanel({
  brands,
  activeBrand,
  onSelectBrand,
  onAddBrand,
  milestones,
  onSelectMilestone,
  onRenameMilestone,
  onDeleteMilestone,
  onEditMilestoneCategory,
}: BrandMilestonePanelProps) {
  const { brands: realBrands } = useBrand();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Helper to get brand color from real brands
  const getBrandColor = (brandId: string) => {
    const realBrand = realBrands.find(b => b.id === brandId);
    return realBrand?.primary_color || '#666';
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = (ms: Milestone) => {
    setEditingId(ms.id);
    setEditValue(ms.name);
    setEditCategoryId(null);
  };

  const confirmRename = () => {
    if (editingId && editValue.trim() && onRenameMilestone) {
      onRenameMilestone(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Brand switcher */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full h-11 rounded-lg border border-border bg-card px-3 flex items-center gap-2.5 hover:border-card-border-hover transition-colors"
          >
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: getBrandColor(activeBrand.id) }}
            />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] font-ui font-medium text-foreground truncate">{activeBrand.name}</p>
              <p className="text-[10px] font-ui text-muted-foreground">Started {activeBrand.startedDate}</p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => { onSelectBrand(brand); setDropdownOpen(false); }}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-muted/50 transition-colors",
                    brand.id === activeBrand.id && "bg-muted/30"
                  )}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: getBrandColor(brand.id) }}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-[13px] font-ui truncate", brand.id === activeBrand.id ? "text-primary font-medium" : "text-foreground")}>{brand.name}</p>
                    <p className="text-[10px] font-ui text-muted-foreground">Started {brand.startedDate}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onAddBrand}
          className="w-full h-9 rounded-lg border border-primary text-primary font-ui text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
        >
          <Plus size={15} />
          New brand
        </button>
      </div>

      <div className="px-4 flex-shrink-0">
        <div className="border-t border-border" />
        <div className="flex items-center gap-1.5 mt-3 mb-2">
          <Flag size={11} className="text-muted-foreground" />
          <p className="text-[11px] font-ui uppercase tracking-[0.1em] text-muted-foreground">
            Milestones
          </p>
        </div>
      </div>

      {/* Milestones */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 pb-4 space-y-0.5">
          {milestones.length === 0 ? (
            <p className="px-3 py-4 text-[12px] font-ui text-muted-foreground italic">
              Milestones will appear as your brand takes shape
            </p>
          ) : (
            milestones.map((ms) => {
              const colors = categoryColors[ms.category] || "text-muted-foreground border-border";
              const borderColor = colors.split(" ").find(c => c.startsWith("border-")) || "border-primary";
              const isEditing = editingId === ms.id;
              const isEditingCategory = editCategoryId === ms.id;

              return (
                <div
                  key={ms.id}
                  className={cn(
                    "group relative w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-200 hover:bg-muted/50 border-l-2 overflow-hidden min-w-0",
                    borderColor
                  )}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Flag size={11} className="text-primary flex-shrink-0" />
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="flex-1 min-w-0 text-[13px] font-ui text-foreground bg-transparent border-b border-primary outline-none py-0.5"
                      />
                      <button onClick={confirmRename} className="p-0.5 text-primary hover:text-primary/80 flex-shrink-0">
                        <Check size={12} />
                      </button>
                      <button onClick={cancelRename} className="p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelectMilestone(ms.id)}
                      className="w-full text-left min-w-0 pr-6"
                    >
                      <div className="flex items-start gap-1.5 mb-0.5 min-w-0">
                        <Flag size={11} className="text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-[13px] font-ui text-foreground leading-tight break-words" style={{ wordBreak: "break-word" }}>{ms.name}</span>
                      </div>
                      <p className="text-[11px] font-ui text-muted-foreground ml-[17px] break-words" style={{ wordBreak: "break-word" }}>{ms.category} · {ms.timeAgo}</p>
                    </button>
                  )}

                  {isEditingCategory && (
                    <div className="mt-2 ml-[17px] space-y-0.5">
                      {CATEGORIES.map((cat) => {
                        const catColors = categoryColors[cat] || "text-muted-foreground border-border";
                        const catBorderColor = catColors.split(" ").find(c => c.startsWith("border-")) || "border-primary";
                        const catTextColor = catColors.split(" ").find(c => c.startsWith("text-")) || "text-primary";
                        return (
                          <button
                            key={cat}
                            onClick={() => {
                              onEditMilestoneCategory?.(ms.id, cat);
                              setEditCategoryId(null);
                            }}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-[11px] font-ui transition-colors hover:bg-muted/50 flex items-center gap-2",
                              ms.category === cat ? "bg-muted/30 font-medium" : ""
                            )}
                          >
                            <div className={cn("w-1.5 h-1.5 rounded-full", catBorderColor.replace("border-", "bg-"))} />
                            <span className={cn(catTextColor)}>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions menu */}
                  {!isEditing && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
                            <MoreHorizontal size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                          <DropdownMenuItem onClick={() => startRename(ms)} className="text-[12px] gap-2">
                            <Pencil size={12} />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditCategoryId(editCategoryId === ms.id ? null : ms.id)}
                            className="text-[12px] gap-2"
                          >
                            <Flag size={12} />
                            Change category
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmId(ms.id)}
                            className="text-[12px] gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 size={12} />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-ui text-[15px]">Delete milestone?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              This will remove the milestone marker from your conversation. The conversation itself will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[13px]"
              onClick={() => {
                if (deleteConfirmId) onDeleteMilestone?.(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
