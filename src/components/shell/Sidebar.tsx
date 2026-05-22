import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  children: ReactNode;
  className?: string;
  width?: string;
  side?: 'left' | 'right';
  scroll?: boolean;
}

/**
 * Sidebar - Fixed-width sidebar that can scroll internally
 */
export function Sidebar({
  children,
  className,
  width = '260px',
  side = 'left',
  scroll = true,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex-shrink-0 min-h-0 h-full bg-background/40',
        side === 'left' ? 'border-r border-border' : 'border-l border-border',
        scroll ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden',
        className
      )}
      style={{ width, minWidth: width }}
    >
      {children}
    </aside>
  );
}

/**
 * CollapsibleSidebar - Sidebar that can be collapsed
 */
interface CollapsibleSidebarProps extends SidebarProps {
  collapsed?: boolean;
  collapsedWidth?: string;
}

export function CollapsibleSidebar({
  children,
  collapsed = false,
  width = '260px',
  collapsedWidth = '72px',
  ...props
}: CollapsibleSidebarProps) {
  const effectiveWidth = collapsed ? collapsedWidth : width;

  return (
    <Sidebar
      {...props}
      width={effectiveWidth}
      className={cn(
        'transition-all duration-300 ease-in-out',
        props.className
      )}
    >
      {children}
    </Sidebar>
  );
}
