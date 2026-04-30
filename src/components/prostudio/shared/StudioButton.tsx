import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StudioButton — the canonical CTA button for ProStudio modals.
 *
 * Always-visible amber (`--primary`) on dark navy text (`--primary-foreground`)
 * regardless of theme. Pass `loading` to show a spinner and auto-disable.
 */
export interface StudioButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  size?: "md" | "lg";
  loading?: boolean;
}

export const StudioButton = React.forwardRef<HTMLButtonElement, StudioButtonProps>(
  ({ className, fullWidth, size = "lg", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-ui font-medium",
        "bg-primary text-primary-foreground",
        "transition-colors hover:bg-primary/90 active:bg-primary/85",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "lg" ? "h-12 px-5 text-[14px]" : "h-10 px-4 text-[13px]",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
StudioButton.displayName = "StudioButton";
