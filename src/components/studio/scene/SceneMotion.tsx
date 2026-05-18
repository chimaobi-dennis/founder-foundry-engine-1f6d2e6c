import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Fade In ─────────────────────────────────────────────────

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 300, className }: FadeInProps) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const t = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(t);
    }
  }, [delay]);

  return (
    <div
      className={cn("transition-all ease-out", className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Slide Panel ─────────────────────────────────────────────

interface SlidePanelProps {
  open: boolean;
  side: "left" | "right";
  width?: number;
  children: ReactNode;
  className?: string;
}

export function SlidePanel({ open, side, width = 280, children, className }: SlidePanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        className
      )}
      style={{
        width: open ? width : 0,
        opacity: open ? 1 : 0,
      }}
    >
      <div style={{ width }} className="h-full">
        {children}
      </div>
    </div>
  );
}

// ─── Pulse Highlight ─────────────────────────────────────────

interface PulseHighlightProps {
  active: boolean;
  color?: string;
  children: ReactNode;
  className?: string;
}

export function PulseHighlight({ active, color = "primary", children, className }: PulseHighlightProps) {
  return (
    <div className={cn("relative", className)}>
      {active && (
        <div
          className={cn(
            "absolute inset-0 rounded-md animate-pulse pointer-events-none",
            `bg-${color}/10 border border-${color}/20`
          )}
        />
      )}
      {children}
    </div>
  );
}

// ─── Scale on Hover ──────────────────────────────────────────

interface ScaleHoverProps {
  children: ReactNode;
  scale?: number;
  className?: string;
}

export function ScaleHover({ children, scale = 1.02, className }: ScaleHoverProps) {
  return (
    <div
      className={cn("transition-transform duration-200 ease-out hover:shadow-md", className)}
      style={{ willChange: "transform" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = `scale(${scale})`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
    >
      {children}
    </div>
  );
}

// ─── Stagger Children ────────────────────────────────────────

interface StaggerProps {
  children: ReactNode[];
  staggerMs?: number;
  className?: string;
}

export function Stagger({ children, staggerMs = 50, className }: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <FadeIn key={i} delay={i * staggerMs}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

// ─── Shimmer (skeleton) ──────────────────────────────────────

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-gradient-to-r from-muted/40 via-muted/80 to-muted/40",
        "animate-pulse",
        className
      )}
    />
  );
}

// ─── Token Propagation Flash ─────────────────────────────────

interface PropagationFlashProps {
  active: boolean;
  children: ReactNode;
}

export function PropagationFlash({ active, children }: PropagationFlashProps) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (active) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <div className="relative">
      {flash && (
        <div className="absolute inset-0 bg-primary/10 rounded-md pointer-events-none animate-ping" />
      )}
      {children}
    </div>
  );
}
