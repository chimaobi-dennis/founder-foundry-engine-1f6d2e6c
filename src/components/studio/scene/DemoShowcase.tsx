import { useState, useCallback } from "react";
import {
  Sparkles, Wand2, Palette, LayoutPanelLeft,
  Smartphone, Monitor, Play, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";
import { orchestrateEdit } from "@/lib/scene/sceneAiOrchestrator";
import { reflowToPreset } from "@/lib/scene/reflowScene";
import type { SceneDocument } from "@/types/scene";
import { SceneRenderer } from "./SceneRenderer";
import { FadeIn } from "./SceneMotion";

// ─── Demo Moments ────────────────────────────────────────────

interface DemoMoment {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: (scene: SceneDocument) => SceneDocument;
}

const DEMO_MOMENTS: DemoMoment[] = [
  {
    id: "premium",
    label: "AI Style Transform",
    description: "\"Make it premium\" — watch AI restyle the entire scene",
    icon: <Sparkles className="h-4 w-4" />,
    action: (scene) => orchestrateEdit(scene, "make it premium").scene,
  },
  {
    id: "bold",
    label: "Bold Transformation",
    description: "\"Make it bolder\" — AI increases contrast and density",
    icon: <Wand2 className="h-4 w-4" />,
    action: (scene) => orchestrateEdit(scene, "make it bolder").scene,
  },
  {
    id: "simplify",
    label: "AI Simplification",
    description: "\"Simplify\" — AI declutters and adds breathing room",
    icon: <LayoutPanelLeft className="h-4 w-4" />,
    action: (scene) => orchestrateEdit(scene, "simplify composition").scene,
  },
  {
    id: "reflow-story",
    label: "Adaptive Reflow",
    description: "Instantly adapt to Instagram Story format",
    icon: <Smartphone className="h-4 w-4" />,
    action: (scene) => reflowToPreset(scene, "instagram_story").scene,
  },
  {
    id: "reflow-linkedin",
    label: "Platform Adapt",
    description: "Reflow to LinkedIn post dimensions",
    icon: <Monitor className="h-4 w-4" />,
    action: (scene) => reflowToPreset(scene, "linkedin_post").scene,
  },
  {
    id: "modernize",
    label: "Modernize",
    description: "\"Modernize\" — fresh typography + contrast boost",
    icon: <Palette className="h-4 w-4" />,
    action: (scene) => orchestrateEdit(scene, "modernize").scene,
  },
];

// ─── Component ───────────────────────────────────────────────

/**
 * Investor demo showcase panel.
 * One-click "holy sh*t" moments that demonstrate AI capabilities.
 */
export function DemoShowcase() {
  const { document: scene, applyScene, dispatch } = useSceneStore();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [beforeScene, setBeforeScene] = useState<SceneDocument | null>(null);

  const runDemo = useCallback(
    (moment: DemoMoment) => {
      setActiveDemo(moment.id);
      setBeforeScene(scene);
      dispatch({ type: "set_ai_pending", pending: true, message: moment.description });

      // Small delay for dramatic effect
      setTimeout(() => {
        const result = moment.action(scene);
        applyScene(result);
        dispatch({ type: "set_ai_pending", pending: false });

        // Auto-clear active state
        setTimeout(() => setActiveDemo(null), 1500);
      }, 400);
    },
    [scene, applyScene, dispatch]
  );

  const revertDemo = useCallback(() => {
    if (beforeScene) {
      applyScene(beforeScene);
      setBeforeScene(null);
    }
  }, [beforeScene, applyScene]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Play className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
          Demo Moments
        </span>
        {beforeScene && (
          <button
            onClick={revertDemo}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
          >
            Revert
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {DEMO_MOMENTS.map((moment, i) => (
          <FadeIn key={moment.id} delay={i * 60}>
            <button
              onClick={() => runDemo(moment)}
              disabled={activeDemo !== null}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-200",
                activeDemo === moment.id
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/20 hover:bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 transition-colors",
                  activeDemo === moment.id ? "text-primary" : "text-muted-foreground"
                )}
              >
                {moment.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{moment.label}</span>
                  {activeDemo === moment.id && (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-primary/10 text-primary">
                      Running
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {moment.description}
                </p>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 mt-1 shrink-0" />
            </button>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
