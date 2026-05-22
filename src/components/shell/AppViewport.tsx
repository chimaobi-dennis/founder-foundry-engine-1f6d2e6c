import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { layer } from '@/lib/layers';

interface AppViewportProps {
  children: ReactNode;
  className?: string;
}

/**
 * AppViewport - Root viewport container
 * Sets up the dynamic viewport height and overflow behavior
 */
export function AppViewport({ children, className }: AppViewportProps) {
  return (
    <div
      className={cn(
        'h-[100dvh] flex flex-col overflow-hidden bg-background',
        className
      )}
      style={{ isolation: 'isolate' }}
    >
      {children}
    </div>
  );
}

/**
 * ViewportRegion - A region within the viewport
 */
interface ViewportRegionProps {
  children: ReactNode;
  className?: string;
  shrink?: boolean;
  grow?: boolean;
  scroll?: boolean;
}

export function ViewportRegion({
  children,
  className,
  shrink = false,
  grow = false,
  scroll = false,
}: ViewportRegionProps) {
  return (
    <div
      className={cn(
        'min-h-0 min-w-0',
        shrink && 'flex-shrink-0',
        grow && 'flex-1',
        scroll && 'overflow-y-auto overflow-x-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * StickyHeader - Fixed header that stays at top
 */
interface StickyHeaderProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function StickyHeader({ children, className, style }: StickyHeaderProps) {
  return (
    <div
      className={cn(
        'flex-shrink-0',
        className
      )}
      style={{ zIndex: layer('topbar'), ...style }}
    >
      {children}
    </div>
  );
}

/**
 * StickyFooter - Fixed footer that stays at bottom
 */
interface StickyFooterProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function StickyFooter({ children, className, style }: StickyFooterProps) {
  return (
    <div
      className={cn(
        'flex-shrink-0',
        className
      )}
      style={{ zIndex: layer('bottomNav'), ...style }}
    >
      {children}
    </div>
  );
}
