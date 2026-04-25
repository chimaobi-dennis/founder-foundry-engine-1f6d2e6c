// VariantLoadingSlot — animated loading state for ProStudio variant thumbnails
// and the main preview area. Pulses through brand amber + a darker tone with a
// rotating sparkle and cycles through staggered creative messages.

import { useEffect, useState } from "react";
import { Sparkle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const MESSAGES = [
  "Designing...",
  "Finding the vibe...",
  "Mixing colours...",
  "Crafting layout...",
  "Adding magic...",
  "Almost there...",
];

const MSG_INTERVAL_MS = 2000;
const STAGGER_PER_SLOT_MS = 700;

interface SlotProps {
  /** 0-indexed slot position; used to stagger the message cycle. */
  slotIndex: number;
  /** "thumb" = small variant tile (~120px). "hero" = main preview area. */
  size?: "thumb" | "hero";
  /** When true, renders the failed/retry state instead of the loading state. */
  failed?: boolean;
  /** Click handler for the retry affordance (only used when failed). */
  onRetry?: () => void;
  /** Optional persistent caption shown below the cycling message (hero only). */
  caption?: string;
  className?: string;
}

export function VariantLoadingSlot({
  slotIndex,
  size = "thumb",
  failed = false,
  onRetry,
  caption,
  className,
}: SlotProps) {
  const [msgIdx, setMsgIdx] = useState(slotIndex % MESSAGES.length);

  useEffect(() => {
    if (failed) return;
    const stagger = (slotIndex * STAGGER_PER_SLOT_MS) % MSG_INTERVAL_MS;
    let interval: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
      interval = setInterval(() => {
        setMsgIdx((i) => (i + 1) % MESSAGES.length);
      }, MSG_INTERVAL_MS);
    }, stagger);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [slotIndex, failed]);

  const isHero = size === "hero";

  if (failed) {
    return (
      <button
        onClick={onRetry}
        className={cn(
          "w-full h-full bg-muted/40 hover:bg-muted/60 flex flex-col items-center justify-center gap-1.5 transition-colors group",
          className,
        )}
        title="Retry generation"
      >
        <RefreshCw
          size={isHero ? 28 : 14}
          className="text-muted-foreground group-hover:text-foreground transition-colors"
        />
        <span
          className={cn(
            "font-ui text-muted-foreground group-hover:text-foreground transition-colors",
            isHero ? "text-[13px]" : "text-[10px]",
          )}
        >
          Failed — retry?
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-full relative overflow-hidden flex flex-col items-center justify-center",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--brand-amber-deep)) 0%, hsl(var(--brand-amber)) 50%, hsl(var(--brand-amber-deep)) 100%)",
        backgroundSize: "200% 200%",
        animation: "variant-slot-pulse 2.4s ease-in-out infinite",
      }}
    >
      {/* Subtle dark wash so foreground icon/text stays legible */}
      <div className="absolute inset-0 bg-black/20" />

      <Sparkle
        size={isHero ? 40 : 18}
        className="relative text-white drop-shadow-sm"
        style={{
          animation: "variant-slot-spin 3s linear infinite",
        }}
        strokeWidth={1.6}
      />

      <span
        key={msgIdx}
        className={cn(
          "relative mt-2 font-ui text-white/95 text-center px-1 leading-tight",
          isHero ? "text-[12px]" : "text-[9.5px]",
        )}
        style={{ animation: "variant-msg-fade 600ms ease-out" }}
      >
        {MESSAGES[msgIdx]}
      </span>

      {isHero && caption && (
        <span className="relative mt-3 font-ui text-white/80 text-[13px] text-center px-2">
          {caption}
        </span>
      )}

      <style>{`
        @keyframes variant-slot-pulse {
          0%, 100% { background-position: 0% 50%; opacity: 0.92; }
          50% { background-position: 100% 50%; opacity: 1; }
        }
        @keyframes variant-slot-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes variant-msg-fade {
          0% { opacity: 0; transform: translateY(3px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
