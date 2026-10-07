import { useEffect, useRef } from 'react';

/**
 * setInterval that only ticks while the tab is visible, and runs once as soon
 * as the tab becomes visible again. Background tabs used to keep polling the
 * database all day; on a small instance that is real disk IO for nothing.
 */
export function useVisibleInterval(fn: () => void, ms: number, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled || ms <= 0) return;
    let timer: number | null = null;
    const start = () => { if (timer == null) timer = window.setInterval(() => ref.current(), ms); };
    const stop = () => { if (timer != null) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { ref.current(); start(); } else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms, enabled]);
}
