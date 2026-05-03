import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Save,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Image as ImageIcon,
  Square,
  Circle as CircleIcon,
  Layers as LayersIcon,
  MousePointer2,
  Hand,
  Maximize2,
  GripVertical,
  Check,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { saveOutputToLibrary } from "@/services/templateService";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SaveFormatModal, type SaveFormat } from "./SaveFormatModal";
import { ExportModal, type ExportPlatform } from "./ExportModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/hooks/use-theme";
import { CanvasSwitcher, type CanvasItem } from "./CanvasSwitcher";
import { EditableCanvas } from "./studio/EditableCanvas";
import { ElementsPanel } from "./studio/ElementsPanel";
import {
  TextProperties,
  ImageProperties,
  BackgroundProperties,
  ShapeProperties,
} from "./studio/PropertyPanels";
import { SAMPLE_TEMPLATE_HTML } from "./studio/sampleTemplate";
import type { StudioElement } from "./studio/types";
import { PlatformsPanel } from "./content-studio/PlatformsPanel";
import { CopyPanel } from "./content-studio/CopyPanel";
import { CanvasGenerating } from "./content-studio/CanvasGenerating";
import { CanvasCrossfade } from "./content-studio/CanvasCrossfade";
import { ContentStudioGenerationStrip } from "./content-studio/GenerationStrip";

interface Props {
  open: boolean;
  onClose: () => void;
  templateName: string;
  variationHtml: string | null;
  variationId: string;
  /** Optional override — if not provided, the studio captures + downloads internally. */
  onDownload?: () => void;
  /** Optional override — if not provided, the studio captures + persists internally. */
  onSaveToLibrary?: () => void;
  brandColors?: string[];
  /** template_outputs.id linked to the active canvas (for save). */
  outputId?: string | null;
  /** Brand id used by Save to Library. */
  brandId?: string | null;
  /** Template id used when Save to Library has to insert a new template_outputs row. */
  templateId?: string | null;
  /** Initially-saved canvas ids (so we can show "Saved ✓" right after entering studio). */
  initiallySavedCanvasIds?: string[];
  // Canvas switcher (universal — also used by ReelBuilder/slides in future)
  canvases?: CanvasItem[];
  activeCanvasId?: string | null;
  onSelectCanvas?: (id: string) => void;
  onAddBlankCanvas?: () => void;
  onAddCanvasFromTemplate?: () => void;
  onDuplicateCanvas?: (id: string) => void;
  onDeleteCanvas?: (id: string) => void;
  onSetMainCanvas?: (id: string) => void;
  /** Mode: 'prostudio' (default) or 'content-studio' */
  mode?: 'prostudio' | 'content-studio';
  /** Brief name for content-studio mode */
  briefName?: string;
  /** Ready count for content-studio mode */
  readyCount?: number;
  /** Total count for content-studio mode */
  totalCount?: number;
  /** Approve all callback for content-studio mode */
  onApproveAll?: () => void;
  /** Export all callback for content-studio mode */
  onExportAll?: () => void;
  /** Save creative callback for content-studio mode (saves to content_studio_creatives) */
  onSaveCreative?: () => void;
  /** Regenerate visual for the active canvas (content-studio mode) */
  onRegenerateVisual?: () => void;
  /** Whether the active canvas is currently regenerating */
  regenerating?: boolean;
  /** Approve the active canvas (content-studio mode) */
  onApproveActive?: () => void;
}

const ICON_FOR_TYPE = {
  background: Square,
  image: ImageIcon,
  text: Type,
  shape: CircleIcon,
} as const;

