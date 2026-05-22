import type { ReactNode, ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { AppViewport, StickyHeader, StickyFooter, ScrollableRegion } from './index';

interface MobileShellProps {
  children: ReactNode;
  topBar: ReactElement;
  bottomNav: ReactElement;
  brandBar?: ReactElement | null;
  className?: string;
}

/**
 * MobileShell - Complete mobile viewport shell
 * Stack layout: TopBar -> BrandBar (optional) -> Content -> BottomNav
 * Each region has clear ownership, no overlapping
 */
export function MobileShell({
  children,
  topBar,
  bottomNav,
  brandBar = null,
  className,
}: MobileShellProps) {
  return (
    <AppViewport className={className}>
      {/* Sticky TopBar */}
      <StickyHeader className="safe-top">
        {topBar}
      </StickyHeader>

      {/* BrandBar - optional, sits between top and content */}
      {brandBar && (
        <div className="flex-shrink-0 safe-top">
          {brandBar}
        </div>
      )}

      {/* Scrollable Content Area */}
      <ScrollableRegion className="flex-1 relative">
        <div className="pb-safe">
          {children}
        </div>
      </ScrollableRegion>

      {/* Sticky BottomNav */}
      <StickyFooter>
        {bottomNav}
      </StickyFooter>
    </AppViewport>
  );
}

/**
 * MobileContent - Wrapper for mobile page content
 * Adds safe area padding at bottom
 */
interface MobileContentProps {
  children: ReactNode;
  className?: string;
}

export function MobileContent({ children, className }: MobileContentProps) {
  return (
    <div className={cn('px-4 py-4', className)}>
      {children}
    </div>
  );
}

/**
 * MobileSelfScrollingContent - For pages that handle their own scroll (Mentor, etc.)
 */
interface MobileSelfScrollingContentProps {
  children: ReactNode;
  className?: string;
}

export function MobileSelfScrollingContent({
  children,
  className,
}: MobileSelfScrollingContentProps) {
  return (
    <div className={cn('h-full overflow-hidden', className)}>
      {children}
    </div>
  );
}
