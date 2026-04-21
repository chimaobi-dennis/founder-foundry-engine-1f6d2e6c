import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';

interface BrandDNAPanelProps {
  fields: any[];
  highlightField: string | null;
  onEditField?: (fieldKey: string, newValue: string) => void;
  onClearField?: (fieldKey: string) => void;
  customFields?: any[];
  onSaveCustomField?: (fieldKey: string, fieldLabel: string, fieldValue: string) => void;
}

export function BrandDNAPanel({ fields, highlightField, onEditField, onClearField, customFields = [], onSaveCustomField }: BrandDNAPanelProps) {
  const { activeBrand, journeyStages, currentStageData } = useBrand();
  const [allStageFields, setAllStageFields] = useState<Record<string, any[]>>({});
  const [capturedData, setCapturedData] = useState<Record<string, Record<string, string>>>({});
  const [expandedStages, setExpandedStages] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<{ stageKey: string; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);

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
    if (!activeBrand) return;

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
      setAllStageFields(fields);
      setCapturedData(data);
    });
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

      <ScrollArea className="flex-1 min-h-0">
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
                  {/* Stage header */}
                  <div style={{ padding: '14px 16px 10px' }}>
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
                    </div>

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

                    {/* Stage completion hint */}
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(212,160,23,0.06)',
                      borderRadius: '6px',
                      border: '0.5px solid var(--stage-done-border)',
                      marginBottom: '4px'
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
                        {stage.substages.slice(0, 3).map((sub: string, i: number) => (
                          <div key={i} style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start',
                            gap: '6px',
                            marginBottom: '2px'
                          }}>
                            <span style={{ 
                              color: data[fields[i]?.field_key] ? '#4CAF50' : 'rgba(212,160,23,0.5)',
                              flexShrink: 0,
                              marginTop: '1px'
                            }}>
                              {data[fields[i]?.field_key] ? '✓' : '○'}
                            </span>
                            <span>{sub}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Fields */}
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
                                    border: '0.5px solid rgba(255,255,255,0.1)',
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
                              color: 'rgba(255,255,255,0.25)',
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
                  borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                  background: 'transparent',
                  transition: 'background 150ms'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
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
                          : 'rgba(255,255,255,0.1)'
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
