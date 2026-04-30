import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill — the canonical selectable chip for ProStudio modals.
 *
 * Selected state uses `--primary` + `--primary-foreground` (amber on dark navy,
 * always visible in both themes). Unselected uses `--border` + `--muted-foreground`
 * with a hover state that promotes to `--foreground`.
 *
 * Use this for aspect ratio, style intensity, and variant count selectors so
 * the physical and digital modals can't drift apart visually.
 */
export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Apply min-width — useful for short numeric labels like variant counts. */
  minWidth?: boolean;
}

export const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  ({ className, selected, minWidth, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "px-3 py-1.5 rounded-full text-[12px] font-ui transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:border-border",
        selected
          ? "bg-primary text-primary-foreground border border-primary"
          : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
        minWidth && "min-w-[40px]",
        className,
      )}
      {...props}
    />
  ),
);
Pill.displayName = "Pill";
