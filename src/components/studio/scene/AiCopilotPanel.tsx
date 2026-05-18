import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Send, Sparkles, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";
import { orchestrateEdit, type OrchestratorResult } from "@/lib/scene/sceneAiOrchestrator";
import type { SceneDocument } from "@/types/scene";

// ─── Types ────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: number;
  result?: OrchestratorResult;
  status?: "pending" | "applied" | "rejected";
  /** Scene before AI edit (for preview/undo). */
  sceneBefore?: SceneDocument;
}

// ─── Suggested Prompts ───────────────────────────────────────

const SUGGESTIONS = [
  "Make this more premium",
  "Reduce clutter",
  "Rewrite CTA",
  "Adapt for LinkedIn",
  "More contrast",
  "Modernize the layout",
  "Simplify composition",
  "Make it bolder",
];

// ─── Component ───────────────────────────────────────────────

export function AiCopilotPanel() {
  const store = useSceneStore();
  const { document: scene, selectedIds, applyScene, dispatch } = store;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (text?: string) => {
      const instruction = (text || input).trim();
      if (!instruction || isProcessing) return;

      setInput("");
      setIsProcessing(true);
      dispatch({ type: "set_ai_pending", pending: true, message: instruction });

      const userMsg: ChatMessage = {
        id: `msg_${Date.now().toString(36)}`,
        role: "user",
        content: instruction,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Run orchestrator
      const sceneBefore = scene;
      const result = orchestrateEdit(scene, instruction, {
        selectedNodeIds: selectedIds,
      });

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now().toString(36)}_ai`,
        role: "ai",
        content: buildAiMessage(result),
        timestamp: Date.now(),
        result,
        status: result.action.kind === "noop" ? "rejected" : "pending",
        sceneBefore,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Auto-apply non-noop results
      if (result.action.kind !== "noop") {
        applyScene(result.scene);
      }

      setIsProcessing(false);
      dispatch({ type: "set_ai_pending", pending: false });
    },
    [input, isProcessing, scene, selectedIds, applyScene, dispatch]
  );

  const acceptEdit = useCallback(
    (msgId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "applied" as const } : m))
      );
    },
    []
  );

  const rejectEdit = useCallback(
    (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (msg?.sceneBefore) {
        applyScene(msg.sceneBefore);
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, status: "rejected" as const } : m))
      );
    },
    [messages, applyScene]
  );

  const retryEdit = useCallback(
    (msgId: string) => {
      const idx = messages.findIndex((m) => m.id === msgId);
      if (idx <= 0) return;
      const userMsg = messages[idx - 1];
      if (userMsg?.role === "user") {
        handleSubmit(userMsg.content);
      }
    },
    [messages, handleSubmit]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
          AI Copilot
        </span>
        {selectedIds.length > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground text-center">
                Describe what you want to change.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-xs leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-tl-sm bg-muted/60 text-foreground/90 text-xs leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Accept / Reject / Retry controls */}
                  {msg.status === "pending" && (
                    <div className="flex items-center gap-1.5 pl-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                        onClick={() => acceptEdit(msg.id)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                        onClick={() => rejectEdit(msg.id)}
                      >
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground"
                        onClick={() => retryEdit(msg.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Retry
                      </Button>
                    </div>
                  )}

                  {msg.status === "applied" && (
                    <div className="flex items-center gap-1 pl-1 text-[10px] text-green-600">
                      <Check className="h-3 w-3" /> Applied
                    </div>
                  )}
                  {msg.status === "rejected" && (
                    <div className="flex items-center gap-1 pl-1 text-[10px] text-muted-foreground">
                      <X className="h-3 w-3" /> Rejected
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex items-end gap-1.5 bg-muted/40 rounded-xl px-3 py-2 border border-border/50 focus-within:border-primary/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe your edit..."
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-muted-foreground/60 min-h-[20px] max-h-[80px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary shrink-0"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isProcessing}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function buildAiMessage(result: OrchestratorResult): string {
  const { action, intent, durationMs } = result;

  switch (action.kind) {
    case "mutation":
      return `${action.result.summary} (${durationMs}ms)`;
    case "patch":
      return `Applied ${action.result.appliedOps} patch(es). (${durationMs}ms)`;
    case "refine":
      return action.result.improved
        ? `Refined composition: score ${action.result.scoreBefore.overall} → ${action.result.scoreAfter.overall}. (${durationMs}ms)`
        : `Composition already strong (score ${action.result.scoreBefore.overall}). No changes needed.`;
    case "repair":
      return action.result.totalRepairs > 0
        ? `Fixed ${action.result.totalRepairs} issue(s). (${durationMs}ms)`
        : `No issues found. Scene looks clean.`;
    case "reflow":
      return `Reflowed to ${action.result.targetSize.width}×${action.result.targetSize.height} using ${action.result.strategy} strategy. (${durationMs}ms)`;
    case "noop":
      return action.reason || `I couldn't understand that instruction. Try something like "make it bolder" or "reduce clutter".`;
  }
}
