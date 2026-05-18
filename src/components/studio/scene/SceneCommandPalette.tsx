import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CommandDialog, CommandInput, CommandList,
  CommandEmpty, CommandGroup, CommandItem, CommandSeparator
} from "@/components/ui/command";
import {
  Sparkles, Wand2, Download, RotateCcw, LayoutPanelLeft,
  Palette, Type, Minimize2, Maximize2, RefreshCw,
  Monitor, Smartphone, Eye, Zap, Layers, Search
} from "lucide-react";
import { useSceneStore } from "./sceneStore";
import { orchestrateEdit } from "@/lib/scene/sceneAiOrchestrator";
import { getAllModes, type CreativeMode } from "@/lib/scene/creativeModes";

// ─── Types ───────────────────────────────────────────────────

interface CommandAction {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  keywords: string[];
  action: () => void;
}

// ─── Component ───────────────────────────────────────────────

export function SceneCommandPalette() {
  const [open, setOpen] = useState(false);
  const store = useSceneStore();

  // ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const runEdit = useCallback(
    (instruction: string) => {
      store.dispatch({ type: "set_ai_pending", pending: true, message: instruction });
      const result = orchestrateEdit(store.document, instruction, {
        selectedNodeIds: store.selectedIds,
      });
      if (result.action.kind !== "noop") {
        store.applyScene(result.scene);
      }
      store.dispatch({ type: "set_ai_pending", pending: false });
      setOpen(false);
    },
    [store]
  );

  const commands = useMemo((): CommandAction[] => {
    const cmds: CommandAction[] = [];

    // AI Edits
    cmds.push(
      { id: "ai-premium", label: "Make it premium", group: "AI Edit", icon: <Sparkles className="h-4 w-4" />, keywords: ["premium", "luxury"], action: () => runEdit("make it premium") },
      { id: "ai-modern", label: "Modernize", group: "AI Edit", icon: <Wand2 className="h-4 w-4" />, keywords: ["modern", "fresh"], action: () => runEdit("modernize") },
      { id: "ai-simplify", label: "Simplify", group: "AI Edit", icon: <Minimize2 className="h-4 w-4" />, keywords: ["simplify", "clean", "reduce"], action: () => runEdit("simplify") },
      { id: "ai-bold", label: "Make bolder", group: "AI Edit", icon: <Zap className="h-4 w-4" />, keywords: ["bold", "strong"], action: () => runEdit("make it bolder") },
      { id: "ai-contrast", label: "Boost contrast", group: "AI Edit", icon: <Maximize2 className="h-4 w-4" />, keywords: ["contrast"], action: () => runEdit("boost contrast") },
      { id: "ai-refine", label: "Refine composition", group: "AI Edit", icon: <LayoutPanelLeft className="h-4 w-4" />, keywords: ["refine", "improve"], action: () => runEdit("refine") },
      { id: "ai-repair", label: "Repair issues", group: "AI Edit", icon: <RefreshCw className="h-4 w-4" />, keywords: ["repair", "fix"], action: () => runEdit("repair") },
    );

    // Platform adapt
    cmds.push(
      { id: "plat-story", label: "Adapt for Instagram Story", group: "Platform", icon: <Smartphone className="h-4 w-4" />, keywords: ["story", "instagram", "9:16"], action: () => runEdit("adapt for story format") },
      { id: "plat-linkedin", label: "Adapt for LinkedIn", group: "Platform", icon: <Monitor className="h-4 w-4" />, keywords: ["linkedin"], action: () => runEdit("adapt for linkedin") },
      { id: "plat-facebook", label: "Adapt for Facebook", group: "Platform", icon: <Monitor className="h-4 w-4" />, keywords: ["facebook"], action: () => runEdit("adapt for facebook") },
    );

    // View
    cmds.push(
      { id: "focus", label: "Toggle Focus Mode", group: "View", icon: <Eye className="h-4 w-4" />, keywords: ["focus", "zen", "distraction"], action: () => { store.toggleFocusMode(); setOpen(false); } },
      { id: "zoom-fit", label: "Reset Zoom", group: "View", icon: <Maximize2 className="h-4 w-4" />, keywords: ["zoom", "reset", "fit"], action: () => { store.setZoom(1); store.setPan({ x: 0, y: 0 }); setOpen(false); } },
    );

    // Actions
    cmds.push(
      { id: "undo", label: "Undo", group: "Action", icon: <RotateCcw className="h-4 w-4" />, keywords: ["undo"], action: () => { store.undo(); setOpen(false); } },
      { id: "redo", label: "Redo", group: "Action", icon: <RotateCcw className="h-4 w-4 scale-x-[-1]" />, keywords: ["redo"], action: () => { store.redo(); setOpen(false); } },
    );

    return cmds;
  }, [runEdit, store]);

  // Group commands
  const groups = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const cmd of commands) {
      if (!map.has(cmd.group)) map.set(cmd.group, []);
      map.get(cmd.group)!.push(cmd);
    }
    return map;
  }, [commands]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {[...groups.entries()].map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((cmd) => (
              <CommandItem
                key={cmd.id}
                onSelect={cmd.action}
                keywords={cmd.keywords}
              >
                <span className="mr-2 text-muted-foreground">{cmd.icon}</span>
                {cmd.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
