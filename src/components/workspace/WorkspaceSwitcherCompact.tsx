import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { Brand } from '@/services/brandService';

interface WorkspaceSwitcherCompactProps {
  brands: Brand[];
  activeBrandId: string | null;
  onSwitch: (brandId: string) => void;
}

/**
 * Compact workspace/project switcher — no longer dominates vertical space.
 * Collapsed by default, expands inline.
 */
export function WorkspaceSwitcherCompact({
  brands,
  activeBrandId,
  onSwitch,
}: WorkspaceSwitcherCompactProps) {
  const [expanded, setExpanded] = useState(false);
  const active = brands.find((b) => b.id === activeBrandId);

  if (brands.length === 0) return null;

  return (
    <div className="px-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: active?.primary_color || 'hsl(var(--primary))' }}
        />
        <span className="flex-1 text-[12px] font-ui text-foreground truncate">
          {active?.name || 'Select project'}
        </span>
        <ChevronDown
          size={12}
          className="text-muted-foreground transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {expanded && (
        <div className="mt-0.5 space-y-0.5 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => {
                onSwitch(brand.id);
                setExpanded(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-ui text-foreground hover:bg-muted/40 transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: brand.primary_color || 'hsl(var(--primary))' }}
              />
              <span className="flex-1 text-left truncate">{brand.name}</span>
              {brand.id === activeBrandId && <Check size={12} className="text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
