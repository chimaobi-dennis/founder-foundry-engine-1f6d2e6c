import { useState, useEffect, useRef } from "react";
import { ArrowRight, MoreHorizontal, MessageSquare, Eraser } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrand } from '@/contexts/BrandContext';
import {
  getSubstagesWithData,
  type SubstageWithData,
  getAllStageFields,
  getBrandStageData
} from '@/services/journeyDataService';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Inline expandable captured value. Each instance manages its own
// expanded/collapsed state. Below 80 chars renders the value as-is.
function CapturedValue({ value, style }: { value: string; style?: React.CSSProperties }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 80;
  const needsToggle = value.length > LIMIT;

  if (!needsToggle) {
    return <div style={style}>{value}</div>;
  }

  const shown = expanded ? value : value.slice(0, LIMIT).trimEnd();
  return (
    <div style={style}>
      {shown}
      {!expanded && '...'}{' '}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: '#D4A017',
          cursor: 'pointer',
          font: 'inherit',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
        }}
      >
        {expanded ? 'See less' : 'See more'}
      </button>
    </div>
  );
}

interface BrandDNAPanelProps {
  fields: any[];
  highlightField: string | null;
  onEditField?: (fieldKey: string, newValue: string) => void;
  onClearField?: (fieldKey: string) => void;
  customFields?: any[];
  onSaveCustomField?: (fieldKey: string, fieldLabel: string, fieldValue: string) => void;
  conversation?: { id: string } | null;
  /** Bumped by the parent after any save so the substage panel re-fetches */
  dataRefreshTrigger?: number;
  /** Wipe a captured substage value and reset its row to uncaptured */
  onClearSubstage?: (stageKey: string, fieldKey: string, fieldLabel: string) => void;
  /** Inject a redefine prompt into the chat for the given substage */
  onRedefineSubstage?: (
    stageKey: string,
    fieldKey: string,
    fieldLabel: string,
    currentValue: string
  ) => void;
}

