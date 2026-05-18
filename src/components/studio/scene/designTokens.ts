/**
 * designTokens.ts
 *
 * Kinika editor design language constants.
 * Shared between scene editor components for visual consistency.
 *
 * Inspired by: Linear, Framer, Figma, Raycast, Notion AI.
 * Principles: spacing rhythm, restrained glass, layered depth,
 * elegant overlays, minimal chrome, typography-led hierarchy.
 */

// ─── Spacing ─────────────────────────────────────────────────

export const EDITOR_SPACING = {
  /** Toolbar height in px. */
  toolbarHeight: 40,
  /** Side panel width in px. */
  panelWidth: 272,
  /** Narrow panel width. */
  panelWidthNarrow: 224,
  /** Panel padding. */
  panelPadding: 12,
  /** Section gap. */
  sectionGap: 16,
  /** Control height. */
  controlHeight: 28,
  /** Mini control height. */
  controlHeightMini: 24,
} as const;

// ─── Colors (semantic) ──────────────────────────────────────

export const EDITOR_COLORS = {
  /** Canvas background dot grid. */
  canvasDotColor: "hsl(var(--border))",
  canvasGridSize: 22,
  /** Selection overlay. */
  selectionBorder: "hsl(var(--primary))",
  selectionFill: "hsl(var(--primary) / 0.05)",
  selectionHandle: "hsl(var(--primary))",
  /** AI accent. */
  aiAccent: "hsl(var(--primary))",
  aiGlow: "hsl(var(--primary) / 0.15)",
  /** Panel glass. */
  panelBg: "hsl(var(--card) / 0.85)",
  panelBorder: "hsl(var(--border))",
  /** Status colors. */
  statusSuccess: "#22c55e",
  statusWarning: "#eab308",
  statusError: "#ef4444",
  statusInfo: "#3b82f6",
} as const;

// ─── Typography ──────────────────────────────────────────────

export const EDITOR_TYPE = {
  /** Panel header. */
  panelHeader: "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
  /** Section label. */
  sectionLabel: "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70",
  /** Field label. */
  fieldLabel: "text-[9px] text-muted-foreground/70 uppercase",
  /** Body text. */
  body: "text-xs text-foreground/80",
  /** Muted small. */
  caption: "text-[10px] text-muted-foreground",
  /** Badge. */
  badge: "text-[9px] font-medium px-1.5 py-0.5 rounded",
} as const;

// ─── Transitions ─────────────────────────────────────────────

export const EDITOR_TRANSITIONS = {
  /** Panel open/close. */
  panel: "transition-all duration-300 ease-out",
  /** Control hover. */
  hover: "transition-colors duration-150",
  /** Selection highlight. */
  selection: "transition-all duration-200 ease-out",
  /** AI loading states. */
  aiPulse: "animate-pulse",
  /** Fade in. */
  fadeIn: "animate-in fade-in duration-200",
  /** Slide in from bottom. */
  slideUp: "animate-in slide-in-from-bottom-2 duration-300",
} as const;

// ─── Z-Index ─────────────────────────────────────────────────

export const EDITOR_Z = {
  canvas: 0,
  nodes: 10,
  selectionOverlay: 20,
  diffOverlay: 30,
  floatingToolbar: 40,
  aiStatus: 45,
  commandPalette: 50,
  modal: 60,
  toast: 70,
} as const;

// ─── Shortcuts ───────────────────────────────────────────────

export const EDITOR_SHORTCUTS = {
  undo: { key: "z", meta: true, label: "⌘Z" },
  redo: { key: "z", meta: true, shift: true, label: "⌘⇧Z" },
  duplicate: { key: "d", meta: true, label: "⌘D" },
  delete: { key: "Backspace", label: "⌫" },
  focusMode: { key: ".", meta: true, label: "⌘." },
  commandPalette: { key: "k", meta: true, label: "⌘K" },
  zoomIn: { key: "=", meta: true, label: "⌘+" },
  zoomOut: { key: "-", meta: true, label: "⌘−" },
  zoomReset: { key: "0", meta: true, label: "⌘0" },
} as const;
