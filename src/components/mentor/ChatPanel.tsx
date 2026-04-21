import { Send, Paperclip, Mic, Flag, Save, Check, X, Pencil } from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";
import { MentorBrand, Message, InlineSavePrompt, MilestoneMarker, Milestone, MilestoneCategory, categoryTextColors } from "./types";
import { parseAIMessage, type ParsedSavePrompt } from "@/lib/savePromptParser";

export interface ChoicePrompt {
  id: string;
  conversation_id: string;
  message_id: string;
  prompt_type: string;
  question: string;
  options: { label: string; value: string; description?: string }[];
  selected_option: string | null;
  is_answered: boolean;
  dna_field: string | null;
  created_at: string;
}

export interface ThinkingState {
  isThinking: boolean;
  currentMessage: string;
  progress: number;
}

// Milestone prompt state
interface MilestonePromptState {
  messageId: string;
  visible: boolean;
  suggestedName?: string;
}

interface ChatPanelProps {
  brand: MentorBrand;
  stageName?: string;
  messages: Message[];
  milestones: Milestone[];
  milestoneMarkers: MilestoneMarker[];
  savePrompts: InlineSavePrompt[];
  onSaveDNA: (field: string, value: string) => void;
  scrollToMilestoneId: string | null;
  onMilestoneScrolled: () => void;
  isMobile?: boolean;
  isTyping?: boolean;
  onSendMessage?: (text: string) => void;
  error?: string | null;
  onRetry?: () => void;
  slowThinking?: boolean;
  // Unanswered message handling
  unansweredMessageId?: string | null;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  messageRefsMap?: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  // Choice prompts
  activeChoicePrompts?: ChoicePrompt[];
  onChoiceSelect?: (prompt: ChoicePrompt, value: string, label: string) => void;
  // Streaming state
  thinkingState?: ThinkingState;
  streamingMessageId?: string | null;
  streamingText?: string;
  // SAVE_PROMPT pill: write a captured field to brand_stage_data
  onSaveStagePrompt?: (prompt: ParsedSavePrompt, messageId?: string) => Promise<void> | void;
  // Set of `${messageId}::${fieldKey}` keys already accepted (loaded from DB)
  // — drives the persistent "Saved" pill across reloads.
  savedStagePromptKeys?: Set<string>;
}

