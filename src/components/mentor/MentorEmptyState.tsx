import { useState } from "react";
import { Send, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type MentorMode = "idea" | "brand" | "new" | null;

const openingMessages: Record<string, string> = {
  idea: "Good. Let us start at the beginning. Tell me the idea — not the polished version, the real one. What problem are you actually trying to solve and for who?",
  brand: "Good to meet you. Before we go anywhere — what is the one thing about your brand you feel is not quite right yet? Start there.",
  new: "Let us build something. What are we starting with — tell me the idea, the problem, or just what has been on your mind. We will figure out the rest together.",
};

interface MentorEmptyStateProps {
  mode: "idea" | "brand" | "new";
  onboardingCompleted?: boolean;
  brandName?: string;
  onSubmit: (text: string) => void;
  onStartSetup?: () => void;
}

export function MentorEmptyState({ 
  mode, 
  onboardingCompleted = true,
  brandName,
  onSubmit, 
  onStartSetup 
}: MentorEmptyStateProps) {
  const [inputValue, setInputValue] = useState("");
  const [fadingOut, setFadingOut] = useState(false);

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text) return;
    setFadingOut(true);
    setTimeout(() => onSubmit(text), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const message = openingMessages[mode] || openingMessages.new;

  // If project setup not complete, show CTA instead of chat input
  if (!onboardingCompleted && onStartSetup) {
    return (
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden max-w-full bg-background">
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className="px-6 md:px-10 py-12 w-full max-w-[760px] mx-auto">
            {/* Welcome message */}
            <div className="flex flex-col items-center text-center mb-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                Welcome to {brandName || "your project"}
              </h2>
              <p className="font-ui text-[14px] text-muted-foreground max-w-md leading-relaxed">
                Before we start the conversation, let us set up your project context. 
                This helps Kinika understand what you are building.
              </p>
            </div>

            {/* Setup CTA */}
            <div className="flex flex-col items-center gap-4">
              <Button
                onClick={onStartSetup}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 text-[15px]"
              >
                Set up your project
                <ArrowRight size={18} className="ml-2" />
              </Button>
              <p className="font-ui text-[12px] text-muted-foreground">
                Takes about 2 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal conversation empty state
  return (
    <>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden max-w-full bg-background">
        {/* Scrollable messages area */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className={cn(
            "px-6 md:px-10 py-8 space-y-6 w-full max-w-[760px] mx-auto",
            fadingOut && "opacity-0 transition-opacity duration-200"
          )}>
            {/* Timestamp */}
            <p className="text-[10px] font-ui uppercase tracking-[0.15em] text-muted-foreground/60 text-center py-3">
              Today
            </p>

            {/* AI opening message */}
            <div className="flex items-start gap-2 w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0" />
              <div className="py-1 pl-4 border-l border-white/[0.06] w-full max-w-[85%]">
                <p className="font-ui text-[15px] text-foreground leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-background z-10 pb-14 md:pb-0">
          <div className="w-full flex items-center gap-2 px-4 py-3 max-w-[760px] mx-auto">
            <div className="flex-1 min-w-0 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start the conversation..."
                className="w-full h-11 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 font-ui text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 transition-colors"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
