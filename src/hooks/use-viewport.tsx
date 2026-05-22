import { useState, useEffect, useCallback } from 'react';

interface ViewportState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  safeAreaTop: number;
  safeAreaBottom: number;
}

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: window.innerWidth,
    height: window.innerHeight,
    safeAreaTop: 0,
    safeAreaBottom: 0,
  });

  const updateViewport = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Read CSS env() values for safe areas
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10) || 0;
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0', 10) || 0;

    setState({
      isMobile: width <= MOBILE_MAX,
      isTablet: width > MOBILE_MAX && width <= TABLET_MAX,
      isDesktop: width > TABLET_MAX,
      width,
      height,
      safeAreaTop,
      safeAreaBottom,
    });
  }, []);

  useEffect(() => {
    updateViewport();

    // Use matchMedia for better performance
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const tabletQuery = window.matchMedia(`(min-width: ${MOBILE_MAX + 1}px) and (max-width: ${TABLET_MAX}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${TABLET_MAX + 1}px)`);

    const handleChange = () => updateViewport();

    mobileQuery.addEventListener('change', handleChange);
    tabletQuery.addEventListener('change', handleChange);
    desktopQuery.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);

    return () => {
      mobileQuery.removeEventListener('change', handleChange);
      tabletQuery.removeEventListener('change', handleChange);
      desktopQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, [updateViewport]);

  return state;
}

// Hook for specific breakpoint checks
export function useIsMobile(): boolean {
  const { isMobile } = useViewport();
  return isMobile;
}

export function useIsTablet(): boolean {
  const { isTablet } = useViewport();
  return isTablet;
}

export function useIsDesktop(): boolean {
  const { isDesktop } = useViewport();
  return isDesktop;
}

// Hook for safe area insets
export function useSafeArea() {
  const { safeAreaTop, safeAreaBottom } = useViewport();
  return { top: safeAreaTop, bottom: safeAreaBottom };
}
