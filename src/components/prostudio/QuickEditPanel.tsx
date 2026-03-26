import { useState, useEffect, useCallback } from "react";
import { SlidersHorizontal } from "lucide-react";

interface EditState {
  texts: { original: string; edited: string }[];
  position: string;
  brightness: number;
  contrast: number;
  primaryColor: string;
  secondaryColor: string;
}

const defaultEditState = (): EditState => ({
  texts: [],
  position: 'center',
  brightness: 100,
  contrast: 100,
  primaryColor: '#2D4A3E',
  secondaryColor: '#F5F0E8',
});

interface Props {
  variationIndex: number;
  variationHtml: string | null;
  editStates: Record<number, EditState>;
  onEditStatesChange: (states: Record<number, EditState>) => void;
  onApplyAndRegenerate: (editInstructions: string) => void;
  isRegenerating: boolean;
}

function extractTexts(html: string | null): string[] {
  if (!html) return [];
  // Extract text content from HTML - find text between > and < that isn't empty
  const matches: string[] = [];
  const regex = />([^<>{}&]{3,80})</g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const text = m[1].trim();
    if (text && !text.startsWith('data:') && !text.startsWith('http') && !text.includes('{') && !text.startsWith('@import')) {
      matches.push(text);
    }
  }
  // Deduplicate and limit
  return [...new Set(matches)].slice(0, 6);
}

const positionOptions = [
  { id: 'top-left', label: '↖', style: { top: 3, left: 3 } },
  { id: 'top-right', label: '↗', style: { top: 3, right: 3 } },
  { id: 'center', label: '⊕', style: { top: 12, left: 12 } },
  { id: 'bottom-left', label: '↙', style: { bottom: 3, left: 3 } },
  { id: 'bottom-right', label: '↘', style: { bottom: 3, right: 3 } },
];

