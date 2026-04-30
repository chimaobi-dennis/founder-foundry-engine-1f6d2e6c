import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StudioButton — the canonical CTA button for ProStudio modals.
 *
 * Always-visible amber (`--primary`) on dark navy text (`--primary-foreground`)
 * regardless of theme. Use this for the Generate button and any other primary
 * action inside the template modals so styling can't drift between physical
 * and digital flows.
 */
export interface StudioButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  size?: "md" | "lg";
}

export const StudioButton = React.forwardRef<HTMLButtonElement, StudioButtonProps>(
  ({ className, fullWidth, size = "lg", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-ui font-medium",
        "bg-primary text-primary-foreground",
        "transition-colors hover:bg-primary/90 active:bg-primary/85",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "lg" ? "h-12 px-5 text-[14px]" : "h-10 px-4 text-[13px]",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  ),
);
StudioButton.displayName = "StudioButton";
