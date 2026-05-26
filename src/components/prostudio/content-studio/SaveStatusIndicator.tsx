/**
 * SaveStatusIndicator.tsx
 *
 * Professional save status indicator for Content Studio.
 * Shows subtle, calm UI for save states without being noisy.
 *
 * States:
 * - "saved"      : ✓ Saved (green checkmark)
 * - "saving"     : ● Saving… (blue pulse)
 * - "unsaved"    : ● Unsaved changes (amber dot)
 * - "restoring"  : ⟳ Restoring… (spinner)
 * - "error"      : ✕ Error (red)
 * - "autosaved"  : Autosaved 2m ago (muted text)
 */

import { Check, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/services/versionService";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  pendingChanges?: boolean;
  className?: string;
  onClick?: () => void;
  showTimestamp?: boolean;
}

export function SaveStatusIndicator({
  status,
  lastSavedAt,
  pendingChanges = false,
  className,
  onClick,
  showTimestamp = true,
}: SaveStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "saved":
        return {
          icon: Check,
          iconClass: "text-emerald-500",
          text: "Saved",
          textClass: "text-emerald-600",
          dotClass: "bg-emerald-500",
          pulse: false,
        };
      case "autosaved":
        return {
          icon: Check,
          iconClass: "text-muted-foreground",
          text: formatTimestamp(lastSavedAt),
          textClass: "text-muted-foreground",
          dotClass: "bg-muted-foreground",
          pulse: false,
        };
      case "saving":
        return {
          icon: Loader2,
          iconClass: "text-blue-500 animate-spin",
          text: "Saving…",
          textClass: "text-blue-600",
          dotClass: "bg-blue-500 animate-pulse",
          pulse: true,
        };
      case "unsaved":
        return {
          icon: null,
          iconClass: "",
          text: pendingChanges ? "Unsaved changes" : "Modified",
          textClass: "text-amber-600",
          dotClass: "bg-amber-500",
          pulse: false,
        };
      case "restoring":
        return {
          icon: RotateCcw,
          iconClass: "text-blue-500 animate-spin",
          text: "Restoring…",
          textClass: "text-blue-600",
          dotClass: "bg-blue-500 animate-pulse",
          pulse: true,
        };
      case "error":
        return {
          icon: AlertCircle,
          iconClass: "text-red-500",
          text: "Error",
          textClass: "text-red-600",
          dotClass: "bg-red-500",
          pulse: false,
        };
      default:
        return {
          icon: null,
          iconClass: "",
          text: "",
          textClass: "",
          dotClass: "bg-muted",
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
        onClick && "hover:bg-muted cursor-pointer",
        !onClick && "cursor-default",
        className
      )}
      title={getTooltipText(status, lastSavedAt)}
    >
      {/* Status dot */}
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          config.dotClass,
          config.pulse && "animate-pulse"
        )}
      />

      {/* Icon (if any) */}
      {Icon && (
        <Icon className={cn("w-3 h-3", config.iconClass)} />
      )}

      {/* Status text */}
      <span className={cn(config.textClass)}>{config.text}</span>
    </button>
  );
}

/**
 * Compact version for tight spaces (just the dot + minimal text)
 */
export function SaveStatusDot({
  status,
  className,
}: {
  status: SaveStatus;
  className?: string;
}) {
  const getDotClass = () => {
    switch (status) {
      case "saved":
      case "autosaved":
        return "bg-emerald-500";
      case "saving":
      case "restoring":
        return "bg-blue-500 animate-pulse";
      case "unsaved":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-muted";
    }
  };

  return (
    <span
      className={cn("w-1.5 h-1.5 rounded-full", getDotClass(), className)}
      title={status}
    />
  );
}

/**
 * Format a timestamp into "2m ago", "1h ago", "Yesterday", etc.
 */
function formatTimestamp(date: Date | null | undefined): string {
  if (!date) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getTooltipText(status: SaveStatus, lastSavedAt?: Date | null): string {
  switch (status) {
    case "saved":
      return lastSavedAt
        ? `Last saved ${formatTimestamp(lastSavedAt)}`
        : "All changes saved";
    case "saving":
      return "Saving your changes…";
    case "unsaved":
      return "You have unsaved changes";
    case "restoring":
      return "Restoring previous version…";
    case "error":
      return "Error saving changes. Click to retry.";
    case "autosaved":
      return `Autosaved ${formatTimestamp(lastSavedAt)}`;
    default:
      return "";
  }
}
