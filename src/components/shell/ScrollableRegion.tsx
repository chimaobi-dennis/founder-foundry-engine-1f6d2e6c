import { forwardRef, type ReactNode, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface ScrollableRegionProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  horizontal?: boolean;
  nativeScroll?: boolean;
}

/**
 * ScrollableRegion - A primitive for scrollable content areas
 * Handles overflow, scrolling behavior, and iOS momentum scrolling
 */
export const ScrollableRegion = forwardRef<HTMLDivElement, ScrollableRegionProps>(
  function ScrollableRegion({
    children,
    className,
    style,
    horizontal = false,
    nativeScroll = true,
  }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'min-h-0',
          horizontal
            ? 'overflow-x-auto overflow-y-hidden'
            : 'overflow-y-auto overflow-x-hidden',
          nativeScroll && !horizontal && '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted',
          className
        )}
        style={{
          WebkitOverflowScrolling: nativeScroll ? 'touch' : 'auto',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
);
