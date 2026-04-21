import { Flag, Plus, ChevronDown, MoreHorizontal, Pencil, Trash2, Check, X, Code } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useBrand } from "@/contexts/BrandContext";
import { MentorBrand, Milestone, MilestoneCategory, categoryColors } from "./types";
import type { JourneyStageData } from "@/services/brandService";
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
import { Brand, BrandDNA, completeSubstage, getStageProgress } from "@/services/brandService";

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
  realActiveBrand?: Brand | null;
  activeBrandDNA?: BrandDNA | null;
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
  realActiveBrand,
  activeBrandDNA,
}: BrandMilestonePanelProps) {
  const { brands: realBrands, updateStage, journeyStages, currentStageData } = useBrand();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Helper to build memory summary
  const buildMemorySummary = (brand: Brand | null, dna: BrandDNA | null): string => {
    const parts: string[] = [];

    if (brand?.name && brand.name !== 'Untitled Brand') {
      parts.push(`Building ${brand.name}`);
    }
    if (brand?.industry) parts.push(`in ${brand.industry}`);
    if (dna?.target_audience) parts.push(`for ${dna.target_audience}`);
    if (dna?.core_promise) parts.push(`Promise: ${dna.core_promise}`);
    if (dna?.brand_voice) parts.push(`Voice: ${dna.brand_voice}`);

    return parts.length > 0
      ? parts.join('. ') + '.'
      : 'Keep talking — your brand memory builds as you share more.';
  };

  const currentStage = realActiveBrand?.journey_stage ?? 'spark';
  const stageInfo = currentStageData ?? {
    id: 'spark',
    stage_key: 'spark',
    name: 'Spark',
    emoji: '🔥',
    description: 'You have an idea. Now we need to understand the problem deeply.',
    sort_order: 0,
    is_active: true,
    mentor_focus: null,
    relevant_modules: [],
    suggested_next_steps: [],
    substages: []
  };
  const stageIndex = journeyStages.findIndex(s => s.stage_key === currentStage);

  // Helper to get brand color from real brands
  const getBrandColor = (brandId: string) => {
    const realBrand = realBrands.find(b => b.id === brandId);
    return realBrand?.primary_color || '#666';
  };

  // Helper to capitalise brand name for display
  const capitaliseBrandName = (name: string): string => {
    return name.split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const displayBrandName = capitaliseBrandName(activeBrand.name);

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
    <div className="h-full flex flex-col" style={{ overflow: 'hidden' }}>
      <style>{`
        .mentor-left-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Fixed top section — brand switcher and New project button */}
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
              <p className="text-[13px] font-ui font-medium text-foreground truncate">{displayBrandName}</p>
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
                  className="w-full h-11 px-3 flex items-center gap-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getBrandColor(brand.id) }}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-[13px] font-ui truncate", brand.id === activeBrand.id ? "text-primary font-medium" : "text-foreground")}>{capitaliseBrandName(brand.name)}</p>
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
          New project
        </button>
      </div>

      {/* Scrollable middle section — stage info, change stage, memory, milestones */}
      <div
        className="mentor-left-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '80px'
        }}
      >
        {/* Journey Stage */}
        <div className="px-4" style={{ marginTop: '12px' }}>
          <div style={{
            marginBottom: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '18px' }}>{stageInfo.emoji}</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'DM Sans, sans-serif',
                  color: '#D4A017'
                }}>
                  {stageInfo.name}
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                color: 'var(--color-text-secondary)'
              }}>
                Stage {stageIndex + 1} of 6
              </span>
            </div>
            <div style={{
              height: '3px',
              borderRadius: '2px',
              background: '#1A2A3A',
              margin: '6px 0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: '#D4A017',
                borderRadius: '2px',
                width: `${((stageIndex + 1) / 6) * 100}%`
              }} />
            </div>
            <p style={{
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5',
              marginBottom: '8px'
            }}>
              {stageInfo.description}
            </p>
            <div style={{ marginBottom: '8px' }}>
              {stageInfo.substages.map((substage, idx) => (
                <div key={idx} style={{
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: idx <= stageIndex ? '#D4A017' : 'transparent',
                    border: idx <= stageIndex ? 'none' : '0.5px solid var(--color-border-secondary)'
                  }} />
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {substage}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStagePickerOpen(!stagePickerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                background: stagePickerOpen
                  ? 'rgba(212,160,23,0.15)'
                  : 'rgba(212,160,23,0.08)',
                border: '0.5px solid rgba(212,160,23,0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#D4A017',
                fontWeight: 500,
                transition: 'all 150ms',
                width: '100%',
                justifyContent: 'space-between'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(212,160,23,0.15)';
              }}
              onMouseLeave={e => {
                if (!stagePickerOpen) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(212,160,23,0.08)';
                }
              }}
            >
              <span>Change stage</span>
              <span style={{
                fontSize: '10px',
                transition: 'transform 200ms',
                transform: stagePickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'inline-block'
              }}>
                ▼
              </span>
            </button>
            {stagePickerOpen && (
              <div style={{
                marginTop: '8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                padding: '4px 0'
              }}>
                {journeyStages.map(stage => {
                  const isCurrent = stage.stage_key === realActiveBrand?.journey_stage;

                  return (
                    <div
                      key={stage.stage_key}
                      onClick={async () => {
                        if (!isCurrent) {
                          await updateStage(stage.stage_key, 'user_selected');
                          setStagePickerOpen(false);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent
                          ? 'rgba(212,160,23,0.12)'
                          : 'var(--stage-option-bg)',
                        border: isCurrent
                          ? '0.5px solid rgba(212,160,23,0.3)'
                          : '0.5px solid var(--stage-option-border)',
                        transition: 'all 150ms',
                        marginBottom: '4px'
                      }}
                      onMouseEnter={e => {
                        if (!isCurrent) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--stage-option-bg-hover)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isCurrent) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--stage-option-bg)';
                        }
                      }}
                    >
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>
                        {stage.emoji}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: isCurrent ? 600 : 400,
                          color: isCurrent
                            ? '#D4A017'
                            : 'var(--color-text-primary)'
                        }}>
                          {stage.name}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: 'var(--color-text-tertiary)',
                          marginTop: '1px'
                        }}>
                          {stage.description.split('.')[0]}
                        </div>
                      </div>
                      {isCurrent && (
                        <span style={{
                          fontSize: '9px',
                          background: 'rgba(212,160,23,0.2)',
                          color: '#D4A017',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          flexShrink: 0
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{
            height: '0.5px',
            background: 'var(--color-border-tertiary)',
            margin: '12px 0'
          }} />
        </div>

        {/* Memory */}
        <div className="px-4">
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-secondary)',
            marginBottom: '8px'
          }}>
            MEMORY
          </p>
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.6',
            marginBottom: '8px'
          }}>
            {buildMemorySummary(realActiveBrand, activeBrandDNA)}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {activeBrandDNA?.brand_voice && (
              <span style={{
                borderRadius: '20px',
                padding: '2px 8px',
                fontSize: '10px',
                background: 'rgba(212,160,23,0.1)',
                color: '#D4A017',
                border: '0.5px solid rgba(212,160,23,0.2)'
              }}>
                Voice
              </span>
            )}
            {activeBrandDNA?.positioning_statement && (
              <span style={{
                borderRadius: '20px',
                padding: '2px 8px',
                fontSize: '10px',
                background: 'rgba(212,160,23,0.1)',
                color: '#D4A017',
                border: '0.5px solid rgba(212,160,23,0.2)'
              }}>
                Positioning
              </span>
            )}
            {activeBrandDNA?.target_audience && (
              <span style={{
                borderRadius: '20px',
                padding: '2px 8px',
                fontSize: '10px',
                background: 'rgba(212,160,23,0.1)',
                color: '#D4A017',
                border: '0.5px solid rgba(212,160,23,0.2)'
              }}>
                Audience
              </span>
            )}
            {activeBrandDNA?.core_promise && (
              <span style={{
                borderRadius: '20px',
                padding: '2px 8px',
                fontSize: '10px',
                background: 'rgba(212,160,23,0.1)',
                color: '#D4A017',
                border: '0.5px solid rgba(212,160,23,0.2)'
              }}>
                Promise
              </span>
            )}
          </div>
          <div style={{
            height: '0.5px',
            background: 'var(--color-border-tertiary)',
            margin: '12px 0'
          }} />
        </div>

        <div className="px-4">
          <div className="border-t border-border" />
          <div className="flex items-center gap-1.5 mt-3 mb-2">
            <Flag size={11} className="text-muted-foreground" />
            <p className="text-[11px] font-ui uppercase tracking-[0.1em] text-muted-foreground">
              Milestones
            </p>
          </div>
        </div>

        {/* Milestones */}
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
      </div>

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
