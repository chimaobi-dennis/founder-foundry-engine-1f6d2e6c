import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const MESSAGES = [
  "Generating your design...",
  "Crafting the layout...",
  "Applying your brand...",
  "Almost there...",
  "Adding the finishing touches...",
];

interface Props {
  platformName: string;
  width: number;
  height: number;
  scale: number;
}

/**
 * Skeleton loading card shown inside the canvas container while a creative
 * is still generating. Sized to the platform's exact dimensions so the
 * surrounding layout (which uses canvas width/height * scale) stays exact.
 */
export function CanvasGenerating({ platformName, width, height, scale }: Props) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % MESSAGES.length);
    }, 2000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-sm flex items-center justify-center"
      style={{
        width: width * scale,
        height: height * scale,
        background: "#111111",
      }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="flex flex-col items-center gap-4 text-center px-8">
          <div className="relative">
            <Sparkles
              size={48}
              className="text-primary animate-pulse"
              strokeWidth={1.5}
            />
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30 animate-pulse"
              style={{ background: "hsl(var(--primary))" }}
            />
          </div>
          <div className="text-[14px] font-ui text-muted-foreground tracking-wide">
            {platformName}
          </div>
          <div
            key={idx}
            className="text-[16px] font-ui text-foreground animate-fade-in"
          >
            {MESSAGES[idx]}
          </div>
          <div className="flex flex-col gap-2 mt-2 w-[260px]">
            <div className="h-2 rounded bg-foreground/10 animate-pulse" style={{ width: "85%" }} />
            <div className="h-2 rounded bg-foreground/10 animate-pulse" style={{ width: "65%", animationDelay: "150ms" }} />
            <div className="h-2 rounded bg-foreground/10 animate-pulse" style={{ width: "75%", animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
