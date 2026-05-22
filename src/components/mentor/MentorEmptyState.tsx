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
        {/* Skeleton bounce fade — shown until content loads */}
        <div className="animate-in fade-in duration-500">
          {/* Mentor avatar + name skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 animate-bounce" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-20 bg-muted/60 rounded animate-shimmer" />
              <div className="h-2.5 w-12 bg-muted/40 rounded animate-shimmer" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>

          {/* Opening message skeleton */}
          <div className="space-y-3 mb-6">
            <div className="h-4 w-full bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.1s' }} />
            <div className="h-4 w-[92%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.2s' }} />
            <div className="h-4 w-[85%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.3s' }} />
            <div className="h-4 w-[60%] bg-muted/50 rounded animate-shimmer" style={{ animationDelay: '0.4s' }} />
          </div>

          {/* Divider skeleton */}
          <div className="my-6 h-px bg-muted/40 w-full animate-pulse" />

          {/* Input field skeleton */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-12 rounded-lg bg-muted/40 animate-shimmer" />
            <div className="w-12 h-12 rounded-lg bg-primary/20 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
