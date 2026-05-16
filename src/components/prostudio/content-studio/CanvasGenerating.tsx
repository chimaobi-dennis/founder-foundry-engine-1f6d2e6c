import { useEffect, useState } from "react";

const MESSAGES = [
  "Generating",
  "Crafting layout",
  "Applying brand",
  "Almost there",
  "Finishing touches",
];

interface Props {
  platformName: string;
  width: number;
  height: number;
  scale: number;
}

/**
 * Full-canvas shimmer placeholder shown while a creative is generating
 * or regenerating. Sized to the platform's exact dimensions × scale, so
 * it occupies the same physical area as the final visual — never a tiny
 * centered spinner.
 */
export function CanvasGenerating({ platformName, width, height, scale }: Props) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % MESSAGES.length);
    }, 1800);
    return () => window.clearInterval(t);
  }, []);

  const w = width * scale;
  const h = height * scale;
  // Scale the inner content cluster so it reads well at any canvas size,
  // but never grows obnoxiously large or shrinks to nothing.
  const contentScale = Math.max(0.6, Math.min(1.4, Math.min(w, h) / 600));

  return (
    <div
      className="relative overflow-hidden rounded-sm"
      style={{
        width: w,
        height: h,
        background: "#1A2A3A",
      }}
    >
      {/* Local keyframes — scoped so we don't depend on tailwind config */}
      <style>{`
        @keyframes cg-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes cg-progress {
          0%   { width: 0%; }
          100% { width: 85%; }
        }
        @keyframes cg-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cg-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
      `}</style>

      {/* Base subtle vignette grid */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(212,160,23,0.06), transparent 60%)",
        }}
      />

      {/* Amber shimmer sweep */}
      <div
        className="absolute inset-y-0"
        style={{
          width: "60%",
          left: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(212,160,23,0.10) 50%, transparent 100%)",
          animation: "cg-shimmer 2.2s ease-in-out infinite",
          willChange: "transform",
        }}
      />

      {/* Top progress line — indeterminate, stops at 85% */}
      <div
        className="absolute top-0 left-0 h-[2px] z-10"
        style={{
          background: "#D4A017",
          boxShadow: "0 0 8px rgba(212,160,23,0.6)",
          animation: "cg-progress 8s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        }}
      />

      {/* Centered content cluster */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex flex-col items-center gap-3 text-center"
          style={{ transform: `scale(${contentScale})` }}
        >
          {/* Rotating ring + inner pulsing dot */}
          <div className="relative" style={{ width: 56, height: 56 }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid rgba(212,160,23,0.15)",
                borderTopColor: "#D4A017",
                animation: "cg-spin 1.2s linear infinite",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                inset: 18,
                background: "#D4A017",
                boxShadow: "0 0 16px rgba(212,160,23,0.6)",
                animation: "cg-pulse 1.6s ease-in-out infinite",
              }}
            />
          </div>

          <div
            className="font-ui tracking-[0.18em] uppercase"
            style={{ color: "rgba(245,240,232,0.55)", fontSize: 11 }}
          >
            {platformName}
          </div>
          <div
            key={idx}
            className="font-ui animate-fade-in"
            style={{ color: "rgba(245,240,232,0.85)", fontSize: 14 }}
          >
            {MESSAGES[idx]}
            <span style={{ color: "#D4A017" }}>…</span>
          </div>

          {/* Mini skeleton lines for visual weight */}
          <div className="flex flex-col gap-2 mt-2" style={{ width: 220 }}>
            <div
              className="h-1.5 rounded"
              style={{
                width: "85%",
                background: "rgba(212,160,23,0.10)",
                animation: "cg-pulse 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-1.5 rounded"
              style={{
                width: "65%",
                background: "rgba(212,160,23,0.10)",
                animation: "cg-pulse 1.8s ease-in-out infinite",
                animationDelay: "200ms",
              }}
            />
            <div
              className="h-1.5 rounded"
              style={{
                width: "75%",
                background: "rgba(212,160,23,0.10)",
                animation: "cg-pulse 1.8s ease-in-out infinite",
                animationDelay: "400ms",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
