import type { ReactNode, ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { AppViewport, StickyHeader, ScrollableRegion } from './index';
import { Sidebar } from './Sidebar';

interface DesktopShellProps {
  children: ReactNode;
  topBar: ReactElement;
  sidebar: ReactElement;
  brandBar?: ReactElement | null;
  className?: string;
}

/**
 * DesktopShell - Complete desktop viewport shell
 * Layout: Sidebar (left) -> Content area
 * TopBar sits above, content scrolls
 */
export function DesktopShell({
  children,
  topBar,
  sidebar,
  brandBar = null,
  className,
}: DesktopShellProps) {
  return (
    <AppViewport className={className}>
      {/* Sticky TopBar */}
      <StickyHeader>
        {topBar}
      </StickyHeader>

      {/* BrandBar - optional */}
      {brandBar && (
        <div className="flex-shrink-0">
          {brandBar}
        </div>
      )}

      {/* Main area: Sidebar + Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        {sidebar}

        {/* Scrollable Content */}
        <ScrollableRegion className="flex-1">
          {children}
        </ScrollableRegion>
      </div>
    </AppViewport>
  );
}

/**
 * DesktopShellWithRightPanel - Desktop with optional right panel (Mentor layout)
 */
interface DesktopShellWithPanelsProps {
  children: ReactNode;
  topBar: ReactElement;
  sidebar: ReactElement;
  rightPanel?: ReactElement | null;
  brandBar?: ReactElement | null;
  className?: string;
}

export function DesktopShellWithPanels({
  children,
  topBar,
  sidebar,
  rightPanel = null,
  brandBar = null,
  className,
}: DesktopShellWithPanelsProps) {
  return (
    <AppViewport className={className}>
      {/* Sticky TopBar */}
      <StickyHeader>
        {topBar}
      </StickyHeader>

      {/* BrandBar - optional */}
      {brandBar && (
        <div className="flex-shrink-0">
          {brandBar}
        </div>
      )}

      {/* Main area: Sidebar + Content + RightPanel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        {sidebar}

        {/* Center Content - no scroll, page handles it */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>

        {/* Right Panel */}
        {rightPanel}
      </div>
    </AppViewport>
  );
}

/**
 * DesktopWorkspaceShell - For 3-panel layouts (Mentor, etc.)
 * No global scroll - each panel manages its own scroll
 */
interface DesktopWorkspaceShellProps {
  children: ReactNode;
  topBar: ReactElement;
  brandBar?: ReactElement | null;
  className?: string;
}

export function DesktopWorkspaceShell({
  children,
  topBar,
  brandBar = null,
  className,
}: DesktopWorkspaceShellProps) {
  return (
    <AppViewport className={className}>
      {/* Sticky TopBar */}
      <StickyHeader>
        {topBar}
      </StickyHeader>

      {/* BrandBar - optional */}
      {brandBar && (
        <div className="flex-shrink-0">
          {brandBar}
        </div>
      )}

      {/* Workspace area - children handle their own layout */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </AppViewport>
  );
}
