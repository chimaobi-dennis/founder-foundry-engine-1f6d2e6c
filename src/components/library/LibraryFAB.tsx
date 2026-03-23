import { Plus } from "lucide-react";
import { useState } from "react";

export function LibraryFAB() {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed bottom-6 right-6 z-20 h-12 bg-primary text-primary-foreground flex items-center justify-center shadow-lg transition-all duration-200 ease-in-out"
      style={{
        width: hovered ? 160 : 48,
        borderRadius: hovered ? 24 : 24,
      }}
    >
      <Plus size={20} className="flex-shrink-0" />
      {hovered && <span className="ml-2 text-[13px] font-ui font-medium whitespace-nowrap">Upload asset</span>}
    </button>
  );
}