export function BrandDNAPanel({
  fields,
  highlightField,
  onEditField,
  onClearField,
  customFields = [],
  onSaveCustomField,
  conversation,
  dataRefreshTrigger = 0,
  onClearSubstage,
  onRedefineSubstage
}: BrandDNAPanelProps) {
  const { activeBrand, journeyStages, currentStageData, updateStage } = useBrand();
  const [allStageFields, setAllStageFields] = useState<Record<string, any[]>>({});
  const [capturedData, setCapturedData] = useState<Record<string, Record<string, string>>>({});
  const [expandedStages, setExpandedStages] = useState<string[]>([]);
  const [showRightStagePicker, setShowRightStagePicker] = useState(false);
  const [substagesWithData, setSubstagesWithData] = useState<SubstageWithData[]>([]);
  const [substagesLoading, setSubstagesLoading] = useState(true);
  const [stageDataLoading, setStageDataLoading] = useState(true);
  const [showAllDoneWhen, setShowAllDoneWhen] = useState(false);
  // Substages currently being redefined with the mentor.
  // Key format: `${stageKey}::${fieldKey}` → original value at the time
  // the user clicked Redefine. When the captured value changes from this
  // snapshot (i.e. the AI saved a new SAVE_PROMPT), we exit refining state.
  const refiningSnapshotsRef = useRef<Map<string, string>>(new Map());
  const [refiningKeys, setRefiningKeys] = useState<Set<string>>(new Set());
  const [stageChangeWarning, setStageChangeWarning] = useState<{
    targetStageKey: string;
    incompleteSubstages: string[];
    incompleteCount: number;
  } | null>(null);


  const toggleStageExpand = (stageKey: string) => {
    setExpandedStages(prev =>
      prev.includes(stageKey)
        ? prev.filter(s => s !== stageKey)
        : [...prev, stageKey]
    );
  };

  const handleStageChange = async (newStageKey: string) => {
    if (newStageKey === activeBrand?.journey_stage) return;

    const incompleteSubstages = substagesWithData.filter(s => !s.isComplete);
    const incompleteCount = incompleteSubstages.length;

    if (incompleteCount > 0) {
      setStageChangeWarning({
        targetStageKey: newStageKey,
        incompleteSubstages: incompleteSubstages.map(s => s.label),
        incompleteCount
      });
      setShowRightStagePicker(false);
      return;
    }

    await updateStage(newStageKey, 'user_selected');
    setShowRightStagePicker(false);
  };

  // Load substages with their captured data for the active stage.
  // Re-runs whenever the parent bumps dataRefreshTrigger (after a save).
  useEffect(() => {
    if (!activeBrand?.id || !currentStageData) {
      setSubstagesWithData([]);
      setSubstagesLoading(false);
      return;
    }

    let cancelled = false;
    setSubstagesLoading(true);

    getSubstagesWithData(
      activeBrand.id,
      activeBrand.journey_stage ?? 'spark',
      currentStageData.substages ?? []
    )
      .then(rows => {
        if (cancelled) return;
        setSubstagesWithData(rows);
        setSubstagesLoading(false);
      })
      .catch(() => {
        if (!cancelled) setSubstagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeBrand?.id,
    activeBrand?.journey_stage,
    currentStageData,
    dataRefreshTrigger
  ]);

  // Clear "refining" state for any substage whose captured value has changed
  // since the user clicked Redefine — i.e. the AI saved a new SAVE_PROMPT
  // for that field_key. Restores the green check automatically.
  const stageKeyForActive = activeBrand?.journey_stage ?? 'spark';
  useEffect(() => {
    if (refiningKeys.size === 0) return;
    const next = new Set(refiningKeys);
    let changed = false;
    refiningKeys.forEach(key => {
      const [, fieldKey] = key.split('::');
      const sub = substagesWithData.find(s => s.fieldKey === fieldKey);
      const snapshot = refiningSnapshotsRef.current.get(key);
      if (sub?.value && sub.value !== snapshot) {
        next.delete(key);
        refiningSnapshotsRef.current.delete(key);
        changed = true;
      }
    });
    if (changed) setRefiningKeys(next);
  }, [substagesWithData, refiningKeys]);

  const triggerRedefine = (sub: SubstageWithData) => {
    if (!sub.fieldKey || !sub.value) return;
    const key = `${stageKeyForActive}::${sub.fieldKey}`;
    refiningSnapshotsRef.current.set(key, sub.value);
    setRefiningKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    onRedefineSubstage?.(stageKeyForActive, sub.fieldKey, sub.label, sub.value);
  };

  const triggerClear = (sub: SubstageWithData) => {
    if (!sub.fieldKey) return;
    onClearSubstage?.(stageKeyForActive, sub.fieldKey, sub.label);
  };

  const currentStageInfo = currentStageData ?? {
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

  // Load full stage field map + captured data once per brand (and on refresh)
  useEffect(() => {
    if (!activeBrand) {
      setStageDataLoading(false);
      return;
    }

    let cancelled = false;
    setStageDataLoading(true);

    Promise.all([getAllStageFields(), getBrandStageData(activeBrand.id)])
      .then(([fields, data]) => {
        if (cancelled) return;
        setAllStageFields(fields);
        setCapturedData(data);
        setStageDataLoading(false);
      })
      .catch(() => {
        if (!cancelled) setStageDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeBrand?.id, dataRefreshTrigger]);

  // Auto-expand current stage
  useEffect(() => {
    if (currentStageData?.stage_key) {
      setExpandedStages([currentStageData.stage_key]);
    }
  }, [currentStageData?.stage_key]);

  const calculateStageCompletion = (stageKey: string) => {
    const fields = allStageFields[stageKey] ?? [];
    if (fields.length === 0) return 0;
    const data = capturedData[stageKey] ?? {};
    const filledCount = fields.filter(f => data[f.field_key]).length;
    return Math.round((filledCount / fields.length) * 100);
  };

  const stageIndex = journeyStages.findIndex(s => s.stage_key === activeBrand?.journey_stage);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base text-foreground">Journey Record</h2>
          <span className="text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
            Active
          </span>
        </div>
        <p className="text-[12px] font-ui text-muted-foreground mt-0.5">
          Your founder journey, captured as you go.
        </p>
      </div>

      {/* Stage switcher row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        marginBottom: '4px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '14px' }}>{currentStageData?.emoji}</span>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {currentStageData?.name}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
            Stage {stageIndex + 1} of {journeyStages.length}
          </span>
        </div>
        <button
          onClick={() => setShowRightStagePicker(!showRightStagePicker)}
          style={{
            fontSize: '11px',
            color: '#D4A017',
            background: 'rgba(212,160,23,0.08)',
            border: '0.5px solid rgba(212,160,23,0.25)',
            borderRadius: '5px',
            padding: '3px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0
          }}
        >
          Change
          <span style={{
            fontSize: '8px',
            transform: showRightStagePicker ? 'rotate(180deg)' : 'rotate(0)',
            display: 'inline-block',
            transition: 'transform 150ms'
          }}>▼</span>
        </button>
      </div>

      {/* Stage picker dropdown */}
      {showRightStagePicker && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          flexShrink: 0
        }}>
          {journeyStages.map(stage => {
            const isCurrent = stage.stage_key === activeBrand?.journey_stage;
            return (
              <div
                key={stage.stage_key}
                onClick={async () => {
                  if (isCurrent) return;
                  await handleStageChange(stage.stage_key);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'rgba(212,160,23,0.1)' : 'transparent',
                  border: isCurrent
                    ? '0.5px solid rgba(212,160,23,0.25)'
                    : '0.5px solid transparent'
                }}
              >
                <span style={{ fontSize: '13px' }}>{stage.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? '#D4A017' : 'var(--color-text-primary)'
                  }}>
                    {stage.name}
                  </div>
                </div>
                {isCurrent && (
                  <span style={{ fontSize: '8px', color: '#D4A017' }}>●</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Incomplete substage warning */}
      {stageChangeWarning && (
        <div style={{
          margin: '8px 12px',
          padding: '14px',
          background: 'rgba(212,160,23,0.06)',
          border: '1px solid rgba(212,160,23,0.25)',
          borderRadius: '10px',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '10px'
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: '4px'
              }}>
                You have not finished this stage yet
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5
              }}>
                Skipping these steps might affect the quality of your project output later.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '10px',
              color: '#D4A017',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              Still to complete:
            </div>
            {stageChangeWarning.incompleteSubstages.map((sub: string, i: number) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '3px'
              }}>
                <div style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'rgba(212,160,23,0.5)',
                  flexShrink: 0
                }} />
                <span style={{
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)'
                }}>
                  {sub}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => {
                setStageChangeWarning(null);
                setShowRightStagePicker(false);
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: 'transparent',
                border: '0.5px solid rgba(212,160,23,0.4)',
                borderRadius: '7px',
                fontSize: '12px',
                color: '#D4A017',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              ← Stay and complete this stage
            </button>
            <button
              onClick={async () => {
                await updateStage(stageChangeWarning.targetStageKey, 'user_selected');
                setStageChangeWarning(null);
                setShowRightStagePicker(false);
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: '7px',
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer'
              }}
            >
              Skip anyway and move to{' '}
              {journeyStages.find(s => s.stage_key === stageChangeWarning.targetStageKey)?.name}
            </button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0 journey-record-scroll">
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {journeyStages.map((stage, index) => {
            const isActive = stage.stage_key === activeBrand?.journey_stage;
            const isExpanded = expandedStages.includes(stage.stage_key);
            const isFuture = index > journeyStages.findIndex(
              s => s.stage_key === activeBrand?.journey_stage
            );
            const fields = allStageFields[stage.stage_key] ?? [];
            const data = capturedData[stage.stage_key] ?? {};
            const completion = calculateStageCompletion(stage.stage_key);
            const filledCount = fields.filter(f => data[f.field_key]).length;
            const hasCapturedData = filledCount > 0;
            const stageIndexLocal = index;

            // Future stage with NO captured data — locked
            if (isFuture && !hasCapturedData) {
              return (
                <div key={stage.stage_key} style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  opacity: 0.45,
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  cursor: 'not-allowed'
                }}>
                  <span style={{ fontSize: '14px' }}>{stage.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                      {stage.name}
                    </span>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '1px' }}>
                      Unlocks when you reach this stage
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>🔒</span>
                </div>
              );
            }

            // Active stage — full card treatment.
            // Substages are read-only; completion is derived from brand_stage_data.
            if (isActive) {
              const doneWhenSource = substagesWithData;
              const visibleDoneWhen = showAllDoneWhen
                ? doneWhenSource
                : doneWhenSource.slice(0, 2);

              return (
                <div key={stage.stage_key} style={{
                  margin: '0 0 2px',
                  background: 'linear-gradient(135deg, rgba(212,160,23,0.06) 0%, rgba(212,160,23,0.02) 100%)',
                  borderLeft: '2px solid #D4A017'
                }}>
                  {/* Stage header — clickable to toggle. Only the header row
                      (not the expanded body) carries the toggle handler so
                      clicks inside the expanded content do not collapse the
                      stage. */}
                  <div style={{ padding: '14px 16px 10px' }}>
                    <div
                      onClick={() => toggleStageExpand(stage.stage_key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{stage.emoji}</span>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: 'var(--color-text-primary)'
                            }}>
                              {stage.name}
                            </span>
                            <span style={{
                              fontSize: '9px',
                              background: '#D4A017',
                              color: '#0D1B2A',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              letterSpacing: '0.06em'
                            }}>
                              ACTIVE
                            </span>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            marginTop: '1px'
                          }}>
                            Stage {stageIndexLocal + 1} of {journeyStages.length}
                          </div>
                        </div>
                      </div>
                      {/* Completion ring */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          color: completion === 100 ? '#4CAF50' : 'var(--completion-amber)',
                          lineHeight: 1
                        }}>
                          {completion}%
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: 'var(--color-text-tertiary)'
                        }}>
                          complete
                        </div>
                      </div>
                      {/* Toggle arrow — also a real button so the explicit
                          target always works even if some ancestor swallows
                          the event. */}
                      <button
                        type="button"
                        aria-label={isExpanded ? 'Collapse stage' : 'Expand stage'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageExpand(stage.stage_key);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          marginLeft: '4px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          color: 'var(--color-text-tertiary)',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 200ms ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1
                        }}
                      >
                        ▼
                      </button>
                    </div>

                    {isExpanded && (<>
                      {/* Progress bar */}
                      <div style={{
                        height: '3px',
                        background: 'rgba(212,160,23,0.15)',
                        borderRadius: '2px',
                        marginBottom: '10px'
                      }}>
                        <div style={{
                          width: `${completion}%`,
                          height: '100%',
                          background: completion === 100
                            ? '#4CAF50'
                            : 'linear-gradient(90deg, #D4A017, #E8C060)',
                          borderRadius: '2px',
                          transition: 'width 500ms ease'
                        }} />
                      </div>

                      {/* "This stage is done when we have:" — reflects real captured-data state */}
                      <div style={{
                        padding: '8px 10px',
                        background: 'rgba(212,160,23,0.06)',
                        borderRadius: '6px',
                        border: '0.5px solid var(--stage-done-border)',
                        marginBottom: '10px'
                      }}>
                        <div style={{
                          fontSize: '10px',
                          color: '#D4A017',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          marginBottom: '3px',
                          textTransform: 'uppercase'
                        }}>
                          This stage is done when we have:
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                          lineHeight: 1.5
                        }}>
                          {visibleDoneWhen.map((sub, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '6px',
                              marginBottom: '2px'
                            }}>
                              <span style={{
                                color: sub.isComplete ? '#4CAF50' : 'rgba(212,160,23,0.5)',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>
                                {sub.isComplete ? '✓' : '○'}
                              </span>
                              <span>{sub.label}</span>
                            </div>
                          ))}
                           {doneWhenSource.length > 2 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAllDoneWhen(v => !v);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '2px 0 0',
                                cursor: 'pointer',
                                color: '#D4A017',
                                fontSize: '10px',
                                fontWeight: 600
                              }}
                            >
                              {showAllDoneWhen
                                ? 'Show less'
                                : `See all (${doneWhenSource.length})`}
                            </button>
                          )}
                        </div>
                      </div>
                    </>)}
                  </div>

                  {/* Substage cards — read-only, data-driven.
                      Each substage IS its field. The card shows the label,
                      a prompt-style description when no value exists,
                      or the captured value once data has been saved.        */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 14px' }}>
                      {substagesLoading && substagesWithData.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={`skeleton-${i}`}
                            style={{
                              marginBottom: '10px',
                              padding: '10px 12px',
                              background: 'var(--color-background-secondary)',
                              borderRadius: '8px',
                              border: '0.5px solid var(--color-border-tertiary)'
                            }}
                          >
                            <Skeleton style={{ height: '10px', width: '40%', marginBottom: '8px' }} />
                            <Skeleton style={{ height: '10px', width: '90%', marginBottom: '4px' }} />
                            <Skeleton style={{ height: '10px', width: `${60 + ((i * 11) % 25)}%` }} />
                          </div>
                        ))
                      ) : (
                        substagesWithData.map((substage, idx) => {
                          const isNext = !substage.isComplete &&
                            substagesWithData.slice(0, idx).every(s => s.isComplete);
                          const refKey = substage.fieldKey
                            ? `${stage.stage_key}::${substage.fieldKey}`
                            : null;
                          const isRefining = !!(refKey && refiningKeys.has(refKey));
                          const showActions = substage.isComplete && !!substage.fieldKey;

                          return (
                            <div
                              key={substage.index}
                              className={showActions ? 'group/substage' : undefined}
                              style={{
                                position: 'relative',
                                marginBottom: '10px',
                                padding: '10px 12px',
                                background: substage.isComplete
                                  ? 'var(--color-card-secondary)'
                                  : isNext
                                    ? 'rgba(212,160,23,0.06)'
                                    : 'var(--color-background-secondary)',
                                borderRadius: '8px',
                                border: `0.5px solid ${
                                  isRefining
                                    ? 'rgba(212,160,23,0.45)'
                                    : substage.isComplete
                                      ? 'rgba(212,160,23,0.2)'
                                      : isNext
                                        ? 'rgba(212,160,23,0.25)'
                                        : 'var(--color-border-tertiary)'
                                }`,
                                transition: 'all 200ms'
                              }}
                            >
                              {/* Substage header row */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px'
                              }}>
                                {/* Status indicator — read-only */}
                                <div
                                  className={isRefining ? 'animate-amber-pulse' : undefined}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    marginTop: '1px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isRefining
                                      ? '#D4A017'
                                      : substage.isComplete
                                        ? '#4CAF50'
                                        : 'transparent',
                                    border: isRefining
                                      ? '2px solid #D4A017'
                                      : substage.isComplete
                                        ? '2px solid #4CAF50'
                                        : isNext
                                          ? '2px solid #D4A017'
                                          : '1.5px solid var(--color-border-secondary)'
                                  }}
                                >
                                  {isRefining ? null : substage.isComplete ? (
                                    <span style={{ fontSize: '9px', color: 'white', fontWeight: 700, lineHeight: 1 }}>
                                      ✓
                                    </span>
                                  ) : isNext ? (
                                    <div style={{
                                      width: '5px',
                                      height: '5px',
                                      borderRadius: '50%',
                                      background: '#D4A017'
                                    }} />
                                  ) : null}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* Substage label */}
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: substage.isComplete ? 500 : isNext ? 600 : 500,
                                    color: substage.isComplete
                                      ? 'var(--color-text-primary)'
                                      : isNext
                                        ? 'var(--color-text-primary)'
                                        : 'var(--color-text-secondary)',
                                    lineHeight: 1.4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flexWrap: 'wrap'
                                  }}>
                                    <span>{substage.label}</span>
                                    {isRefining && (
                                      <span style={{
                                        fontSize: '9px',
                                        color: '#D4A017',
                                        background: 'rgba(212,160,23,0.14)',
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        fontWeight: 600,
                                        letterSpacing: '0.04em'
                                      }}>
                                        Refining…
                                      </span>
                                    )}
                                  </div>

                                  {/* Prompt text when no data is captured */}
                                  {!substage.value && substage.fieldDescription && (
                                    <div style={{
                                      fontSize: '11px',
                                      color: 'var(--color-text-tertiary)',
                                      marginTop: '4px',
                                      lineHeight: 1.5,
                                      fontStyle: isNext ? 'normal' : 'italic'
                                    }}>
                                      {isNext
                                        ? `Tell your mentor: ${substage.fieldDescription}`
                                        : substage.fieldDescription}
                                    </div>
                                  )}
                                </div>

                                {/* "discuss" badge for the next item without data */}
                                {isNext && !substage.value && (
                                  <span style={{
                                    fontSize: '9px',
                                    color: '#D4A017',
                                    background: 'rgba(212,160,23,0.12)',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontWeight: 600,
                                    letterSpacing: '0.04em',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start'
                                  }}>
                                    discuss
                                  </span>
                                )}

                                {/* Hover actions on captured substages */}
                                {showActions && (
                                  <div
                                    className="opacity-0 group-hover/substage:opacity-100 focus-within:opacity-100 transition-opacity"
                                    style={{ flexShrink: 0, alignSelf: 'flex-start' }}
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          aria-label="Substage actions"
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '2px',
                                            borderRadius: '4px',
                                            color: 'var(--color-text-tertiary)',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}
                                        >
                                          <MoreHorizontal size={14} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            triggerRedefine(substage);
                                          }}
                                          className="text-[12px] cursor-pointer"
                                        >
                                          <MessageSquare size={13} className="mr-2 text-primary" />
                                          Redefine with Mentor
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            triggerClear(substage);
                                          }}
                                          className="text-[12px] cursor-pointer text-destructive focus:text-destructive"
                                        >
                                          <Eraser size={13} className="mr-2" />
                                          Clear
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )}
                              </div>

                              {/* Captured data — shown when value exists */}
                              {substage.value && (
                                <div style={{ marginTop: '8px' }}>
                                  <div style={{
                                    fontSize: '9px',
                                    color: isRefining ? '#D4A017' : '#4CAF50',
                                    fontWeight: 600,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    marginBottom: '4px'
                                  }}>
                                    {isRefining ? 'In refinement' : 'Captured'}
                                  </div>
                                  <CapturedValue
                                    value={substage.value}
                                    style={{
                                      fontSize: '12px',
                                      color: 'var(--color-text-primary)',
                                      lineHeight: 1.6,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Non-active stage (past, OR future with captured data) — collapsible row
            return (
              <div
                key={stage.stage_key}
                style={{
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  background: 'transparent'
                }}
              >
                <div
                  onClick={() => toggleStageExpand(stage.stage_key)}
                  style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 150ms'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--stage-option-bg)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>{stage.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '2px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)'
                      }}>
                        {stage.name}
                      </span>
                      {filledCount > 0 && (
                        <span style={{
                          fontSize: '9px',
                          color: '#4CAF50',
                          background: 'rgba(76,175,80,0.1)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 600
                        }}>
                          {filledCount} captured
                        </span>
                      )}
                      {/* Pre-filled badge for future stages that have data from onboarding */}
                      {isFuture && hasCapturedData && (
                        <span style={{
                          fontSize: '9px',
                          color: '#D4A017',
                          background: 'rgba(212,160,23,0.12)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 600,
                          letterSpacing: '0.03em'
                        }}>
                          Pre-filled from onboarding
                        </span>
                      )}
                    </div>
                    {/* Mini progress dots */}
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {fields.map((f: any) => (
                        <div key={f.field_key} style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: data[f.field_key]
                            ? '#4CAF50'
                            : 'var(--color-border-secondary)'
                        }} />
                      ))}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--color-text-tertiary)',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 200ms',
                    pointerEvents: 'none'
                  }}>
                    ▼
                  </span>
                </div>

                {/* Expanded body — list captured fields (read-only) */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 12px' }}>
                    {fields.length === 0 ? (
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--color-text-tertiary)',
                        fontStyle: 'italic',
                        padding: '4px 0'
                      }}>
                        No fields defined for this stage yet.
                      </div>
                    ) : (
                      fields.map((f: any) => {
                        const value = data[f.field_key];
                        const hasValue = !!(value && value.trim().length > 0);
                        return (
                          <div
                            key={f.field_key}
                            style={{
                              marginBottom: '8px',
                              padding: '8px 10px',
                              background: hasValue
                                ? 'var(--color-card-secondary)'
                                : 'var(--color-background-secondary)',
                              borderRadius: '6px',
                              border: `0.5px solid ${
                                hasValue
                                  ? 'rgba(76,175,80,0.2)'
                                  : 'var(--color-border-tertiary)'
                              }`
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: hasValue ? '4px' : 0
                            }}>
                              <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: hasValue ? '#4CAF50' : 'transparent',
                                border: hasValue
                                  ? '2px solid #4CAF50'
                                  : '1.5px solid var(--color-border-secondary)',
                                flexShrink: 0
                              }} />
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: 'var(--color-text-secondary)'
                              }}>
                                {f.field_label}
                              </span>
                            </div>
                            {hasValue && (
                              <CapturedValue
                                value={value}
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--color-text-primary)',
                                  lineHeight: 1.5,
                                  marginLeft: '16px',
                                }}
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Suggested next steps */}
        <div className="px-4 pb-4 pt-3">
          <p className="text-[11px] font-ui uppercase tracking-[0.1em] text-muted-foreground mb-2.5">
            Suggested next steps
          </p>
          <div className="space-y-1">
            {currentStageInfo.suggested_next_steps.map(step => (
              <Link
                key={step.label}
                to={step.route}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-ui text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors group"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#D4A017',
                  textDecoration: 'none',
                  padding: '4px 0',
                  borderBottom: '0.5px solid var(--color-border-tertiary)'
                }}
              >
                <span className="flex-1">{step.label}</span>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
