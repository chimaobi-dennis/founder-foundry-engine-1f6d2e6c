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
        {/* Skeleton bounce fade — conversation layout */}
        <div className="animate-in fade-in duration-500 space-y-6">
          {/* AI message skeleton — left aligned with editorial border */}
          <div className="flex items-start gap-2">
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
          <div className="flex items-start gap-2 flex-row-reverse">
            <div className="w-8 h-8 rounded-xl bg-muted/40 animate-pulse flex-shrink-0" />
            <div className="rounded-2xl px-4 py-2.5 bg-white/[0.04] max-w-[78%]">
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.3s' }} />
                <div className="h-4 w-[80%] bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>

          {/* AI message skeleton — longer response */}
          <div className="flex items-start gap-2">
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
          <div className="flex items-start gap-2 flex-row-reverse">
            <div className="w-8 h-8 rounded-xl bg-muted/40 animate-pulse flex-shrink-0" style={{ animationDelay: '0.9s' }} />
            <div className="rounded-2xl px-4 py-2.5 bg-white/[0.04] max-w-[50%]">
              <div className="h-4 w-full bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.9s' }} />
            </div>
          </div>

          {/* AI message skeleton — final response */}
          <div className="flex items-start gap-2">
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
    </div>
    </>
  );
}
