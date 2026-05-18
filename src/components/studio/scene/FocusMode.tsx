import { useEffect, useCallback } from "react";
import { Maximize2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";

/**
 * Focus mode overlay controls.
 * When active: hides chrome, shows minimal floating toolbar,
 * immersive canvas, escape to exit.
 */
export function FocusModeControls() {
  const { focusMode, toggleFocusMode, zoom, setZoom, setPan } = useSceneStore();

  // Escape to exit focus mode
  useEffect(() => {
    if (!focusMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleFocusMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusMode, toggleFocusMode]);

  if (!focusMode) {
    return null;
  }

  return (
    <>
      {/* Exit button — top right */}
      <div className="absolute top-3 right-3 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs bg-background/60 backdrop-blur-sm border border-border/50 hover:bg-background/80"
          onClick={toggleFocusMode}
        >
          <X className="h-3 w-3 mr-1" />
          Exit Focus
        </Button>
      </div>

      {/* Mini zoom controls — bottom right */}
      <div className="absolute bottom-3 right-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border/50">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            className="text-xs text-muted-foreground hover:text-foreground px-1"
          >
            −
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            className="text-xs text-muted-foreground hover:text-foreground px-1"
          >
            +
          </button>
        </div>
      </div>

      {/* Hint — bottom center, fades out */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 animate-in fade-in duration-500">
        <p className="text-[10px] text-muted-foreground/50">
          Press <kbd className="px-1 py-0.5 rounded bg-muted/50 text-muted-foreground text-[9px] font-mono">Esc</kbd> to exit
        </p>
      </div>
    </>
  );
}

/**
 * Focus mode toggle button for toolbars.
 */
export function FocusModeToggle() {
  const { focusMode, toggleFocusMode } = useSceneStore();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleFocusMode}
      title={focusMode ? "Exit focus mode" : "Enter focus mode"}
      className={cn(
        "h-7 w-7 p-0",
        focusMode && "text-primary"
      )}
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </Button>
  );
}