export function StudioEditor({
  open,
  onClose,
  templateName,
  variationHtml,
  variationId,
  onDownload,
  onSaveToLibrary,
  brandColors,
  outputId,
  brandId,
  templateId,
  initiallySavedCanvasIds,
  canvases,
  activeCanvasId,
  onSelectCanvas,
  onAddBlankCanvas,
  onAddCanvasFromTemplate,
  onDuplicateCanvas,
  onDeleteCanvas,
  onSetMainCanvas,
  mode = 'prostudio',
  briefName,
  readyCount,
  totalCount,
  onApproveAll,
  onExportAll,
  onSaveCreative,
  onRegenerateVisual,
  regenerating,
  onApproveActive,
}: Props) {
  const { theme } = useTheme();
  // For now we always render the sample template; once AI generation is wired
  // we'll prefer variationHtml when present.
  const html = useMemo(
    () => variationHtml && variationHtml.includes("data-element") ? variationHtml : SAMPLE_TEMPLATE_HTML,
    [variationHtml],
  );

  const [elements, setElements] = useState<StudioElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [tempPan, setTempPan] = useState(false); // Space-held temporary pan
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  // Undo/redo: simple stack of stage HTML snapshots
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  // Save / export modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  // Intrinsic canvas size — detected from injected HTML so the stage matches
  // exactly what the AI generated (no stretching).
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 600,
  });
  // Fit-to-screen scale for content-studio mode
  const [fitScale, setFitScale] = useState(0.7);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Left panel tab (LAYERS | ELEMENTS) for prostudio, (PLATFORMS | LAYERS) for content-studio
  const [leftTab, setLeftTab] = useState<"layers" | "elements" | "platforms">("layers");
  // Right panel tab (COPY | DESIGN) for content-studio mode
  const [rightTab, setRightTab] = useState<"copy" | "design">("copy");

  // Unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => setHasUnsavedChanges(false), 1200);
  }, []);

  // Reset on reopen
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setZoom(0.7);
      setFitScale(0.7);
      setHasUnsavedChanges(false);
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    }
  }, [open, variationId]);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
  }, []);

  // Update canvas size per platform in content-studio mode
  useEffect(() => {
    if (mode === 'content-studio' && canvases && activeCanvasId) {
      const activeCanvas = canvases.find(c => c.id === activeCanvasId);
      if (activeCanvas && activeCanvas.canvasWidth && activeCanvas.canvasHeight) {
        setCanvasSize({
          width: activeCanvas.canvasWidth,
          height: activeCanvas.canvasHeight
        });
      }
    }
  }, [mode, canvases, activeCanvasId]);

  // Calculate fit-to-screen scale — recompute on container resize so the
  // canvas always shrinks to fit with no extra white space below.
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const recalc = () => {
      const availableWidth = container.clientWidth || 800;
      const availableHeight = container.clientHeight || 600;
      const padding = 64;
      const next = Math.min(
        (availableWidth - padding) / canvasSize.width,
        (availableHeight - padding) / canvasSize.height,
      );
      const clamped = Math.max(0.1, Math.min(2, next));
      setFitScale(clamped);
      // Auto-fit zoom in content-studio mode (resizable). For prostudio, only
      // set initial fit on first measurement so user zoom is preserved.
      if (mode === "content-studio") setZoom(clamped);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [mode, canvasSize.width, canvasSize.height]);

  // ─── Export / Save to Library — internal (html2canvas + storage) ────────
  const stageHostElRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCanvasIds, setSavedCanvasIds] = useState<Set<string>>(
    () => new Set(initiallySavedCanvasIds || []),
  );

  const isCurrentSaved = !!activeCanvasId && savedCanvasIds.has(activeCanvasId);

  /** Capture the inner stage (data-studio-stage > scaled child) at full resolution. */
  const captureStage = useCallback(async (scale: number): Promise<string | null> => {
    const host = stageHostElRef.current;
    if (!host) return null;
    // The actual stage we want to capture is the inner div with scale transform.
    // Temporarily neutralize the transform so html2canvas captures intrinsic px.
    const inner = host.querySelector<HTMLElement>("div[style*='transform: scale']");
    const target: HTMLElement = inner || host;
    const originalTransform = target.style.transform;
    const originalWidth = host.style.width;
    const originalHeight = host.style.height;
    try {
      target.style.transform = "scale(1)";
      // Match the host to intrinsic size so it doesn't crop the un-scaled content
      host.style.width = `${canvasSize.width}px`;
      host.style.height = `${canvasSize.height}px`;
      const canvas = await html2canvas(target, {
        width: canvasSize.width,
        height: canvasSize.height,
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL("image/png");
    } finally {
      target.style.transform = originalTransform;
      host.style.width = originalWidth;
      host.style.height = originalHeight;
    }
  }, [canvasSize.width, canvasSize.height]);


  /** Render arbitrary HTML at given intrinsic dimensions to a canvas. Used for multi-platform export. */
  const renderHtmlToCanvas = useCallback(async (htmlStr: string, w: number, h: number, scale = 2): Promise<HTMLCanvasElement> => {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;height:${h}px;overflow:hidden;background:#fff;`;
    wrapper.innerHTML = `<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}div[data-export-root]>*{width:100%!important;height:100%!important;box-sizing:border-box;}</style><div data-export-root style="width:${w}px;height:${h}px;">${htmlStr || ""}</div>`;
    document.body.appendChild(wrapper);
    try {
      const target = wrapper.querySelector<HTMLElement>("div[data-export-root]") || wrapper;
      const canvas = await html2canvas(target, {
        width: w, height: h, scale, backgroundColor: "#ffffff", useCORS: true, logging: false,
      });
      return canvas;
    } finally {
      wrapper.remove();
    }
  }, []);

  const slugify = (s: string) => (s || "design").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const downloadFromCanvas = (canvas: HTMLCanvasElement, name: string, format: SaveFormat) => {
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const ext = format === "jpeg" ? "jpg" : "png";
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${name}.${ext}`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mime, 0.92);
  };

  const handleExportConfirm = useCallback(async (selectedIds: string[], format: SaveFormat) => {
    setIsExporting(true);
    setExportProgress({});
    const safeName = slugify(briefName || templateName);
    try {
      const items = (canvases || []).filter((c) => selectedIds.includes(c.id));
      const work = items.length > 0
        ? items.map((c) => ({ id: c.id, name: c.label || c.id, html: c.html || "", w: c.canvasWidth || canvasSize.width, h: c.canvasHeight || canvasSize.height }))
        : [{ id: variationId || "current", name: templateName || "design", html: variationHtml || "", w: canvasSize.width, h: canvasSize.height }];

      const rendered: { id: string; name: string; canvas: HTMLCanvasElement }[] = [];
      for (const it of work) {
        const canvas = await renderHtmlToCanvas(it.html, it.w, it.h, 2);
        rendered.push({ id: it.id, name: slugify(it.name), canvas });
        setExportProgress((p) => ({ ...p, [it.id]: 1 }));
      }

      if (format === "pdf") {
        const first = rendered[0].canvas;
        const pdf = new jsPDF({ orientation: first.width >= first.height ? "l" : "p", unit: "px", format: [first.width, first.height] });
        rendered.forEach((r, i) => {
          if (i > 0) pdf.addPage([r.canvas.width, r.canvas.height], r.canvas.width >= r.canvas.height ? "l" : "p");
          pdf.addImage(r.canvas.toDataURL("image/png"), "PNG", 0, 0, r.canvas.width, r.canvas.height);
        });
        pdf.save(`${safeName}.pdf`);
      } else if (rendered.length === 1) {
        downloadFromCanvas(rendered[0].canvas, `${safeName}-${rendered[0].name}`, format);
      } else {
        const zip = new JSZip();
        const mime = format === "jpeg" ? "image/jpeg" : "image/png";
        const ext = format === "jpeg" ? "jpg" : "png";
        for (const r of rendered) {
          const blob: Blob = await new Promise((res) => r.canvas.toBlob((b) => res(b!), mime, 0.92));
          zip.file(`${safeName}-${r.name}.${ext}`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.download = `${safeName}.zip`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setExportModalOpen(false);
    } catch (e: any) {
      console.error("Export failed:", e);
      toast({ title: "Export failed", description: e?.message || "Could not export.", variant: "destructive" });
    } finally {
      setIsExporting(false);
      setExportProgress({});
    }
  }, [canvases, variationId, variationHtml, templateName, briefName, canvasSize.width, canvasSize.height, renderHtmlToCanvas]);

  const handleExport = useCallback(() => {
    if (onDownload) { onDownload(); return; }
    setExportModalOpen(true);
  }, [onDownload]);

  const performSave = useCallback(async (format: SaveFormat) => {
    if (mode === 'content-studio' && onSaveCreative) {
      onSaveCreative();
      setHasUnsavedChanges(false);
      setSaveModalOpen(false);
      return;
    }
    if (onSaveToLibrary) {
      onSaveToLibrary();
      setHasUnsavedChanges(false);
      setSaveModalOpen(false);
      return;
    }
    if (!brandId) {
      toast({ title: "No active brand", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const result = await saveOutputToLibrary({
        outputId: outputId || null,
        brandId,
        templateId: templateId || null,
        outputHtml: variationHtml || "",
        dimensions: { width: canvasSize.width, height: canvasSize.height },
      });
      if (result.error) {
        toast({ title: "Save failed", description: result.error, variant: "destructive" });
        return;
      }
      if (activeCanvasId) {
        setSavedCanvasIds(prev => { const next = new Set(prev); next.add(activeCanvasId); return next; });
      }
      setHasUnsavedChanges(false);
      toast({ title: `Saved to Library (${format.toUpperCase()})` });
      setSaveModalOpen(false);
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({ title: "Save failed", description: e?.message || "Could not save.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [mode, onSaveCreative, onSaveToLibrary, brandId, outputId, templateId, variationHtml, canvasSize.width, canvasSize.height, activeCanvasId]);

  const handleSaveToLibrary = useCallback(() => {
    setSaveModalOpen(true);
  }, []);

  const attemptClose = useCallback(() => {
    if (hasUnsavedChanges) setConfirmOpen(true);
    else onClose();
  }, [hasUnsavedChanges, onClose]);

  const handleSaveAndExit = () => {
    setSaveModalOpen(true);
  };
  const handleDiscardAndExit = () => {
    setHasUnsavedChanges(false);
    setConfirmOpen(false);
    onClose();
  };

  // ── Undo / Redo ─────────────────────────────────────────────────────
  const snapshotStage = useCallback(() => {
    const stage = document.querySelector<HTMLElement>("[data-studio-stage] > div[style*='transform']");
    return stage ? stage.innerHTML : null;
  }, []);
  const restoreStage = useCallback((s: string) => {
    const stage = document.querySelector<HTMLElement>("[data-studio-stage] > div[style*='transform']");
    if (stage) { stage.innerHTML = s; bumpRefresh(); }
  }, [bumpRefresh]);
  const undo = useCallback(() => {
    const snap = undoStackRef.current.pop();
    if (snap == null) return;
    const cur = snapshotStage();
    if (cur != null) redoStackRef.current.push(cur);
    restoreStage(snap);
    setHistoryTick((t) => t + 1);
  }, [snapshotStage, restoreStage]);
  const redo = useCallback(() => {
    const snap = redoStackRef.current.pop();
    if (snap == null) return;
    const cur = snapshotStage();
    if (cur != null) undoStackRef.current.push(cur);
    restoreStage(snap);
    setHistoryTick((t) => t + 1);
  }, [snapshotStage, restoreStage]);
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;
  void historyTick;

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.tagName === "SELECT");
      if (e.key === "Escape" && !confirmOpen) attemptClose();
      if (inField) return;
      if (e.code === "Space" && !e.repeat) { e.preventDefault(); setTempPan(true); }
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "h" || e.key === "H") setTool("hand");
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault(); redo(); return;
      }
      if ((e.key === "=" || e.key === "+") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setZoom((z) => Math.min(2, z + 0.1));
      }
      if (e.key === "-" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setZoom((z) => Math.max(0.2, z - 0.1));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setTempPan(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [open, attemptClose, confirmOpen, undo, redo]);

  const selected = useMemo(
    () => elements.find((e) => e.id === selectedId) || null,
    [elements, selectedId],
  );

  const getElementState = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      return el ? { visible: el.visible, locked: el.locked } : undefined;
    },
    [elements],
  );

  // ---------- mutators wired to live DOM via canvas stage ----------
  const stageHostRef = useRef<HTMLElement | null>(null);
  const captureStageHost = useCallback((node: HTMLDivElement | null) => {
    // Keep the outer host (sized to canvasSize * zoom) for export captures
    stageHostElRef.current = node;
    if (node) {
      // The stage we actually mutate is the inner div with the injected HTML
      const stage = node.querySelector<HTMLElement>("div[style*='transform: scale']");
      stageHostRef.current = stage;
    }
  }, []);

  // Find by query each call — handles re-renders / html swaps
  const queryEl = useCallback((id: string): HTMLElement | null => {
    const root = document.querySelector<HTMLElement>("[data-studio-stage]");
    if (!root) return null;
    return root.querySelector<HTMLElement>(`[data-studio-id="${CSS.escape(id)}"]`);
  }, []);

  const apply = useCallback(
    (style: Partial<CSSStyleDeclaration> | Record<string, string>) => {
      if (!selectedId) return;
      const el = queryEl(selectedId);
      if (!el) return;
      Object.entries(style).forEach(([k, v]) => {
        if (v == null) return;
        (el.style as unknown as Record<string, string>)[k] = v as string;
      });
      bumpRefresh();
      markDirty();
    },
    [selectedId, queryEl, bumpRefresh, markDirty],
  );

  const applyAttr = useCallback(
    (attrs: Record<string, string>) => {
      if (!selectedId) return;
      const el = queryEl(selectedId);
      if (!el) return;
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      bumpRefresh();
      markDirty();
    },
    [selectedId, queryEl, bumpRefresh, markDirty],
  );

  const read = useCallback(
    (prop: string): string => {
      if (!selectedId) return "";
      const el = queryEl(selectedId);
      if (!el) return "";
      // Prefer inline first, then computed
      const inline = (el.style as unknown as Record<string, string>)[prop];
      if (inline) return inline;
      const cs = window.getComputedStyle(el);
      return (cs as unknown as Record<string, string>)[prop] || "";
    },
    [selectedId, queryEl],
  );

  const readAttr = useCallback(
    (attr: string): string => {
      if (!selectedId) return "";
      const el = queryEl(selectedId);
      return el?.getAttribute(attr) || "";
    },
    [selectedId, queryEl],
  );

  // Layer ops
  const toggleVisibility = (id: string) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)));
    markDirty();
  };
  const toggleLock = (id: string) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, locked: !e.locked } : e)));
    markDirty();
  };

  // Layer reorder via drag — updates DOM z-index
  const dragIdx = useRef<number | null>(null);
  const onLayerDragStart = (idx: number) => () => { dragIdx.current = idx; };
  const onLayerDragOver = (e: React.DragEvent) => e.preventDefault();
  const onLayerDrop = (idx: number) => () => {
    const from = dragIdx.current;
    dragIdx.current = null;
    if (from == null || from === idx) return;
    setElements((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(idx, 0, m);
      // Apply z-index from order (top of list = highest z-index visually means front)
      next.forEach((el, i) => {
        const node = queryEl(el.id);
        if (node) node.style.zIndex = String(next.length - i);
      });
      return next;
    });
    bumpRefresh();
    markDirty();
  };

  // Insert a new element from the Elements panel into the centre of the canvas
  const insertElement = useCallback(
    (htmlSnippet: string) => {
      const stage = document.querySelector<HTMLElement>("[data-studio-stage] > div[style*='transform']");
      if (!stage) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = htmlSnippet.trim();
      const node = wrapper.firstElementChild as HTMLElement | null;
      if (!node) return;
      // Centre on canvas using its inline width/height if specified, else 120px default
      const w = parseFloat((node.style.width || "120").replace("px", "")) || 120;
      const h = parseFloat((node.style.height || "120").replace("px", "")) || 120;
      node.style.position = "absolute";
      node.style.left = `${(canvasSize.width - w) / 2}px`;
      node.style.top = `${(canvasSize.height - h) / 2}px`;
      // Generate a unique studio id (avoid collision with existing ids)
      const base = node.dataset.element || "inserted";
      const existing = stage.querySelectorAll(`[data-studio-id^="${base}-"]`).length;
      const studioId = `${base}-inserted-${existing}-${Date.now().toString(36)}`;
      node.dataset.studioId = studioId;
      if (!node.dataset.element) node.dataset.element = base;
      if (!node.dataset.elementType) node.dataset.elementType = "shape";
      if (!node.dataset.elementName) node.dataset.elementName = "Inserted element";
      stage.appendChild(node);
      // Add to the elements list and select it
      setElements((prev) => [
        {
          id: studioId,
          type: (node.dataset.elementType as StudioElement["type"]) || "shape",
          name: node.dataset.elementName || "Inserted element",
          visible: true,
          locked: false,
        },
        ...prev,
      ]);
      setSelectedId(studioId);
      bumpRefresh();
      markDirty();
    },
    [canvasSize, bumpRefresh, markDirty],
  );

  if (!open) return null;

  const workspaceBg = mode === 'content-studio' ? "#1A1A1A" : (theme === "dark" ? "#1A1A1A" : "#E8E8E8");

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col text-foreground bg-background">
        {/* Top toolbar */}
        <div className="h-12 flex items-center justify-between px-3 border-b border-border flex-shrink-0 bg-card">
          <div className="flex items-center gap-1.5">
            <button
              onClick={attemptClose}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-muted text-foreground"
              title="Close studio"
            >
              <X size={16} />
            </button>
            <div className="w-px h-5 mx-1 bg-border" />
            {mode === 'content-studio' ? (
              <div className="flex items-center gap-2 px-2">
                <span className="text-[12px] font-ui font-medium text-foreground">{briefName || templateName}</span>
                {readyCount !== undefined && totalCount !== undefined && (
                  <span className="text-[11px] font-ui text-muted-foreground">
                    {readyCount} of {totalCount} platforms ready
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2">
                <div className="w-5 h-5 rounded-sm flex items-center justify-center bg-primary">
                  <LayersIcon size={11} className="text-primary-foreground" />
                </div>
                <span className="text-[12px] font-ui font-medium text-foreground">{templateName}</span>
                <span className="text-[11px] font-ui text-muted-foreground">· Studio</span>
                {hasUnsavedChanges && (
                  <span className="text-[10px] font-ui text-primary flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Unsaved
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Center cluster — unified across both modes */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton title="Undo (⌘Z)" onClick={undo} disabled={!canUndo}>
              <Undo2 size={15} />
            </ToolbarButton>
            <ToolbarButton title="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo}>
              <Redo2 size={15} />
            </ToolbarButton>
            <div className="w-px h-5 mx-1.5 bg-border" />
            <ToolbarButton title="Zoom out" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>
              <ZoomOut size={15} />
            </ToolbarButton>
            <button
              className="h-8 px-2.5 text-[11px] font-ui rounded-md transition-colors hover:bg-muted tabular-nums text-foreground"
              style={{ minWidth: 56 }}
              onClick={() => setZoom(mode === "content-studio" ? fitScale : 0.7)}
              title="Fit to screen"
            >
              {Math.round(zoom * 100)}%
            </button>
            <ToolbarButton title="Zoom in" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
              <ZoomIn size={15} />
            </ToolbarButton>
            <div className="w-px h-5 mx-1.5 bg-border" />
            <div className="h-8 px-3 flex items-center text-[11px] font-ui rounded-md tabular-nums text-muted-foreground bg-muted/40">
              {Math.round(canvasSize.width)} × {Math.round(canvasSize.height)} px
            </div>
            {mode === "content-studio" && onApproveAll && (
              <>
                <div className="w-px h-5 mx-1.5 bg-border" />
                <ToolbarButton title="Approve all" onClick={onApproveAll}>
                  <Check size={13} />
                </ToolbarButton>
              </>
            )}
          </div>

          {/* Right cluster — Export + Save (both modes) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="h-8 px-3 rounded-md text-[12px] font-ui font-medium flex items-center gap-1.5 transition-colors hover:bg-muted text-foreground border border-border disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <><span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" /> Exporting…</>
              ) : (
                <><Download size={13} /> Export</>
              )}
            </button>
            {mode !== "content-studio" && isCurrentSaved ? (
              <button disabled className="h-8 px-3.5 rounded-md text-[12px] font-ui font-semibold flex items-center gap-1.5 border border-primary/40 text-primary opacity-90 cursor-default">
                <Check size={13} /> Saved
              </button>
            ) : (
              <button
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                className="h-8 px-3.5 rounded-md text-[12px] font-ui font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 bg-primary text-primary-foreground disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <><span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" /> Saving…</>
                ) : (
                  <><Save size={13} /> Save to Library</>
                )}
              </button>
            )}
          </div>
        </div>


        {/* Workspace */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel: Content Studio Platforms/Layers or ProStudio Layers/Elements */}
          {mode === 'content-studio' && canvases ? (
            <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-border bg-card">
              <div className="h-9 flex items-stretch border-b border-border flex-shrink-0">
                {(["platforms", "layers"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLeftTab(tab)}
                    className={cn(
                      "flex-1 text-[10px] font-ui font-semibold uppercase tracking-[0.08em] transition-colors relative",
                      leftTab === tab
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab === "platforms" ? "Platforms" : "Layers"}
                    {leftTab === tab && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              {leftTab === "platforms" ? (
                <PlatformsPanel
                  canvases={canvases}
                  activeId={activeCanvasId}
                  onSelect={onSelectCanvas || (() => {})}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0">
                    <span className="text-[10px] font-ui text-muted-foreground">{elements.length} layers</span>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {elements.map((el, idx) => {
                      const Icon = ICON_FOR_TYPE[el.type];
                      const sel = selectedId === el.id;
                      return (
                        <div
                          key={el.id}
                          draggable
                          onDragStart={onLayerDragStart(idx)}
                          onDragOver={onLayerDragOver}
                          onDrop={onLayerDrop(idx)}
                          onClick={() => !el.locked && setSelectedId(el.id)}
                          className={cn(
                            "group flex items-center gap-2 mx-1.5 my-0.5 px-2 py-1.5 rounded-md transition-colors border-l-2",
                            el.locked ? "cursor-not-allowed" : "cursor-pointer",
                            sel ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/60",
                          )}
                        >
                          <GripVertical size={11} className="text-muted-foreground opacity-40" />
                          <Icon size={13} className={cn("flex-shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn(
                            "text-[12px] font-ui flex-1 truncate",
                            el.visible ? "text-foreground" : "text-muted-foreground opacity-60",
                          )}>{el.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(el.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
                            title={el.visible ? "Hide" : "Show"}
                          >
                            {el.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLock(el.id); }}
                            className={cn(
                              "transition-opacity p-0.5",
                              el.locked
                                ? "opacity-100 text-primary"
                                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground",
                            )}
                            title={el.locked ? "Unlock" : "Lock"}
                          >
                            {el.locked ? <Lock size={11} /> : <Unlock size={11} />}
                          </button>
                        </div>
                      );
                    })}
                    {elements.length === 0 && (
                      <p className="text-[11px] font-ui text-muted-foreground text-center px-4 py-6">
                        No editable elements detected
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-border bg-card">
              <div className="h-9 flex items-stretch border-b border-border flex-shrink-0">
                {(["layers", "elements"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLeftTab(tab)}
                    className={cn(
                      "flex-1 text-[10px] font-ui font-semibold uppercase tracking-[0.08em] transition-colors relative",
                      leftTab === tab
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab === "layers" ? "Layers" : "Elements"}
                    {leftTab === tab && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {leftTab === "layers" ? (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0">
                    <span className="text-[10px] font-ui text-muted-foreground">{elements.length} layers</span>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {elements.map((el, idx) => {
                      const Icon = ICON_FOR_TYPE[el.type];
                      const sel = selectedId === el.id;
                      return (
                        <div
                          key={el.id}
                          draggable
                          onDragStart={onLayerDragStart(idx)}
                          onDragOver={onLayerDragOver}
                          onDrop={onLayerDrop(idx)}
                          onClick={() => !el.locked && setSelectedId(el.id)}
                          className={cn(
                            "group flex items-center gap-2 mx-1.5 my-0.5 px-2 py-1.5 rounded-md transition-colors border-l-2",
                            el.locked ? "cursor-not-allowed" : "cursor-pointer",
                            sel ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/60",
                          )}
                        >
                          <GripVertical size={11} className="text-muted-foreground opacity-40" />
                          <Icon size={13} className={cn("flex-shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn(
                            "text-[12px] font-ui flex-1 truncate",
                            el.visible ? "text-foreground" : "text-muted-foreground opacity-60",
                          )}>{el.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(el.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground"
                            title={el.visible ? "Hide" : "Show"}
                          >
                            {el.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLock(el.id); }}
                            className={cn(
                              "transition-opacity p-0.5",
                              el.locked
                                ? "opacity-100 text-primary"
                                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground",
                            )}
                            title={el.locked ? "Unlock" : "Lock"}
                          >
                            {el.locked ? <Lock size={11} /> : <Unlock size={11} />}
                          </button>
                        </div>
                      );
                    })}
                    {elements.length === 0 && (
                      <p className="text-[11px] font-ui text-muted-foreground text-center px-4 py-6">
                        No editable elements detected
                      </p>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] font-ui text-muted-foreground">Auto-detected</span>
                    <span className="text-[10px] font-ui px-1.5 py-0.5 rounded bg-primary/10 text-primary">Beta</span>
                  </div>
                </>
              ) : (
                <ElementsPanel onInsert={insertElement} />
              )}
            </div>
          )}

          {/* Canvas */}
          <div
            className="flex-1 min-w-0 flex flex-col relative"
            style={{
              backgroundColor: workspaceBg,
              backgroundImage:
                theme === "dark"
                  ? "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)"
                  : "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          >
            <div className="absolute left-3 top-3 flex flex-col gap-1 p-1 rounded-lg z-10 bg-card border border-border shadow-sm">
              <ToolButton active={tool === "select"} onClick={() => setTool("select")} title="Select (V)">
                <MousePointer2 size={14} />
              </ToolButton>
              <ToolButton active={tool === "hand"} onClick={() => setTool("hand")} title="Pan (H)">
                <Hand size={14} />
              </ToolButton>
            </div>

            {/* Generation progress strip — sits between toolbar and canvas.
                Collapses to height 0 when nothing is generating, so the
                toolbar (zoom controls, dimensions, download/approve) is
                never overlapped. */}
            {mode === 'content-studio' && (
              <ContentStudioGenerationStrip
                canvases={canvases || []}
                activeCanvasId={activeCanvasId || null}
                regenerating={!!regenerating}
              />
            )}

            <div
              ref={canvasContainerRef}
              className="flex-1 flex items-center justify-center relative"
              style={{
                minHeight: 0,
                background: "#111111",
                overflow: "hidden",
              }}
            >
              {(() => {
                const activeCanvas = mode === 'content-studio' && canvases && activeCanvasId
                  ? canvases.find(c => c.id === activeCanvasId)
                  : null;
                const isGenerating = activeCanvas?.status === "generating" || (mode === 'content-studio' && regenerating);
                const hasHtml = !!html;

                return (
                  <CanvasCrossfade
                    canvasId={activeCanvasId || variationId || "default"}
                    isGenerating={!!isGenerating}
                    hasHtml={hasHtml}
                    platformName={activeCanvas?.label || "Canvas"}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    zoom={zoom}
                  >
                    <div
                      ref={captureStageHost}
                      data-studio-stage
                      className="relative flex-shrink-0"
                      style={{
                        width: canvasSize.width * zoom,
                        height: canvasSize.height * zoom,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-sm pointer-events-none z-10"
                        style={{
                          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.4), 0 0 0 1px hsl(var(--primary) / 0.15)",
                        }}
                      />
                      <EditableCanvas
                        html={html}
                        zoom={zoom}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onElementsParsed={setElements}
                        onElementMutated={() => { bumpRefresh(); markDirty(); }}
                        onIntrinsicSize={setCanvasSize}
                        getElementState={getElementState}
                        refreshKey={refreshKey}
                        forceFillStage={mode === 'content-studio'}
                      />
                    </div>
                  </CanvasCrossfade>
                );
              })()}
            </div>

            <div className="h-7 flex items-center justify-between px-3 border-t border-border text-[10px] font-ui flex-shrink-0 text-muted-foreground bg-card">
              <div className="flex items-center gap-3">
                <span>Tool: <span className="text-foreground">{tool === "select" ? "Select" : "Pan"}</span></span>
                {selected && <span>Selected: <span className="text-foreground">{selected.name}</span></span>}
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span>{elements.length} layers</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Properties or Copy Panel */}
          {mode === 'content-studio' && canvases && activeCanvasId ? (
            <div className="w-[340px] flex-shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
              <div className="h-9 flex items-stretch border-b border-border flex-shrink-0 sticky top-0 z-10 bg-card">
                {(["copy", "design"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={cn(
                      "flex-1 text-[10px] font-ui font-semibold uppercase tracking-[0.08em] transition-colors relative",
                      rightTab === tab
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab === "copy" ? "Copy" : "Design"}
                    {rightTab === tab && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              {rightTab === "copy" ? (
                <CopyPanel
                  canvas={canvases.find(c => c.id === activeCanvasId) || canvases[0]}
                  onRegenerateVisual={onRegenerateVisual}
                  regenerating={regenerating}
                  onApproveClick={onApproveActive}
                  isApproved={!!(canvases.find(c => c.id === activeCanvasId)?.isApproved)}
                />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 pr-4 py-4 space-y-5">
                  {!selected ? (
                    <div className="text-center py-10">
                      <Maximize2 size={20} className="mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-[11px] font-ui text-muted-foreground">
                        Select an element on the canvas to edit its properties
                      </p>
                    </div>
                  ) : selected.type === "text" ? (
                    <TextProperties
                      key={selected.id}
                      apply={apply}
                      read={read}
                      brandColors={brandColors}
                    />
                  ) : selected.type === "image" ? (
                    <ImageProperties
                      key={selected.id}
                      apply={apply}
                      applyAttr={applyAttr}
                      read={read}
                      readAttr={readAttr}
                    />
                  ) : selected.type === "background" ? (
                    <BackgroundProperties
                      key={selected.id}
                      apply={apply}
                      read={read}
                      brandColors={brandColors}
                    />
                  ) : (
                    <ShapeProperties
                      key={selected.id}
                      apply={apply}
                      read={read}
                      brandColors={brandColors}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="w-[280px] flex-shrink-0 flex flex-col border-l border-border bg-card">
              <div className="h-9 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
                <span className="text-[10px] font-ui font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Properties
                </span>
                {selected && (
                  <span className="text-[10px] font-ui truncate max-w-[140px] text-foreground">{selected.name}</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {!selected ? (
                  <div className="text-center py-10">
                    <Maximize2 size={20} className="mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-[11px] font-ui text-muted-foreground">
                      Select an element on the canvas to edit its properties
                    </p>
                  </div>
                ) : selected.type === "text" ? (
                  <TextProperties
                    key={selected.id}
                    apply={apply}
                    read={read}
                    brandColors={brandColors}
                  />
                ) : selected.type === "image" ? (
                  <ImageProperties
                    key={selected.id}
                    apply={apply}
                    applyAttr={applyAttr}
                    read={read}
                    readAttr={readAttr}
                  />
                ) : selected.type === "background" ? (
                  <BackgroundProperties
                    key={selected.id}
                    apply={apply}
                    read={read}
                    brandColors={brandColors}
                  />
                ) : (
                  <ShapeProperties
                    key={selected.id}
                    apply={apply}
                    read={read}
                    brandColors={brandColors}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Canvas switcher */}
        {canvases && canvases.length > 0 && activeCanvasId && onSelectCanvas && (
          <CanvasSwitcher
            canvases={canvases}
            activeId={activeCanvasId}
            onSelect={onSelectCanvas}
            onAddBlank={onAddBlankCanvas}
            onAddFromTemplate={onAddCanvasFromTemplate}
            onDuplicate={onDuplicateCanvas}
            onDelete={onDeleteCanvas}
            onSetMain={onSetMainCanvas}
          />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="z-[110]">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              onClick={handleDiscardAndExit}
              className="h-10 rounded-md px-4 text-[13px] font-ui font-medium border border-border text-foreground hover:bg-muted transition-colors"
            >
              Discard & Exit
            </button>
            <AlertDialogAction onClick={handleSaveAndExit}>Save & Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* =============================== UI bits =============================== */

function ToolbarButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function ToolButton({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
        active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