export function QuickEditPanel({ variationIndex, variationHtml, editStates, onEditStatesChange, onApplyAndRegenerate, isRegenerating }: Props) {
  const currentState = editStates[variationIndex] || defaultEditState();

  // Extract texts on first open for this variation
  useEffect(() => {
    if (!editStates[variationIndex] && variationHtml) {
      const texts = extractTexts(variationHtml);
      const newState: EditState = {
        ...defaultEditState(),
        texts: texts.map(t => ({ original: t, edited: t })),
      };
      onEditStatesChange({ ...editStates, [variationIndex]: newState });
    }
  }, [variationIndex, variationHtml]);

  const update = useCallback((partial: Partial<EditState>) => {
    onEditStatesChange({
      ...editStates,
      [variationIndex]: { ...currentState, ...partial },
    });
  }, [editStates, variationIndex, currentState, onEditStatesChange]);

  const updateText = useCallback((idx: number, value: string) => {
    const newTexts = [...currentState.texts];
    newTexts[idx] = { ...newTexts[idx], edited: value };
    update({ texts: newTexts });
  }, [currentState.texts, update]);

  const [showAllTexts, setShowAllTexts] = useState(false);
  const visibleTexts = showAllTexts ? currentState.texts : currentState.texts.slice(0, 4);

  const buildEditInstructions = () => {
    const parts: string[] = [];
    const textEdits = currentState.texts.filter(t => t.original !== t.edited);
    if (textEdits.length > 0) {
      parts.push('Text changes: ' + textEdits.map(t => `"${t.original}" → "${t.edited}"`).join(', '));
    }
    if (currentState.position !== 'center') {
      parts.push(`Move the product to the ${currentState.position} area of the composition.`);
    }
    if (currentState.brightness !== 100) {
      parts.push(`Adjust background brightness to ${currentState.brightness}%.`);
    }
    if (currentState.contrast !== 100) {
      parts.push(`Adjust background contrast to ${currentState.contrast}%.`);
    }
    if (currentState.primaryColor !== '#2D4A3E') {
      parts.push(`Use ${currentState.primaryColor} as the primary brand color.`);
    }
    if (currentState.secondaryColor !== '#F5F0E8') {
      parts.push(`Use ${currentState.secondaryColor} as the secondary brand color.`);
    }
    return parts.join('\n');
  };

  return (
    <div className="border-t border-border p-4 bg-muted/30">
      <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-3.5">Quick edits</p>

      {/* Text elements */}
      {currentState.texts.length > 0 && (
        <div className="mb-3.5">
          <p className="text-[10px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Text</p>
          <div className="space-y-2">
            {visibleTexts.map((t, i) => (
              <div key={i}>
                <span className="text-[11px] font-ui text-muted-foreground block mb-1 truncate" title={t.original}>
                  {t.original.length > 30 ? t.original.slice(0, 30) + '…' : t.original}
                </span>
                <input
                  type="text"
                  value={t.edited}
                  onChange={(e) => updateText(i, e.target.value)}
                  className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-[12px] font-ui text-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            ))}
          </div>
          {currentState.texts.length > 4 && !showAllTexts && (
            <button
              onClick={() => setShowAllTexts(true)}
              className="text-[11px] font-ui text-primary mt-1.5 hover:underline"
            >
              Show all text
            </button>
          )}
        </div>
      )}

      {/* Product position */}
      <div className="mb-3.5">
        <p className="text-[10px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Product position</p>
        <div className="grid grid-cols-5 gap-1.5 max-w-[220px]">
          {positionOptions.map((pos) => (
            <button
              key={pos.id}
              onClick={() => update({ position: pos.id })}
              className="w-10 h-10 rounded-md border flex items-center justify-center text-[14px] transition-colors"
              style={{
                borderColor: currentState.position === pos.id ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                borderWidth: currentState.position === pos.id ? 2 : 1,
                background: currentState.position === pos.id ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                color: currentState.position === pos.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              }}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div className="mb-3.5">
        <p className="text-[10px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Background</p>
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-ui text-muted-foreground">Brightness</span>
              <span className="text-[11px] font-ui text-muted-foreground">{currentState.brightness}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={140}
              step={5}
              value={currentState.brightness}
              onChange={(e) => update({ brightness: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary"
              style={{ accentColor: 'hsl(var(--primary))' }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-ui text-muted-foreground">Contrast</span>
              <span className="text-[11px] font-ui text-muted-foreground">{currentState.contrast}%</span>
            </div>
            <input
              type="range"
              min={80}
              max={130}
              step={5}
              value={currentState.contrast}
              onChange={(e) => update({ contrast: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'hsl(var(--primary))' }}
            />
          </div>
        </div>
      </div>

      {/* Brand colors */}
      <div className="mb-4">
        <p className="text-[10px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Brand colors</p>
        <div className="space-y-2">
          {[
            { label: 'Primary', key: 'primaryColor' as const },
            { label: 'Secondary', key: 'secondaryColor' as const },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[11px] font-ui text-muted-foreground w-16">{label}</span>
              <label className="relative cursor-pointer">
                <div
                  className="w-6 h-6 rounded-full border-2 border-border"
                  style={{ backgroundColor: currentState[key] }}
                />
                <input
                  type="color"
                  value={currentState[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              <span className="text-[11px] font-ui text-muted-foreground font-mono">{currentState[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <button
        onClick={() => onApplyAndRegenerate(buildEditInstructions())}
        disabled={isRegenerating}
        className="w-full h-9 rounded-lg border text-[12px] font-ui font-medium transition-colors disabled:opacity-50"
        style={{
          borderColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary))',
          background: 'transparent',
        }}
      >
        {isRegenerating ? 'Regenerating...' : 'Apply and regenerate'}
      </button>
      <p className="text-[10px] font-ui text-muted-foreground text-center mt-2">
        Live edits update the preview. Apply and regenerate for a cleaner output.
      </p>
    </div>
  );
}

export { type EditState, defaultEditState };
