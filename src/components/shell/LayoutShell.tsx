import { type ReactNode, type ReactElement } from 'react';
import { useViewport } from '@/hooks/use-viewport';
import { MobileShell } from './MobileShell';
import { DesktopShell, DesktopWorkspaceShell } from './DesktopShell';
import { NavigationProgress } from '@/components/NavigationProgress';
import { Analytics } from '@vercel/analytics/react';
import { AppViewport } from './AppViewport';

interface LayoutShellProps {
  children: ReactNode;
  topBar: ReactElement;
  sidebar: ReactElement;
  bottomNav: ReactElement;
  brandBar: ReactElement | null;
  isWorkspace?: boolean; // For Mentor, ContentCalendar with 3-panel layouts
}

/**
 * LayoutShell - The main responsive layout router
 * Automatically selects the appropriate shell based on viewport
 * No more conditional hacks in one giant Layout.tsx
 */
export function LayoutShell({
  children,
  topBar,
  sidebar,
  bottomNav,
  brandBar,
  isWorkspace = false,
}: LayoutShellProps) {
  const { isMobile, isDesktop } = useViewport();

  return (
    <>
      <NavigationProgress />

      {isMobile ? (
        // Mobile: Stack layout with bottom nav
        <MobileShell
          topBar={topBar}
          bottomNav={bottomNav}
          brandBar={brandBar}
        >
          {children}
        </MobileShell>
      ) : isDesktop ? (
        // Desktop: Sidebar + content
        isWorkspace ? (
          // Workspace pages handle their own internal layout
          <DesktopWorkspaceShell topBar={topBar} brandBar={brandBar}>
            {children}
          </DesktopWorkspaceShell>
        ) : (
          <DesktopShell
            topBar={topBar}
            sidebar={sidebar}
            brandBar={brandBar}
          >
            {children}
          </DesktopShell>
        )
      ) : (
        // Tablet: Similar to desktop but with potential adjustments
        isWorkspace ? (
          <DesktopWorkspaceShell topBar={topBar} brandBar={brandBar}>
            {children}
          </DesktopWorkspaceShell>
        ) : (
          <DesktopShell
            topBar={topBar}
            sidebar={sidebar}
            brandBar={brandBar}
          >
            {children}
          </DesktopShell>
        )
      )}

      <Analytics />
    </>
  );
}

/**
 * SimpleAppViewport - Just the viewport wrapper without layout logic
 * For pages that need full control
 */
interface SimpleAppViewportProps {
  children: ReactNode;
}

export function SimpleAppViewport({ children }: SimpleAppViewportProps) {
  return (
    <>
      <NavigationProgress />
      <AppViewport>{children}</AppViewport>
      <Analytics />
    </>
  );
}
