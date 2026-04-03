import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export function NavigationProgress() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Start progress
    setProgress(0);
    setVisible(true);

    // Quick jump to ~30%
    const t1 = setTimeout(() => setProgress(30), 50);
    // Slow crawl to ~70%
    const t2 = setTimeout(() => setProgress(70), 200);
    // Jump to 90%
    const t3 = setTimeout(() => setProgress(90), 400);
    // Complete
    const t4 = setTimeout(() => setProgress(100), 500);
    // Hide
    const t5 = setTimeout(() => setVisible(false), 700);

    return () => {
      [t1, t2, t3, t4, t5].forEach(clearTimeout);
    };
  }, [location.pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
        style={{
          width: `${progress}%`,
          transition: progress === 0 ? "none" : "width 300ms ease",
        }}
      />
    </div>
  );
}
