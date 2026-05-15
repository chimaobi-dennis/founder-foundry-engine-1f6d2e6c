import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  ChevronDown,
  Pencil,
  RefreshCw,
  Check,
  CalendarPlus,
  MoreHorizontal,
  Sparkles,
  Loader2,
  Calendar as CalendarIcon,
  Download,
  Copy as CopyIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasItem } from "../CanvasSwitcher";
import { CanvasGenerating } from "./CanvasGenerating";
import { CanvasFailed } from "./CanvasFailed";
import { PlatformOverlay } from "./PlatformOverlay";
import {
  applyTypographyNormalization,
  getPreviewPadding,
  type PlatformConfig,
} from "@/lib/platformRenderer";

interface ScheduleInfo {
  calendarPostId: string;
  date: string;
  time: string;
}

interface Props {
  briefName: string;
  readyCount: number;
  totalCount: number;
  canvases: CanvasItem[];
  activeCanvasId: string | null;
  onSelectCanvas: (id: string) => void;
  onClose: () => void;

  onChangeCopy: (patch: Partial<CanvasItem>) => void;
  onSaveCopy: (patch: Partial<CanvasItem>) => void;
  onRegenerateVisual: () => void;
  regenerating?: boolean;
  onApproveActive: () => void;
  onSkipActive?: () => void;
  activeSchedule?: ScheduleInfo | null;
  onRescheduleActive?: () => void;
  onRemoveScheduleActive?: () => void;
  onApproveAll?: () => void;
  approvingAll?: boolean;
  allApproved?: boolean;

  errorBanner?: React.ReactNode;
  /** True while the user has tapped "Try again" and a fresh generation cycle is in flight. */
  retrying?: boolean;
}

type Sheet = null | "copy" | "platforms" | "more";

const BASE_DOCK_CLEARANCE = 28;

