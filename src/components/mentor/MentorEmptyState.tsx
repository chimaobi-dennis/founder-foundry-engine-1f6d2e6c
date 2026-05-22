import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

// Shimmer animation for skeleton loading
const shimmerStyles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .animate-shimmer {
    animation: shimmer 1.5s ease-in-out infinite;
  }
`;

export type MentorMode = "idea" | "brand" | "new" | null;

const openingMessages: Record<string, string> = {
  idea: "Good. Let us start at the beginning. Tell me the idea — not the polished version, the real one. What problem are you actually trying to solve and for who?",
  brand: "Good to meet you. Before we go anywhere — what is the one thing about your brand you feel is not quite right yet? Start there.",
  new: "Let us build something. What are we starting with — tell me the idea, the problem, or just what has been on your mind. We will figure out the rest together.",
};

interface MentorEmptyStateProps {
  mode: "idea" | "brand" | "new";
  onSubmit: (text: string) => void;
}

export function MentorEmptyState({ mode, onSubmit }: MentorEmptyStateProps) {
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

  return (
    <>
      <style>{shimmerStyles}</style>
      {/* Full ChatPanel-style skeleton layout */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden max-w-full bg-background">
        {/* Scrollable messages area */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <div className={cn(
            "px-6 md:px-10 py-8 space-y-6 w-full max-w-[760px] mx-auto",
            fadingOut && "opacity-0 transition-opacity duration-200"
          )}>
            {/* Timestamp skeleton */}
            <p className="text-[10px] font-ui uppercase tracking-[0.15em] text-muted-foreground/60 text-center py-3">
              <span className="inline-block h-3 w-24 bg-muted/40 rounded animate-shimmer" />
            </p>

            {/* AI message skeleton — left aligned with editorial border */}
            <div className="flex items-start gap-2 w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 animate-bounce flex-shrink-0" />
              <div className="py-1 pl-4 border-l border-white/[0.06] w-full max-w-[85%]">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted/50 rounded animate-shimmer" />
                  <div className="h-4 w-[92%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.1s' }} />
                  <div className="h-4 w-[75%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>

            {/* Founder message skeleton — right aligned bubble */}
            <div className="flex items-start gap-2 flex-row-reverse w-full">
              <div className="w-8 h-8 rounded-xl bg-muted/40 animate-pulse flex-shrink-0" />
              <div className="rounded-2xl px-4 py-2.5 bg-white/[0.04] max-w-[78%]">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.3s' }} />
                  <div className="h-4 w-[80%] bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>

            {/* AI message skeleton — longer response */}
            <div className="flex items-start gap-2 w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 animate-bounce flex-shrink-0" style={{ animationDelay: '0.5s' }} />
              <div className="py-1 pl-4 border-l border-white/[0.06] w-full max-w-[85%]">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.5s' }} />
                  <div className="h-4 w-[95%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.6s' }} />
                  <div className="h-4 w-[88%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.7s' }} />
                  <div className="h-4 w-[65%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.8s' }} />
                </div>
              </div>
            </div>

            {/* Founder message skeleton — short reply */}
            <div className="flex items-start gap-2 flex-row-reverse w-full">
              <div className="w-8 h-8 rounded-xl bg-muted/40 animate-pulse flex-shrink-0" style={{ animationDelay: '0.9s' }} />
              <div className="rounded-2xl px-4 py-2.5 bg-white/[0.04] max-w-[50%]">
                <div className="h-4 w-full bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.9s' }} />
              </div>
            </div>

            {/* AI message skeleton — final response */}
            <div className="flex items-start gap-2 w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 animate-bounce flex-shrink-0" style={{ animationDelay: '1s' }} />
              <div className="py-1 pl-4 border-l border-white/[0.06] w-full max-w-[85%]">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '1s' }} />
                  <div className="h-4 w-[90%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '1.1s' }} />
                  <div className="h-4 w-[70%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '1.2s' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Input bar skeleton */}
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-background z-10 pb-14 md:pb-0">
          <div className="w-full flex items-center gap-2 px-4 py-2 max-w-[760px] mx-auto">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground bg-muted/40 animate-shimmer" />
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground bg-muted/40 animate-shimmer" style={{ animationDelay: '0.1s' }} />
            <div className="flex-1 min-w-0 h-10 bg-muted/40 rounded-lg animate-shimmer" style={{ animationDelay: '0.2s' }} />
            <div className="w-9 h-9 rounded-lg bg-primary/20 animate-pulse" />
          </div>
        </div>
      </div>
    </>
  );
}