export function ChatPanel({
  brand,
  stageName,
  messages,
  milestones,
  milestoneMarkers,
  savePrompts,
  onSaveDNA,
  scrollToMilestoneId,
  onMilestoneScrolled,
  isMobile,
  isTyping,
  onSendMessage,
  error,
  onRetry,
  slowThinking,
  unansweredMessageId,
  inputValue: externalInputValue,
  onInputValueChange,
  messageRefsMap,
  activeChoicePrompts = [],
  onChoiceSelect,
  thinkingState = { isThinking: false, currentMessage: '', progress: 0 },
  streamingMessageId = null,
  streamingText = '',
  onSaveStagePrompt,
  savedStagePromptKeys,
}: ChatPanelProps) {
  // Use external input value if provided, otherwise use internal state
  const [internalInputValue, setInternalInputValue] = useState("");
  const inputValue = externalInputValue !== undefined ? externalInputValue : internalInputValue;
  const setInputValue = onInputValueChange || setInternalInputValue;
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [savedPrompts, setSavedPrompts] = useState<Set<string>>(new Set());
  const [showingSaved, setShowingSaved] = useState<Set<string>>(new Set());
  // SAVE_PROMPT pill state — keyed by `${messageId}::${fieldKey}`
  const [stagePromptSaved, setStagePromptSaved] = useState<Set<string>>(new Set());
  const [stagePromptDismissed, setStagePromptDismissed] = useState<Set<string>>(new Set());
  const [stagePromptEditing, setStagePromptEditing] = useState<Record<string, string>>({});
  const [highlightedMilestone, setHighlightedMilestone] = useState<string | null>(null);
  const milestoneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Milestone creation prompt state
  const [milestonePrompt, setMilestonePrompt] = useState<MilestonePromptState | null>(null);
  const [milestoneNameInput, setMilestoneNameInput] = useState("");
  const [milestoneCategoryInput, setMilestoneCategoryInput] = useState<MilestoneCategory>("Brand Discovery");
  const [messagesSinceLastMilestonePrompt, setMessagesSinceLastMilestonePrompt] = useState(0);

  // Helper to determine if response is strategically significant
  const isStrategicallySignificant = (text: string): boolean => {
    const keywords = [
      'positioning', 'brand voice', 'core promise',
      'target audience', 'strategy', 'insight',
      'this is your', 'write that down', 'that is your'
    ];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  };

  const generateMilestoneName = (responseText: string): string => {
    const lower = responseText.toLowerCase();

    if (lower.includes('positioning') || lower.includes('position yourself')) {
      return 'Positioning defined';
    }
    if (lower.includes('target audience') || lower.includes('primary founder') || lower.includes('who exactly')) {
      return 'Target audience explored';
    }
    if (lower.includes('brand voice') || lower.includes('tone') || lower.includes('how you sound')) {
      return 'Brand voice discussed';
    }
    if (lower.includes('core promise') || lower.includes('what you promise')) {
      return 'Core promise identified';
    }
    if (lower.includes('strategy') || lower.includes('campaign')) {
      return 'Strategy session';
    }
    if (lower.includes('brand name') || lower.includes('working title')) {
      return 'Brand naming explored';
    }

    // Extract first meaningful phrase — minimum 10 characters
    const firstWords = responseText
      .replace(/\*\*/g, '')
      .replace(/[^a-zA-Z\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(' ');

    return firstWords.length >= 10 ? firstWords : 'Key insight saved';
  };

  // Handler to trigger milestone prompt after AI message
  const checkForMilestoneOpportunity = (responseText: string, messageId: string) => {
    const meetsLengthThreshold = responseText.length > 500;
    const isSignificant = isStrategicallySignificant(responseText);
    const enoughMessagesSince = messagesSinceLastMilestonePrompt >= 4;

    if (meetsLengthThreshold && isSignificant && enoughMessagesSince) {
      const suggestedName = generateMilestoneName(responseText);
      setMilestonePrompt({
        messageId,
        visible: true,
        suggestedName
      });
      setMilestoneNameInput(suggestedName ?? '');
      setMessagesSinceLastMilestonePrompt(0);
    } else {
      setMessagesSinceLastMilestonePrompt(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (!scrollToMilestoneId) return;
    const el = milestoneRefs.current[scrollToMilestoneId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMilestone(scrollToMilestoneId);
      setTimeout(() => setHighlightedMilestone(null), 1500);
    }
    onMilestoneScrolled();
  }, [scrollToMilestoneId, onMilestoneScrolled]);

  // Auto-scroll to bottom on new messages, typing, streaming, or thinking
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping, streamingText, thinkingState?.isThinking]);

  // Check for milestone opportunities on new AI messages (outside map loop)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "ai") {
      checkForMilestoneOpportunity(lastMsg.content, lastMsg.id);
    }
  }, [messages.length]);

  const handleSave = useCallback((prompt: InlineSavePrompt) => {
    setSavedPrompts(prev => new Set(prev).add(prompt.afterMessageId));
    setShowingSaved(prev => new Set(prev).add(prompt.afterMessageId));
    onSaveDNA(prompt.dnaField, prompt.value);
    setTimeout(() => {
      setShowingSaved(prev => {
        const n = new Set(prev);
        n.delete(prompt.afterMessageId);
        return n;
      });
      setSavedPrompts(prev => {
        const n = new Set(prev);
        n.delete(prompt.afterMessageId);
        return n;
      });
    }, 1200);
  }, [onSaveDNA]);

  const handleDismiss = (afterMessageId: string) => {
    setDismissedPrompts(prev => new Set(prev).add(afterMessageId));
  };

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !onSendMessage) return;
    onSendMessage(trimmed);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const milestoneMap = Object.fromEntries(milestones.map(m => [m.id, m]));
  const markersByMessage = Object.fromEntries(milestoneMarkers.map(mm => [mm.beforeMessageId, mm]));
  const promptsByMessage = Object.fromEntries(savePrompts.map(sp => [sp.afterMessageId, sp]));
  const promptsByMessageId = Object.fromEntries(activeChoicePrompts.map(cp => [cp.message_id, cp]));

  // Deduplicate messages by id — optimistic insertion + DB refetch can lead
  // to the same row appearing twice in `messages`. Keep the first occurrence.
  const dedupedMessages = useMemo(() => {
    const seen = new Set<string>();
    const out: Message[] = [];
    for (const m of messages) {
      if (m.id && seen.has(m.id)) continue;
      if (m.id) seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [messages]);

  // Combined "saved" set: locally accepted in this session + persisted in DB.
  const isStagePromptSaved = useCallback((key: string) => (
    stagePromptSaved.has(key) || (savedStagePromptKeys?.has(key) ?? false)
  ), [stagePromptSaved, savedStagePromptKeys]);

  const ChoicePromptCard = ({ prompt, onSelect }: {
    prompt: ChoicePrompt;
    onSelect: (value: string, label: string) => void;
  }) => (
    <div style={{
      margin: '12px 0 4px',
      padding: '16px',
      background: 'rgba(212,160,23,0.06)',
      border: '1px solid rgba(212,160,23,0.25)',
      borderRadius: '12px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <span style={{ fontSize: '14px' }}>✦</span>
        <span style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-text-primary)'
        }}>
          {prompt.question}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {prompt.options.map((option: any) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value, option.label)}
            style={{
              textAlign: 'left',
              padding: '10px 14px',
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'border-color 150ms'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#D4A017';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '';
            }}
          >
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              marginBottom: option.description ? '2px' : 0
            }}>
              {option.label}
            </div>
            {option.description && (
              <div style={{
                fontSize: '11px',
                color: 'var(--color-text-secondary)'
              }}>
                {option.description}
              </div>
            )}
          </button>
        ))}
      </div>

      {prompt.prompt_type === 'brand_name' && (
        <p style={{
          fontSize: '11px',
          color: 'var(--color-text-tertiary)',
          marginTop: '10px',
          marginBottom: 0
        }}>
          These are tentative suggestions — you can update your brand name anytime.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden max-w-full" style={{ boxSizing: "border-box" }}>
      {/* Brand context bar */}
      <div className="h-10 flex items-center gap-3 px-4 bg-muted/20 border-b border-border flex-shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", brand.colorClass)} />
          <span className="text-[12px] font-ui font-medium text-foreground truncate">{brand.name}</span>
        </div>
        <span className="text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0 whitespace-nowrap">
          {stageName ?? 'Spark'} · Active
        </span>
      </div>

      {/* Chat messages — only scrollable region */}
      <div className={cn("flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden")} ref={scrollAreaRef} style={{ minWidth: 0 }}>
        <div className={cn(
          "px-4 py-6 space-y-1 w-full",
          isMobile && "pb-16"
        )} style={{ maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
          <p className="text-[11px] font-ui text-muted-foreground text-center py-3">Today at 14:23</p>

          {messages.map((msg, i) => {
            const marker = markersByMessage[msg.id];
            const milestone = marker ? milestoneMap[marker.milestoneId] : null;
            const prompt = promptsByMessage[msg.id];
            const isDismissed = dismissedPrompts.has(msg.id);
            const isSaved = savedPrompts.has(msg.id);
            const isShowingSaved = showingSaved.has(msg.id);
            const showTimestamp = i === 8;

            // Parse SAVE_PROMPT blocks out of AI messages so the founder
            // never sees the raw JSON token. The pill is rendered below.
            const parsed = msg.role === "ai"
              ? parseAIMessage(msg.content)
              : { cleanText: msg.content, savePrompts: [] as ParsedSavePrompt[] };

            return (
              <div key={msg.id} className="min-w-0 w-full max-w-full overflow-hidden" style={{ boxSizing: "border-box" }}>
                {/* Milestone marker */}
                {milestone && (
                  <div
                    ref={(el) => { milestoneRefs.current[marker!.milestoneId] = el; }}
                    className={cn(
                      "flex items-center gap-2 md:gap-3 my-5 transition-all duration-500 min-w-0",
                      highlightedMilestone === marker!.milestoneId && "bg-primary/10 -mx-4 px-4 py-2 rounded-lg"
                    )}
                  >
                    <div className="flex-1 h-px bg-border min-w-0" />
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-center">
                      <Flag size={11} className="text-primary" />
                      <span className={cn("text-[11px] md:text-[12px] font-ui font-medium", categoryTextColors[milestone.category] || "text-muted-foreground")}>
                        {milestone.category}
                      </span>
                      <span className="text-[11px] md:text-[12px] font-ui text-muted-foreground">·</span>
                      <span className="text-[11px] md:text-[12px] font-ui text-muted-foreground">{milestone.name}</span>
                      <span className="text-[11px] md:text-[12px] font-ui text-muted-foreground hidden sm:inline">·</span>
                      <span className="text-[11px] md:text-[12px] font-ui text-muted-foreground hidden sm:inline">{milestone.timeAgo}</span>
                    </div>
                    <div className="flex-1 h-px bg-border min-w-0" />
                  </div>
                )}

                {showTimestamp && (
                  <p className="text-[11px] font-ui text-muted-foreground text-center py-4">Today at 14:47</p>
                )}

                {/* Message bubble */}
                <div 
                  ref={(el) => { if (messageRefsMap) messageRefsMap.current[msg.id] = el; }}
                  className={cn("w-full flex flex-col overflow-hidden mb-3", msg.role === "founder" ? "items-end" : "items-start")} 
                  style={{ minWidth: 0, boxSizing: "border-box" }}
                >
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 max-w-[75%] min-w-0 break-words",
                      msg.role === "founder"
                        ? "bg-primary/10"
                        : "bg-card border border-border"
                    )}
                    style={{ overflowWrap: "break-word", wordWrap: "break-word", wordBreak: "break-word", minWidth: 0, flexShrink: 1, boxSizing: "border-box" }}
                  >
                    <p
                      className="text-[13.5px] font-ui text-foreground whitespace-pre-line break-words"
                      style={{ lineHeight: msg.role === "ai" ? "1.7" : "1.6" }}
                    >
                      {parsed.cleanText}
                    </p>
                  </div>

                  {/* SAVE_PROMPT pills parsed from AI message */}
                  {msg.role === "ai" && parsed.savePrompts.map((sp) => {
                    const key = `${msg.id}::${sp.fieldKey}`;
                    const wasSaved = stagePromptSaved.has(key);
                    if (stagePromptDismissed.has(key)) return null;
                    if (wasSaved) {
                      return (
                        <div key={key} className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-primary/10">
                          <Check size={12} className="text-primary" />
                          <span className="text-[11px] font-ui text-primary font-medium">
                            Saved to Journey Record · {sp.label}
                          </span>
                        </div>
                      );
                    }
                    const editingValue = stagePromptEditing[key];
                    const isEditing = editingValue !== undefined;
                    const currentValue = isEditing ? editingValue : sp.value;
                    return (
                      <div
                        key={key}
                        className="w-full flex flex-col gap-2 mt-2 max-w-[75%]"
                        style={{ minWidth: 0, boxSizing: "border-box" }}
                      >
                        <div
                          className="flex flex-col gap-2 px-3 py-2.5 rounded-lg border bg-card/80"
                          style={{
                            borderColor: 'rgba(212,160,23,0.35)',
                            background: 'rgba(212,160,23,0.06)',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Save size={13} className="text-primary flex-shrink-0" />
                            <span className="text-[12px] font-ui font-medium text-foreground flex-1 min-w-0 truncate">
                              {sp.label}
                            </span>
                          </div>
                          {isEditing ? (
                            <textarea
                              value={currentValue}
                              onChange={(e) =>
                                setStagePromptEditing(prev => ({ ...prev, [key]: e.target.value }))
                              }
                              rows={3}
                              className="w-full text-[12.5px] font-ui text-foreground bg-background/60 border border-border rounded-md px-2 py-1.5 outline-none focus:border-primary"
                              style={{ resize: 'vertical' }}
                            />
                          ) : (
                            <p className="text-[12.5px] font-ui text-muted-foreground whitespace-pre-wrap break-words">
                              {currentValue}
                            </p>
                          )}
                          <div className="flex items-center gap-2 justify-end pt-1">
                            <button
                              onClick={() =>
                                setStagePromptDismissed(prev => new Set(prev).add(key))
                              }
                              className="text-[11px] font-ui text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setStagePromptEditing(prev => {
                                    const n = { ...prev };
                                    delete n[key];
                                    return n;
                                  });
                                } else {
                                  setStagePromptEditing(prev => ({ ...prev, [key]: sp.value }));
                                }
                              }}
                              className="h-6 px-2.5 rounded-md border border-border text-[11px] font-ui text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1"
                            >
                              <Pencil size={11} />
                              {isEditing ? 'Cancel' : 'Edit'}
                            </button>
                            <button
                              onClick={async () => {
                                const valueToSave = (currentValue ?? '').trim();
                                if (!valueToSave) return;
                                setStagePromptSaved(prev => new Set(prev).add(key));
                                try {
                                  await onSaveStagePrompt?.({
                                    ...sp,
                                    value: valueToSave,
                                  });
                                } catch (e) {
                                  setStagePromptSaved(prev => {
                                    const n = new Set(prev);
                                    n.delete(key);
                                    return n;
                                  });
                                }
                              }}
                              className="h-6 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-ui font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1"
                            >
                              <Check size={11} />
                              Accept
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Inline retry button for unanswered/failed messages */}
                  {msg.role === "founder" && (msg.id === unansweredMessageId || (msg as any).ai_response_failed) && (
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        justifyContent: 'flex-end',
                        marginTop: '6px',
                        paddingRight: '4px'
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#8A96A3' }}>
                        No response received
                      </span>
                      <button
                        onClick={() => {
                          setInputValue(msg.content);
                          // Small delay then auto-focus the input
                          setTimeout(() => {
                            document.querySelector<HTMLInputElement>('.mentor-input')?.focus();
                          }, 100);
                        }}
                        style={{
                          fontSize: '11px',
                          color: '#D4A017',
                          background: 'rgba(212,160,23,0.1)',
                          border: '0.5px solid rgba(212,160,23,0.3)',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        ↺ Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline save prompt */}
                {prompt && !isDismissed && !isSaved && (
                  <div className="w-full flex items-center gap-2 overflow-hidden mb-3" style={{ boxSizing: "border-box" }}>
                    <div className={cn(
                      "flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card/80",
                      isMobile ? "w-full" : "max-w-[75%]"
                    )} style={{ minWidth: 0, boxSizing: "border-box" }}>
                      <Save size={13} className="text-primary flex-shrink-0" />
                      <span className="text-[12px] font-ui text-foreground flex-1 min-w-0 truncate">{prompt.label}</span>
                      <button
                        onClick={() => handleSave(prompt)}
                        className="h-6 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-ui font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleDismiss(msg.id)}
                        className="text-[11px] font-ui text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Saved confirmation */}
                {isShowingSaved && (
                  <div className="flex justify-start mb-3">
                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary/10">
                      <Check size={13} className="text-primary" />
                      <span className="text-[12px] font-ui text-primary font-medium">Saved to Brand DNA</span>
                    </div>
                  </div>
                )}

                {/* Choice prompt */}
                {msg.role === "ai" && promptsByMessageId[msg.id] && onChoiceSelect && (
                  <>
                    {!promptsByMessageId[msg.id].is_answered ? (
                      <ChoicePromptCard
                        prompt={promptsByMessageId[msg.id]}
                        onSelect={(value, label) => onChoiceSelect(promptsByMessageId[msg.id], value, label)}
                      />
                    ) : (
                      <div style={{
                        margin: '8px 0',
                        padding: '8px 12px',
                        background: 'rgba(212,160,23,0.04)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#D4A017', fontSize: '12px' }}>✓</span>
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)'
                        }}>
                          Selected: <strong style={{ color: 'var(--color-text-primary)' }}>
                            {promptsByMessageId[msg.id].selected_option}
                          </strong>
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Milestone creation prompt */}
                {milestonePrompt?.messageId === msg.id && milestonePrompt.visible && (
                  <div className="milestone-prompt-card flex flex-col gap-2 p-4 border border-amber-400 bg-amber-50 rounded-lg my-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Flag className="text-amber-500" size={16} />
                      <span className="font-semibold text-amber-900">Mark this as a milestone?</span>
                    </div>
                    <input
                      value={milestoneNameInput}
                      onChange={e => setMilestoneNameInput(e.target.value)}
                      placeholder="Milestone name..."
                      className="milestone-name-input border px-2 py-1 rounded text-sm"
                    />
                    <select
                      value={milestoneCategoryInput}
                      onChange={e => setMilestoneCategoryInput(e.target.value as MilestoneCategory)}
                      className="milestone-category-select border px-2 py-1 rounded text-sm"
                    >
                      <option value="Brand Discovery">Brand Discovery</option>
                      <option value="Campaign Strategy">Campaign Strategy</option>
                      <option value="Customer Insight">Customer Insight</option>
                      <option value="Product Positioning">Product Positioning</option>
                      <option value="Growth Brainstorm">Growth Brainstorm</option>
                      <option value="Pitch Preparation">Pitch Preparation</option>
                      <option value="Free Form">Free Form</option>
                    </select>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={async () => {
                          if (!milestoneNameInput.trim()) return;
                          if (typeof window !== "undefined" && (window as any).handleCreateMilestone) {
                            await (window as any).handleCreateMilestone(
                              milestoneNameInput,
                              milestoneCategoryInput,
                              msg.id
                            );
                          }
                          setMilestonePrompt(null);
                          setMilestoneNameInput("");
                        }}
                        className="create-milestone-btn bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600"
                      >
                        Create milestone
                      </button>
                      <button
                        onClick={() => setMilestonePrompt(null)}
                        className="dismiss-milestone-btn px-3 py-1 rounded border border-amber-300 text-amber-700 bg-white hover:bg-amber-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking state indicator */}
          {thinkingState.isThinking && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'var(--color-background-secondary)',
                borderRadius: '12px',
                maxWidth: '280px'
              }}>
                {/* Animated dots */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#D4A017',
                        animation: `thinkingDot 1.2s ease-in-out infinite`,
                        animationDelay: `${i * 0.2}s` 
                      }}
                    />
                  ))}
                </div>
                {/* Thinking message */}
                <span style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  fontStyle: 'italic'
                }}>
                  {thinkingState.currentMessage}
                </span>
              </div>
            </div>
          )}

          {/* Streaming message */}
          {streamingMessageId && streamingText && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                padding: '12px 16px',
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: '12px',
                maxWidth: '75%'
              }}>
                <p style={{
                  fontSize: '13.5px',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0
                }}>
                  {parseAIMessage(streamingText).cleanText}
                  {/* Blinking cursor at the end */}
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '14px',
                    background: '#D4A017',
                    marginLeft: '2px',
                    verticalAlign: 'middle',
                    animation: 'cursorBlink 0.8s step-end infinite'
                  }} />
                </p>
              </div>
            </div>
          )}

          {/* CSS for animations */}
          <style>{`
            @keyframes thinkingDot {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-4px); opacity: 1; }
            }

            @keyframes cursorBlink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — sticky bottom */}
      <div className={cn(
        "flex-shrink-0 border-t border-border bg-card/50 z-10",
        isMobile && "pb-14"
      )}>
        {/* Pre-fill indicator when retrying a message */}
        {unansweredMessageId && inputValue && (
          <div style={{ 
            fontSize: '11px', 
            color: '#D4A017', 
            paddingTop: '8px',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}>
            ↺ Previous message — click send to retry
          </div>
        )}
        <div 
          className="w-full flex items-center gap-2 px-4 py-2" 
          style={{ 
            maxWidth: "100%", 
            boxSizing: "border-box",
            borderLeft: unansweredMessageId && inputValue ? '2px solid #D4A017' : 'none',
            marginLeft: unansweredMessageId && inputValue ? '-2px' : '0'
          }}
        >
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0">
            <Paperclip size={18} />
          </button>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0">
            <Mic size={18} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Continue this conversation..."
            className="mentor-input flex-1 min-w-0 h-10 bg-transparent text-[13px] font-ui text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isTyping}
          />
          <button
            onClick={handleSubmit}
            disabled={isTyping || !inputValue.trim()}
            className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
