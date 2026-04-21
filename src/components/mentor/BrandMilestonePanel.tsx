import { Flag, Plus, ChevronDown, MoreHorizontal, Pencil, Trash2, Check, X, Code, Upload, Pin, Folder } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  ProjectAsset,
  getProjectAssets,
  uploadProjectFile,
  togglePinAsset,
  deleteProjectAsset,
} from "@/services/projectAssetsService";

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
  const { brands: realBrands, journeyStages, currentStageData } = useBrand();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [stageProgress, setStageProgress] = useState<Record<number, boolean>>({});
  // Project Assets state
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load substage completion state whenever brand/stage changes
  useEffect(() => {
    const stageKey = realActiveBrand?.journey_stage ?? 'spark';
    if (!realActiveBrand?.id) {
      setStageProgress({});
      return;
    }
    let cancelled = false;
    getStageProgress(realActiveBrand.id, stageKey).then(rows => {
      if (cancelled) return;
      const map: Record<number, boolean> = {};
      rows.forEach(r => {
        if (r.isCompleted) map[r.substageIndex] = true;
      });
      setStageProgress(map);
    });
    return () => { cancelled = true; };
  }, [realActiveBrand?.id, realActiveBrand?.journey_stage]);

  // Load project assets whenever brand changes
  useEffect(() => {
    if (!realActiveBrand?.id) {
      setProjectAssets([]);
      return;
    }
    let cancelled = false;
    getProjectAssets(realActiveBrand.id).then(assets => {
      if (!cancelled) setProjectAssets(assets);
    });
    return () => { cancelled = true; };
  }, [realActiveBrand?.id]);

  const refreshAssets = async () => {
    if (!realActiveBrand?.id) return;
    const assets = await getProjectAssets(realActiveBrand.id);
    setProjectAssets(assets);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user || !realActiveBrand) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadProjectFile(
          user.id,
          realActiveBrand.id,
          file,
          realActiveBrand.journey_stage ?? undefined
        );
      }
      await refreshAssets();
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePin = async (asset: ProjectAsset) => {
    await togglePinAsset(asset.id, !asset.is_pinned);
    await refreshAssets();
  };

  const handleDeleteAsset = async (asset: ProjectAsset) => {
    await deleteProjectAsset(asset.id, asset.storage_path ?? undefined);
    await refreshAssets();
  };

  const getAssetIcon = (asset: ProjectAsset): string => {
    if (asset.source === 'ai_generated') return '✦';
    switch (asset.file_type) {
      case 'document': return '📄';
      case 'image': return '🖼';
      case 'pdf': return '📋';
      case 'spreadsheet': return '📊';
      case 'presentation': return '📑';
      default: return '📎';
    }
  };

  const formatStageName = (stageKey: string | null): string => {
    if (!stageKey) return '';
    const s = journeyStages.find(js => js.stage_key === stageKey);
    return s?.name ?? (stageKey.charAt(0).toUpperCase() + stageKey.slice(1));
  };

  const formatSourceLabel = (asset: ProjectAsset): string => {
    const source = asset.source === 'ai_generated' ? 'AI generated' : 'Uploaded';
    const stage = formatStageName(asset.stage_key);
    return stage ? `${source} · ${stage}` : source;
  };


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
            {/* Substage checklist */}
            <div style={{
              margin: '10px 0 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {stageInfo.substages?.map((substage: string, index: number) => {
                const isCompleted = stageProgress[index] === true;
                const isNext = !isCompleted &&
                  Object.values(stageProgress).filter(Boolean).length === index;

                return (
                  <div
                    key={index}
                    onClick={async () => {
                      if (!realActiveBrand || isCompleted) return;
                      await completeSubstage(
                        realActiveBrand.id,
                        realActiveBrand.journey_stage ?? 'spark',
                        index
                      );
                      setStageProgress(prev => ({ ...prev, [index]: true }));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      cursor: isCompleted ? 'default' : 'pointer',
                      background: isNext
                        ? 'rgba(212,160,23,0.06)'
                        : 'transparent',
                      border: isNext
                        ? '0.5px solid rgba(212,160,23,0.15)'
                        : '0.5px solid transparent',
                      transition: 'all 150ms'
                    }}
                    onMouseEnter={e => {
                      if (!isCompleted) {
                        (e.currentTarget as HTMLElement).style.background =
                          'rgba(212,160,23,0.08)';
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background =
                        isNext ? 'rgba(212,160,23,0.06)' : 'transparent';
                    }}
                  >
                    {/* Checkbox circle */}
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      marginTop: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isCompleted
                        ? '#4CAF50'
                        : 'transparent',
                      border: isCompleted
                        ? '2px solid #4CAF50'
                        : isNext
                          ? '2px solid #D4A017'
                          : '1.5px solid var(--color-border-secondary)',
                      transition: 'all 200ms'
                    }}>
                      {isCompleted && (
                        <span style={{
                          fontSize: '9px',
                          color: 'white',
                          fontWeight: 700,
                          lineHeight: 1
                        }}>
                          ✓
                        </span>
                      )}
                      {!isCompleted && isNext && (
                        <div style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: '#D4A017'
                        }} />
                      )}
                    </div>

                    {/* Substage text */}
                    <span style={{
                      fontSize: '11px',
                      lineHeight: 1.4,
                      color: isCompleted
                        ? 'var(--color-text-tertiary)'
                        : isNext
                          ? 'var(--color-text-primary)'
                          : 'var(--color-text-secondary)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      fontWeight: isNext ? 500 : 400,
                      flex: 1
                    }}>
                      {substage}
                    </span>

                    {/* "next" badge */}
                    {isNext && (
                      <span style={{
                        fontSize: '9px',
                        color: '#D4A017',
                        background: 'rgba(212,160,23,0.12)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 600,
                        letterSpacing: '0.03em',
                        flexShrink: 0,
                        alignSelf: 'center'
                      }}>
                        next
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress summary below the list */}
            {stageInfo.substages && stageInfo.substages.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 8px',
                marginBottom: '12px'
              }}>
                <div style={{
                  flex: 1,
                  height: '2px',
                  background: 'var(--color-border-tertiary)',
                  borderRadius: '1px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(Object.values(stageProgress).filter(Boolean).length /
                      stageInfo.substages.length) * 100}%`,
                    background: 'linear-gradient(90deg, #D4A017, #E8C060)',
                    borderRadius: '1px',
                    transition: 'width 400ms ease'
                  }} />
                </div>
                <span style={{
                  fontSize: '10px',
                  color: 'var(--color-text-tertiary)',
                  flexShrink: 0
                }}>
                  {Object.values(stageProgress).filter(Boolean).length}/
                  {stageInfo.substages.length}
                </span>
              </div>
            )}
          </div>
          <div style={{
            height: '0.5px',
            background: 'var(--color-border-tertiary)',
            margin: '12px 0'
          }} />
        </div>

        {/* Project Assets */}
        <div className="px-4">
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-text-secondary)',
            marginBottom: '8px'
          }}>
            PROJECT ASSETS
          </p>

          {/* Upload zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              handleFileUpload(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: '1.5px dashed rgba(212,160,23,0.3)',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              marginBottom: '10px',
              transition: 'border-color 150ms',
              opacity: uploading ? 0.7 : 1
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,160,23,0.5)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,160,23,0.3)';
            }}
          >
            <Upload size={18} style={{ color: '#D4A017', margin: '0 auto 4px' }} />
            <div style={{ fontSize: '12px', color: '#D4A017', fontWeight: 500 }}>
              {uploading ? 'Uploading...' : 'Upload files'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              Docs, images, PDFs
            </div>
          </div>

          {/* Assets list */}
          {projectAssets.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '12px 8px',
              marginBottom: '8px'
            }}>
              <Folder size={28} style={{ color: 'var(--color-text-tertiary)', margin: '0 auto 6px', opacity: 0.6 }} />
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                No files yet
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
                Upload research, briefs, or product images for your AI mentor to reference.
              </div>
            </div>
          ) : (
            <div>
              {(showAllAssets ? projectAssets : projectAssets.slice(0, 5)).map(asset => (
                <div
                  key={asset.id}
                  className="group"
                  style={{
                    padding: '6px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 150ms'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0, color: asset.source === 'ai_generated' ? '#D4A017' : undefined }}>
                    {getAssetIcon(asset)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {asset.name}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--color-text-tertiary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {formatSourceLabel(asset)}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleTogglePin(asset); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                    aria-label={asset.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin
                      size={14}
                      style={{
                        color: asset.is_pinned ? '#D4A017' : 'var(--color-text-tertiary)',
                        fill: asset.is_pinned ? '#D4A017' : 'none'
                      }}
                    />
                  </button>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ flexShrink: 0 }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <MoreHorizontal size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[120px]">
                        {asset.file_url && (
                          <DropdownMenuItem
                            onClick={() => window.open(asset.file_url!, '_blank')}
                            className="text-[12px]"
                          >
                            View
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleteAssetId(asset.id)}
                          className="text-[12px] text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {projectAssets.length > 5 && (
                <button
                  onClick={() => setShowAllAssets(!showAllAssets)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#D4A017',
                    fontSize: '11px',
                    padding: '6px 4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  {showAllAssets ? 'Show less' : `Show all (${projectAssets.length})`}
                </button>
              )}
            </div>
          )}

          <div style={{
            height: '0.5px',
            background: 'var(--color-border-tertiary)',
            margin: '12px 0'
          }} />
        </div>


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

      <AlertDialog open={!!deleteAssetId} onOpenChange={(open) => !open && setDeleteAssetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-ui text-[15px]">Delete file?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              This will permanently remove the file from your project assets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[13px]"
              onClick={() => {
                const asset = projectAssets.find(a => a.id === deleteAssetId);
                if (asset) handleDeleteAsset(asset);
                setDeleteAssetId(null);
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
