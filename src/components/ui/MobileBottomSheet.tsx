import { useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  zIndex?: number;
}

/**
 * Mobile bottom sheet with swipe-down-to-dismiss.
 * Renders via portal, includes backdrop + drag handle.
 */
export function MobileBottomSheet({
  open,
  onClose,
  children,
  maxHeight = "90vh",
  zIndex = 100,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; currentY: number; dragging: boolean }>({
    startY: 0,
    currentY: 0,
    dragging: false,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only initiate drag from the handle area (top 48px)
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touchY = e.touches[0].clientY;
    const relativeY = touchY - rect.top;
    if (relativeY > 48) return; // only drag from handle zone

    dragState.current = {
      startY: e.touches[0].clientY,
      currentY: e.touches[0].clientY,
      dragging: true,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current.dragging) return;
    const currentY = e.touches[0].clientY;
    dragState.current.currentY = currentY;
    const delta = currentY - dragState.current.startY;

    if (delta > 0 && sheetRef.current) {
      // Only allow dragging down
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragState.current.dragging) return;
    const delta = dragState.current.currentY - dragState.current.startY;
    dragState.current.dragging = false;

    if (sheetRef.current) {
      if (delta > 100) {
        // Dragged far enough — dismiss with animation
        sheetRef.current.style.transition = "transform 200ms ease-out";
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(onClose, 200);
      } else {
        // Snap back
        sheetRef.current.style.transition = "transform 200ms ease-out";
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 bg-card border-t border-card-border shadow-xl flex flex-col rounded-t-[20px] overflow-hidden"
        style={{
          maxHeight,
          zIndex,
          animation: "mobileSheetSlideUp 300ms ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <style>{`@keyframes mobileSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}
