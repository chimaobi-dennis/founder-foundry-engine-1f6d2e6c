import { useCallback } from "react";
import {
  Sparkles, PenLine, LayoutPanelLeft, Minimize2,
  Maximize2, Zap, Type, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSceneStore } from "./sceneStore";
import { orchestrateEdit } from "@/lib/scene/sceneAiOrchestrator";
import type { SceneNode } from "@/types/scene";

interface QuickAction {
  label: string;
  instruction: string;
  icon: React.ReactNode;
}

const TEXT_ACTIONS: QuickAction[] = [
  { label: "Rewrite", instruction: "rewrite this text", icon: <PenLine className="h-3 w-3" /> },
  { label: "Make bolder", instruction: "make this text bolder", icon: <Type className="h-3 w-3" /> },
  { label: "Add emphasis", instruction: "boost contrast on this element", icon: <Zap className="h-3 w-3" /> },
  { label: "Simplify", instruction: "simplify this text", icon: <Minimize2 className="h-3 w-3" /> },
];

const VISUAL_ACTIONS: QuickAction[] = [
  { label: "Modernize", instruction: "modernize this", icon: <Sparkles className="h-3 w-3" /> },
  { label: "Make cleaner", instruction: "simplify composition", icon: <Minimize2 className="h-3 w-3" /> },
  { label: "Expand", instruction: "increase density", icon: <Maximize2 className="h-3 w-3" /> },
  { label: "Rebalance", instruction: "refine composition", icon: <LayoutPanelLeft className="h-3 w-3" /> },
  { label: "New palette", instruction: "change color direction", icon: <Palette className="h-3 w-3" /> },
];

/**
 * AI quick actions popover for selected nodes.
 * Shows contextual actions based on node type.
 */
export function AiQuickActions() {
  const { selectedNode, selectedIds, document: scene, applyScene, dispatch } = useSceneStore();

  const runAction = useCallback(
    (instruction: string) => {
      dispatch({ type: "set_ai_pending", pending: true, message: instruction });

      const result = orchestrateEdit(scene, instruction, {
        selectedNodeIds: selectedIds,
      });

      if (result.action.kind !== "noop") {
        applyScene(result.scene);
      }

      dispatch({ type: "set_ai_pending", pending: false });
    },
    [scene, selectedIds, applyScene, dispatch]
  );

  if (!selectedNode) return null;

  const actions = getActionsForNode(selectedNode);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
        >
          <Sparkles className="h-3 w-3" />
          AI Actions
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-44 p-1"
      >
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => runAction(action.instruction)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm",
              "text-foreground/80 hover:text-foreground hover:bg-muted/80",
              "transition-colors"
            )}
          >
            <span className="text-muted-foreground">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function getActionsForNode(node: SceneNode): QuickAction[] {
  if (node.type === "text") return [...TEXT_ACTIONS, ...VISUAL_ACTIONS];
  return VISUAL_ACTIONS;
}
