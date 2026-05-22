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
      <div className="flex-1 min-h-0 flex items-center justify-center px-4">
        <div
          className={cn(
            "w-[90%] max-w-[560px] rounded-2xl p-8 transition-opacity duration-200",
            "bg-card dark:bg-[#1A2A3A] border-[0.5px]",
            "border-[#E8E2D9] dark:border-[#2A3A4A]",
            fadingOut && "opacity-0"
          )}
        >
        {/* Skeleton bounce fade header */}
        <div className="flex items-center gap-3 mb-4 animate-in fade-in duration-500">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 animate-bounce" />
            <div className="absolute inset-0 w-10 h-10 rounded-xl bg-primary/10 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-24 bg-muted/60 rounded animate-shimmer" />
            <div className="h-2.5 w-16 bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>

        {/* Opening message */}
        <p
          className="font-display text-[18px] leading-[1.7] text-foreground"
        >
          {openingMessages[mode]}
        </p>

        {/* Divider */}
        <div className="my-6 h-px bg-border dark:border-[#2A3A4A] w-full" style={{ height: "0.5px" }} />

        {/* Input + send */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            className={cn(
              "flex-1 min-w-0 h-12 rounded-lg px-4 py-3",
              "bg-muted/30 dark:bg-[#1E3040]",
              "border-[0.5px] border-border dark:border-[#2A3A4A]",
              "text-[14px] font-ui text-foreground placeholder:text-muted-foreground",
              "outline-none focus:ring-1 focus:ring-primary/40"
            )}
          />
          <button
            onClick={handleSubmit}
            className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