function formatScheduleLabel(info: ScheduleInfo) {
  try {
    const [y, m, d] = info.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${info.time}`;
  } catch {
    return `${info.date} · ${info.time}`;
  }
}

export function ContentStudioMobile(props: Props) {
  const {
    briefName,
    readyCount,
    totalCount,
    canvases,
    activeCanvasId,
    onSelectCanvas,
    onClose,
    onChangeCopy,
    onSaveCopy,
    onRegenerateVisual,
    regenerating,
    onApproveActive,
    activeSchedule,
    onRescheduleActive,
    onRemoveScheduleActive,
    onApproveAll,
    approvingAll,
    allApproved,
    errorBanner,
  } = props;

  const [sheet, setSheet] = useState<Sheet>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [viewportMetrics, setViewportMetrics] = useState({ height: 0, bottomInset: 0 });

  const active = canvases.find((c) => c.id === activeCanvasId) || canvases[0];
  const w = active?.canvasWidth || 600;
  const h = active?.canvasHeight || 600;

  // Recompute the stage size on resize so the preview always fills naturally.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const recalc = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mobile browser chrome can overlay the layout viewport. Track the visual
  // viewport so the dock stays above system/browser UI on iOS, Android, and in-app browsers.
  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      const visualViewport = window.visualViewport;
      const visualHeight = visualViewport?.height ?? window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      const hiddenBottom = Math.max(0, window.innerHeight - visualHeight - offsetTop);

      setViewportMetrics({
        height: Math.round(visualHeight),
        bottomInset: Math.ceil(hiddenBottom),
      });
    };

    const scheduleMeasure = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("scroll", scheduleMeasure);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("scroll", scheduleMeasure);
    };
  }, []);

  const platformCfg = (active?.platformConfig as PlatformConfig | undefined) || null;

  const scale = useMemo(() => {
    if (!stageSize.w || !stageSize.h) return 0.5;
    // Platform-aware padding: occupancy_target controls how much breathing
    // room the preview keeps around the creative.
    const pad = getPreviewPadding(platformCfg);
    const isVertical = h > w;
    const padX = Math.max(8, isVertical ? Math.round(pad.x * 0.6) : pad.x);
    const padY = Math.max(8, isVertical ? Math.round(pad.y * 0.6) : pad.y);
    return Math.max(
      0.1,
      Math.min((stageSize.w - padX * 2) / w, (stageSize.h - padY * 2) / h),
    );
  }, [stageSize.w, stageSize.h, w, h, platformCfg]);

  const normalizedHtml = useMemo(
    () => applyTypographyNormalization(active?.html || "", platformCfg),
    [active?.html, platformCfg],
  );

  const status = active?.status || "ready";
  const isGenerating = status === "generating";
  const isFailed = status === "failed";
  const isApproved = !!active?.isApproved || status === "approved" || status === "scheduled";

  const closeSheet = () => setSheet(null);
  const shellHeight = viewportMetrics.height ? `${viewportMetrics.height}px` : "100svh";
  const dockBottomInset = `max(env(safe-area-inset-bottom, 0px), ${viewportMetrics.bottomInset}px)`;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{
        background: "hsl(var(--background))",
        height: shellHeight,
        minHeight: "100svh",
        maxHeight: shellHeight,
        overflow: "hidden",
      }}
    >
      {/* TOP BAR — minimal */}
      <div
        className="flex-shrink-0 flex items-center justify-between gap-2 px-3"
        style={{
          height: 48,
          borderBottom: "1px solid hsl(var(--border) / 0.6)",
          background: "hsl(var(--card) / 0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-foreground hover:bg-muted/40 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="font-display text-[14px] leading-tight text-foreground truncate">
            {briefName}
          </p>
          <p className="font-ui text-[10px] text-muted-foreground tracking-wide mt-0.5">
            {readyCount} of {totalCount} ready
          </p>
        </div>
        <button
          onClick={onApproveAll}
          disabled={approvingAll || !onApproveAll}
          className={cn(
            "h-9 px-3 rounded-full text-[11px] font-ui font-medium flex items-center gap-1 transition-colors",
            allApproved
              ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/30"
              : "text-foreground bg-transparent border border-border/70 hover:bg-muted/40",
          )}
        >
          {approvingAll ? (
            <Loader2 size={12} className="animate-spin" />
          ) : allApproved ? (
            <Check size={12} />
          ) : null}
          {allApproved ? "Approved" : "Approve all"}
        </button>
      </div>

      {errorBanner}

      {/* PLATFORM SEGMENT — horizontal scroll pills */}
      <div
        className="flex-shrink-0 overflow-x-auto"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          borderBottom: "1px solid hsl(var(--border) / 0.4)",
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 w-max">
          {canvases.map((c) => {
            const sel = c.id === activeCanvasId;
            return (
              <button
                key={c.id}
                onClick={() => onSelectCanvas(c.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 h-9 px-3.5 rounded-full text-[12px] font-ui transition-all",
                  sel
                    ? "bg-foreground text-background"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: c.platformIcon || "#8A96A3" }}
                />
                <span className="whitespace-nowrap">{c.label}</span>
                {(c.isApproved || c.status === "approved" || c.status === "scheduled") && (
                  <Check size={11} className={sel ? "opacity-80" : "text-emerald-500"} />
                )}
                {c.status === "failed" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E05C5C]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* HERO STAGE — creative dominates */}
      <div
        ref={stageRef}
        className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden"
        style={{ background: "hsl(var(--muted) / 0.25)" }}
      >
        {/* subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, hsl(var(--primary) / 0.06), transparent 65%)",
          }}
        />

        {isGenerating ? (
          <CanvasGenerating
            platformName={active?.label || "Platform"}
            width={w}
            height={h}
            scale={scale}
          />
        ) : isFailed ? (
          <CanvasFailed
            width={w}
            height={h}
            zoom={scale}
            onRetry={onRegenerateVisual}
          />
        ) : (
          <div
            className="relative overflow-hidden rounded-md shadow-2xl"
            style={{
              width: w * scale,
              height: h * scale,
              background: "#fff",
              boxShadow: "0 30px 60px -20px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                width: w,
                height: h,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              dangerouslySetInnerHTML={{ __html: normalizedHtml }}
            />
            <PlatformOverlay
              platform={platformCfg}
              width={w}
              height={h}
              zoom={scale}
              compact
            />
          </div>
        )}

        {/* Contextual intelligence caption */}
        {!isGenerating && !isFailed && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              background: "hsl(var(--card) / 0.7)",
              backdropFilter: "blur(6px)",
              border: "1px solid hsl(var(--border) / 0.5)",
            }}
          >
            <Sparkles size={10} className="text-primary" />
            <span className="font-ui text-[10px] tracking-wide text-muted-foreground">
              Generated from your Brand DNA
            </span>
          </div>
        )}
      </div>

      {/* BOTTOM DOCK */}
      <div
        className="flex-shrink-0 px-3 pt-2.5"
        style={{
          paddingBottom: `calc(${dockBottomInset} + ${BASE_DOCK_CLEARANCE}px)`,
        }}
      >
        <div
          className="grid grid-cols-5 gap-1 rounded-2xl px-1.5 py-2 shadow-2xl"
          style={{
            background: "hsl(var(--card) / 0.94)",
            backdropFilter: "blur(16px)",
            border: "1px solid hsl(var(--border) / 0.7)",
            boxShadow: "0 18px 45px -24px hsl(var(--foreground) / 0.45)",
          }}
        >
          <DockButton
            icon={<Pencil size={18} />}
            label="Edit copy"
            onClick={() => setSheet("copy")}
            disabled={isGenerating || isFailed}
          />
          <DockButton
            icon={
              regenerating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )
            }
            label="Regenerate"
            onClick={onRegenerateVisual}
            disabled={isGenerating || regenerating}
          />
          <DockButton
            icon={<Check size={18} />}
            label={isApproved ? "Approved" : "Approve"}
            onClick={onApproveActive}
            disabled={isGenerating || isFailed}
            highlight={isApproved}
          />
          <DockButton
            icon={<CalendarPlus size={18} />}
            label={activeSchedule ? "Reschedule" : "Schedule"}
            onClick={activeSchedule ? onRescheduleActive : onApproveActive}
            disabled={isGenerating || isFailed}
          />
          <DockButton
            icon={<MoreHorizontal size={18} />}
            label="More"
            onClick={() => setSheet("more")}
          />
        </div>
      </div>

      {/* BOTTOM SHEET — Copy editor */}
      <BottomSheet
        open={sheet === "copy"}
        onClose={closeSheet}
        title={`Edit copy · ${active?.label || ""}`}
      >
        {active && (
          <CopySheetContent
            canvas={active}
            onChange={onChangeCopy}
            onSave={onSaveCopy}
            onRegenerateVisual={() => {
              closeSheet();
              onRegenerateVisual();
            }}
            regenerating={regenerating}
            onApproveClick={() => {
              closeSheet();
              onApproveActive();
            }}
            schedule={activeSchedule}
          />
        )}
      </BottomSheet>

      {/* BOTTOM SHEET — More */}
      <BottomSheet open={sheet === "more"} onClose={closeSheet} title="More">
        <div className="space-y-1 px-1 pb-2">
          {activeSchedule && (
            <SheetRow
              icon={<CalendarIcon size={16} className="text-primary" />}
              label={`Scheduled · ${formatScheduleLabel(activeSchedule)}`}
              sublabel="Tap to reschedule or remove"
              onClick={() => {
                closeSheet();
                onRescheduleActive?.();
              }}
            />
          )}
          {activeSchedule && onRemoveScheduleActive && (
            <SheetRow
              icon={<X size={16} className="text-destructive" />}
              label="Remove from calendar"
              onClick={() => {
                closeSheet();
                onRemoveScheduleActive();
              }}
              danger
            />
          )}
          <SheetRow
            icon={<CopyIcon size={16} />}
            label="Copy text"
            onClick={() => {
              if (active?.copyText) {
                navigator.clipboard?.writeText(active.copyText).catch(() => {});
              }
              closeSheet();
            }}
          />
          <SheetRow
            icon={<Download size={16} />}
            label="Switch to desktop to export"
            sublabel="Full export tools live on the desktop editor"
            disabled
          />
        </div>
      </BottomSheet>
    </div>
  );
}

/* ───────────── Subcomponents ───────────── */

function DockButton({
  icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors",
        "text-muted-foreground active:bg-muted/50 disabled:opacity-40 disabled:active:bg-transparent",
        highlight && "text-emerald-500",
        !highlight && !disabled && "hover:text-foreground",
      )}
    >
      {icon}
      <span className="text-[10px] font-ui leading-none tracking-wide">{label}</span>
    </button>
  );
}

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-[80] bg-black/50 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ backdropFilter: open ? "blur(2px)" : undefined }}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[81] rounded-t-2xl flex flex-col transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          background: "hsl(var(--card))",
          maxHeight: "92vh",
          height: "92vh",
          borderTop: "1px solid hsl(var(--border))",
          boxShadow: "0 -20px 50px -10px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex-shrink-0 flex flex-col items-center pt-2 pb-1">
          <span className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2">
          <p className="font-ui text-[13px] font-medium text-foreground truncate">
            {title}
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Close sheet"
          >
            <ChevronDown size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

function CopySheetContent({
  canvas,
  onChange,
  onSave,
  onRegenerateVisual,
  regenerating,
  onApproveClick,
  schedule,
}: {
  canvas: CanvasItem;
  onChange: (patch: Partial<CanvasItem>) => void;
  onSave: (patch: Partial<CanvasItem>) => void;
  onRegenerateVisual: () => void;
  regenerating?: boolean;
  onApproveClick: () => void;
  schedule?: ScheduleInfo | null;
}) {
  const isEmail = canvas.platformSlug === "email";
  const isSocial = ["instagram", "twitter_x", "facebook_ad"].includes(
    canvas.platformSlug || "",
  );
  const charCount = (canvas.copyText || "").length;
  const wordCount = (canvas.copyText || "").trim().split(/\s+/).filter(Boolean).length;
  const limit = canvas.characterLimit || null;

  const handle = (field: keyof CanvasItem, value: any) => onChange({ [field]: value });
  const handleSave = (field: keyof CanvasItem, value: any) => onSave({ [field]: value });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-5">
        {isEmail && (
          <Field label="Subject line">
            <input
              defaultValue={canvas.subjectLine || ""}
              onChange={(e) => handle("subjectLine", e.target.value)}
              onBlur={(e) => handleSave("subjectLine", e.target.value)}
              className="w-full h-12 rounded-lg border border-input bg-background px-3 text-[15px] font-ui"
            />
          </Field>
        )}
        <Field label="Headline">
          <input
            defaultValue={canvas.headline || ""}
            onChange={(e) => handle("headline", e.target.value)}
            onBlur={(e) => handleSave("headline", e.target.value)}
            className="w-full h-12 rounded-lg border border-input bg-background px-3 text-[15px] font-ui"
          />
        </Field>
        <Field label="Copy">
          <textarea
            defaultValue={canvas.copyText || ""}
            onChange={(e) => handle("copyText", e.target.value)}
            onBlur={(e) => handleSave("copyText", e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-input bg-background px-3 py-3 text-[15px] leading-relaxed font-ui resize-none"
          />
          <div className="flex items-center justify-between mt-2 text-[11px] font-ui text-muted-foreground">
            <span>{wordCount} words</span>
            <span className={cn(limit && charCount > limit && "text-destructive")}>
              {charCount}
              {limit ? ` / ${limit}` : ""} chars
            </span>
          </div>
        </Field>
        {isSocial && (canvas.hashtags?.length ?? 0) > 0 && (
          <Field label="Hashtags">
            <div className="flex flex-wrap gap-1.5">
              {(canvas.hashtags || []).map((h, i) => (
                <span
                  key={i}
                  className="text-[12px] font-ui px-2.5 py-1 rounded-full bg-primary/10 text-primary"
                >
                  #{h.replace(/^#/, "")}
                </span>
              ))}
            </div>
          </Field>
        )}
      </div>

      {/* Sticky actions */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{
          borderTop: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
        }}
      >
        <button
          onClick={onRegenerateVisual}
          disabled={regenerating}
          className="h-12 px-4 rounded-lg border border-border text-[13px] font-ui hover:bg-muted/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Regenerate
        </button>
        <button
          onClick={onApproveClick}
          className="flex-1 h-12 rounded-lg bg-primary text-primary-foreground text-[14px] font-ui font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
        >
          <CalendarPlus size={15} />
          {schedule ? "Reschedule" : "Approve & schedule"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-ui font-medium text-muted-foreground uppercase tracking-[0.1em] mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function SheetRow({
  icon,
  label,
  sublabel,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
        disabled ? "opacity-40" : "active:bg-muted/40",
        danger && "text-destructive",
      )}
    >
      <span className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/40 flex-shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-ui text-foreground">{label}</span>
        {sublabel && (
          <span className="block text-[11px] font-ui text-muted-foreground mt-0.5">
            {sublabel}
          </span>
        )}
      </span>
    </button>
  );
}
