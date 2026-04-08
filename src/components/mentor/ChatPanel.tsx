import { Send, Paperclip, Mic, Flag, Save, Check, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

import { cn } from "@/lib/utils";
import { MentorBrand, Message, InlineSavePrompt, MilestoneMarker, Milestone, MilestoneCategory, categoryTextColors } from "./types";
// Milestone prompt state
interface MilestonePromptState {
  messageId: string;
  visible: boolean;
}

interface ChatPanelProps {
  brand: MentorBrand;
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
}

export function ChatPanel({
  brand,
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
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [savedPrompts, setSavedPrompts] = useState<Set<string>>(new Set());
  const [showingSaved, setShowingSaved] = useState<Set<string>>(new Set());
  const [highlightedMilestone, setHighlightedMilestone] = useState<string | null>(null);
  const milestoneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Milestone creation prompt state
  const [milestonePrompt, setMilestonePrompt] = useState<MilestonePromptState | null>(null);
  const [milestoneNameInput, setMilestoneNameInput] = useState("");
  const [milestoneCategoryInput, setMilestoneCategoryInput] = useState<MilestoneCategory>("Brand Discovery");

  // Handler to trigger milestone prompt after AI message
  const checkForMilestoneOpportunity = (responseText: string, messageId: string) => {
    const lower = responseText.toLowerCase();
    const isMilestoneWorthy =
      responseText.length > 200 ||
      lower.includes("brand voice") ||
      lower.includes("positioning") ||
      lower.includes("target audience") ||
      lower.includes("core promise") ||
      lower.includes("campaign") ||
      lower.includes("strategy");

    if (isMilestoneWorthy) {
      setMilestonePrompt({ messageId, visible: true });
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

  // Auto-scroll to bottom on new messages or typing
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

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

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden max-w-full" style={{ boxSizing: "border-box" }}>
      {/* Brand context bar */}
      <div className="h-10 flex items-center gap-3 px-4 bg-muted/20 border-b border-border flex-shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", brand.colorClass)} />
          <span className="text-[12px] font-ui font-medium text-foreground truncate">{brand.name}</span>
        </div>
        <span className="text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0 whitespace-nowrap">
          Brand DNA Active
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

            // If this is an AI message, check for milestone opportunity
            useEffect(() => {
              if (msg.role === "ai") {
                checkForMilestoneOpportunity(msg.content, msg.id);
              }
              // eslint-disable-next-line
            }, [msg.content, msg.id]);

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
                <div className={cn("w-full flex overflow-hidden mb-3", msg.role === "founder" ? "justify-end" : "justify-start")} style={{ minWidth: 0, boxSizing: "border-box" }}>
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 max-w-[75%] min-w-0 break-words",
                      msg.role === "founder"
                        ? "bg-primary/10 ml-auto"
                        : "bg-card border border-border"
                    )}
                    style={{ overflowWrap: "break-word", wordWrap: "break-word", wordBreak: "break-word", minWidth: 0, flexShrink: 1, boxSizing: "border-box" }}
                  >
                    <p
                      className="text-[13.5px] font-ui text-foreground whitespace-pre-line break-words"
                      style={{ lineHeight: msg.role === "ai" ? "1.7" : "1.6" }}
                    >
                      {msg.content}
                    </p>
                  </div>
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
                          if (typeof window !== "undefined" && window.handleCreateMilestone) {
                            await window.handleCreateMilestone(
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

          {/* Typing indicator */}
          {isTyping && (
            <div className="w-full flex justify-start mb-3">
              <div className="rounded-xl px-4 py-3 bg-card border border-border max-w-[75%] min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                {slowThinking && (
                  <p className="text-[11px] font-ui text-muted-foreground mt-1.5">Still thinking...</p>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — sticky bottom */}
      <div className={cn(
        "flex-shrink-0 border-t border-border bg-card/50 z-10",
        isMobile && "pb-14"
      )}>
        {error && (
          <div className="px-4 pt-2 flex items-center gap-1.5">
            <span className="text-[12px] font-ui text-muted-foreground">Could not connect —</span>
            <button onClick={onRetry} className="text-[12px] font-ui text-primary hover:underline">try again</button>
          </div>
        )}
        <div className="w-full flex items-center gap-2 px-4 py-2" style={{ maxWidth: "100%", boxSizing: "border-box" }}>
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
            className="flex-1 min-w-0 h-10 bg-transparent text-[13px] font-ui text-foreground placeholder:text-muted-foreground outline-none"
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
