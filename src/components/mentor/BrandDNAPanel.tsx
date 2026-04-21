import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';
import { completeSubstage, getStageProgress } from '@/services/brandService';
import { createMilestone } from '@/services/mentorService';
import { SubstageChecklist } from './SubstageChecklist';

interface BrandDNAPanelProps {
  fields: any[];
  highlightField: string | null;
  onEditField?: (fieldKey: string, newValue: string) => void;
  onClearField?: (fieldKey: string) => void;
  customFields?: any[];
  onSaveCustomField?: (fieldKey: string, fieldLabel: string, fieldValue: string) => void;
  conversation?: { id: string } | null;
}

export function BrandDNAPanel({ fields, highlightField, onEditField, onClearField, customFields = [], onSaveCustomField, conversation }: BrandDNAPanelProps) {
  const { activeBrand, journeyStages, currentStageData, updateStage } = useBrand();
  const [allStageFields, setAllStageFields] = useState<Record<string, any[]>>({});
  const [capturedData, setCapturedData] = useState<Record<string, Record<string, string>>>({});
  const [expandedStages, setExpandedStages] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<{ stageKey: string; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showRightStagePicker, setShowRightStagePicker] = useState(false);
  const [stageProgress, setStageProgress] = useState<Record<number, boolean>>({});
  const [progressLoading, setProgressLoading] = useState(true);
  const [stageDataLoading, setStageDataLoading] = useState(true);
  const [showAllDoneWhen, setShowAllDoneWhen] = useState(false);
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

    const currentSubstages = currentStageData?.substages ?? [];
    const completedCount = Object.values(stageProgress).filter(Boolean).length;
    const incompleteCount = currentSubstages.length - completedCount;

    if (incompleteCount > 0) {
      const incompleteSubstages = currentSubstages.filter(
        (_: string, index: number) => !stageProgress[index]
      );
      setStageChangeWarning({
        targetStageKey: newStageKey,
        incompleteSubstages,
        incompleteCount
      });
      setShowRightStagePicker(false);
      return;
    }

    await updateStage(newStageKey, 'user_selected');
    setShowRightStagePicker(false);
  };

  // Load substage completion for the active stage
  useEffect(() => {
    const stageKey = activeBrand?.journey_stage ?? 'spark';
    if (!activeBrand?.id) {
      setStageProgress({});
      setProgressLoading(false);
      return;
    }
    let cancelled = false;
    setProgressLoading(true);
    getStageProgress(activeBrand.id, stageKey).then(rows => {
      if (cancelled) return;
      const map: Record<number, boolean> = {};
      rows.forEach(r => {
        if (r.isCompleted) map[r.substageIndex] = true;
      });
      setStageProgress(map);
      setProgressLoading(false);
    }).catch(() => {
      if (!cancelled) setProgressLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeBrand?.id, activeBrand?.journey_stage]);

  const handleSubstageComplete = async (
    substageIndex: number,
    substageName: string,
    stageKey: string
  ) => {
    if (!activeBrand || !conversation || stageProgress[substageIndex]) return;

    // Mark substage complete in brand_stage_progress
    await completeSubstage(
      activeBrand.id,
      stageKey,
      substageIndex
    );

    // Update local progress state immediately
    setStageProgress(prev => ({ ...prev, [substageIndex]: true }));

    // Map stage key to milestone category
    const stageCategoryMap: Record<string, string> = {
      spark: 'brand_discovery',
      shape: 'product_positioning',
      validate: 'customer_insight',
      brand: 'brand_discovery',
      launch: 'campaign_strategy',
      grow: 'growth_brainstorm'
    };

    const category = stageCategoryMap[stageKey] ?? 'free_form';

    // Auto-create milestone from substage completion
    await createMilestone(
      activeBrand.id,
      conversation.id,
      substageName,
      category,
      undefined, // no specific message_id for substage milestones
      stageKey // passed as context = stage_key
    );
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

  useEffect(() => {
    if (!activeBrand) {
      setStageDataLoading(false);
      return;
    }

    let cancelled = false;
    setStageDataLoading(true);

    Promise.all([
      (async () => {
        const { data } = await (supabase as any)
          .from('journey_stage_fields')
          .select('*')
          .order('sort_order');
        const grouped: Record<string, any[]> = {};
        (data ?? []).forEach((field: any) => {
          if (!grouped[field.stage_key]) grouped[field.stage_key] = [];
          grouped[field.stage_key].push(field);
        });
        return grouped;
      })(),
      (async () => {
        const { data } = await (supabase as any)
          .from('brand_stage_data')
          .select('*')
          .eq('brand_id', activeBrand.id);
        const structured: Record<string, Record<string, string>> = {};
        (data ?? []).forEach((row: any) => {
          if (!structured[row.stage_key]) structured[row.stage_key] = {};
          if (row.value) structured[row.stage_key][row.field_key] = row.value;
        });
        return structured;
      })()
    ]).then(([fields, data]) => {
      if (cancelled) return;
      setAllStageFields(fields);
      setCapturedData(data);
      setStageDataLoading(false);
    }).catch(() => {
      if (!cancelled) setStageDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeBrand?.id]);

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
        <p className="text-[12px] font-ui text-muted-foreground mt-0.5">Your founder journey, captured as you go.</p>
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
                  border: isCurrent ? '0.5px solid rgba(212,160,23,0.25)' : '0.5px solid transparent'
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
              Skip anyway and move to {journeyStages.find(s => s.stage_key === stageChangeWarning.targetStageKey)?.name}
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
            const stageIndex = index;

            // Future stage — locked
            if (isFuture) {
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

            // Active stage — full card treatment
            if (isActive) {
              return (
                <div key={stage.stage_key} style={{
                  margin: '0 0 2px',
                  background: 'linear-gradient(135deg, rgba(212,160,23,0.06) 0%, rgba(212,160,23,0.02) 100%)',
                  borderLeft: '2px solid #D4A017',
                }}>
                  {/* Stage header — clickable to toggle */}
                  <div
                    onClick={() => toggleStageExpand(stage.stage_key)}
                    style={{ padding: '14px 16px 10px', cursor: 'pointer' }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '6px'
                    }}>
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
                            Stage {stageIndex + 1} of {journeyStages.length}
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
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--color-text-tertiary)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease',
                        display: 'inline-block',
                        marginLeft: '8px'
                      }}>
                        ▼
                      </span>
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

                    {/* Stage completion hint — compact 2-line teaser */}
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
                        {(showAllDoneWhen ? stage.substages : stage.substages.slice(0, 2)).map((sub: string, i: number) => (
                          <div key={i} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                            marginBottom: '2px'
                          }}>
                            <span style={{
                              color: stageProgress[i] ? '#4CAF50' : 'rgba(212,160,23,0.5)',
                              flexShrink: 0,
                              marginTop: '1px'
                            }}>
                              {stageProgress[i] ? '✓' : '○'}
                            </span>
                            <span>{sub}</span>
                          </div>
                        ))}
                        {stage.substages.length > 2 && (
                          <button
                            onClick={() => setShowAllDoneWhen(v => !v)}
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
                            {showAllDoneWhen ? 'Show less' : `See all (${stage.substages.length})`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Substage checklist — interactive */}
                    <SubstageChecklist
                      substages={stage.substages ?? []}
                      progress={stageProgress}
                      onComplete={(idx, substage) =>
                        handleSubstageComplete(idx, substage, stage.stage_key)
                      }
                    />

                    {/* Divider before field list */}
                    <div style={{
                      height: '0.5px',
                      background: 'var(--color-border-tertiary)',
                      margin: '4px 0 4px'
                    }} />
                    </>)}
                  </div>

                  {/* Fields */}
                  {isExpanded && (
                  <div style={{ padding: '0 16px 14px' }}>
                    {fields.map(field => {
                      const value = data[field.field_key];
                      const isEditing = editingField?.stageKey === stage.stage_key && 
                                        editingField?.fieldKey === field.field_key;
                      const isSaving = savingField === `${stage.stage_key}.${field.field_key}`;

                      return (
                        <div key={field.field_key} style={{
                          marginBottom: '10px',
                          padding: '10px 12px',
                          background: value 
                            ? 'var(--color-card-secondary)' 
                            : 'var(--color-background-secondary)',
                          borderRadius: '8px',
                          border: `0.5px solid ${value 
                            ? 'rgba(212,160,23,0.2)' 
                            : 'var(--color-border-tertiary)'}`,
                          transition: 'border-color 200ms'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: value ? '6px' : '4px'
                          }}>
                            <span style={{
                              fontSize: '10px',
                              letterSpacing: '0.07em',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                              color: value ? '#D4A017' : 'var(--color-text-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {value && <span style={{ fontSize: '8px' }}>✓</span>}
                              {field.field_label}
                            </span>
                            {value && !isEditing && (
                              <button
                                onClick={() => {
                                  setEditingField({ 
                                    stageKey: stage.stage_key, 
                                    fieldKey: field.field_key 
                                  });
                                  setEditValue(value);
                                }}
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--color-text-tertiary)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0',
                                  textDecoration: 'underline'
                                }}
                              >
                                edit
                              </button>
                            )}
                          </div>

                          {isEditing ? (
                            <div>
                              <textarea
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                style={{
                                  width: '100%',
                                  minHeight: '70px',
                                  padding: '7px 9px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  border: '0.5px solid #D4A017',
                                  background: 'var(--color-background-secondary)',
                                  color: 'var(--color-text-primary)',
                                  resize: 'vertical',
                                  lineHeight: 1.5,
                                  outline: 'none'
                                }}
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                <button
                                  disabled={isSaving}
                                  onClick={async () => {
                                    if (!activeBrand) return;
                                    const key = `${stage.stage_key}.${field.field_key}`;
                                    setSavingField(key);
                                    await (supabase as any)
                                      .from('brand_stage_data')
                                      .upsert({
                                        brand_id: activeBrand.id,
                                        stage_key: stage.stage_key,
                                        field_key: field.field_key,
                                        value: editValue,
                                        updated_at: new Date().toISOString()
                                      }, { onConflict: 'brand_id,stage_key,field_key' });
                                    setCapturedData(prev => ({
                                      ...prev,
                                      [stage.stage_key]: {
                                        ...prev[stage.stage_key],
                                        [field.field_key]: editValue
                                      }
                                    }));
                                    setSavingField(null);
                                    setEditingField(null);
                                  }}
                                  style={{
                                    fontSize: '11px',
                                    padding: '4px 12px',
                                    background: '#D4A017',
                                    color: '#0D1B2A',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    opacity: isSaving ? 0.7 : 1,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {isSaving && (
                                    <span style={{
                                      width: '8px',
                                      height: '8px',
                                      border: '1.5px solid currentColor',
                                      borderTopColor: 'transparent',
                                      borderRadius: '50%',
                                      display: 'inline-block',
                                      animation: 'spin 0.6s linear infinite'
                                    }} />
                                  )}
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingField(null)}
                                  style={{
                                    fontSize: '11px',
                                    padding: '4px 10px',
                                    background: 'transparent',
                                    border: '0.5px solid var(--color-border-secondary)',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-secondary)'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : value ? (
                            <p style={{
                              fontSize: '12px',
                              color: 'var(--color-text-primary)',
                              lineHeight: 1.6,
                              margin: 0
                            }}>
                              {value.length > 140 
                                ? value.slice(0, 140) + '...' 
                                : value}
                            </p>
                          ) : (
                            <p style={{
                              fontSize: '11px',
                              color: 'var(--color-text-tertiary)',
                              fontStyle: 'italic',
                              margin: 0,
                              lineHeight: 1.5
                            }}>
                              {field.field_description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            }

            // Past stage — compact completed row
            return (
              <div
                key={stage.stage_key}
                onClick={() => {
                  setExpandedStages(prev =>
                    prev.includes(stage.stage_key)
                      ? prev.filter(s => s !== stage.stage_key)
                      : [...prev, stage.stage_key]
                  );
                }}
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
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
                    marginBottom: '2px'
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
                  transition: 'transform 200ms'
                }}>
                  ▼
                </span>
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
            {currentStageInfo.suggested_next_steps.map((step) => (
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
