/**
 * Reusable substage checklist used in the Mentor panels.
 * Preserves the exact spacing, colors, and hover behavior used across the
 * left "Project Status" panel and the right "Journey Record" panel so the
 * two surfaces remain visually consistent.
 */
interface SubstageChecklistProps {
  substages: string[];
  /** Map from substage index → completed flag */
  progress: Record<number, boolean>;
  /** Called when a not-yet-completed substage row is clicked */
  onComplete?: (index: number, substage: string) => void;
}

export function SubstageChecklist({ substages, progress, onComplete }: SubstageChecklistProps) {
  if (!substages || substages.length === 0) return null;

  const completedCount = Object.values(progress).filter(Boolean).length;

  return (
    <div style={{
      margin: '0 0 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }}>
      {substages.map((substage, idx) => {
        const isCompleted = progress[idx] === true;
        const isNext = !isCompleted && completedCount === idx;

        return (
          <div
            key={idx}
            onClick={() => {
              if (isCompleted) return;
              onComplete?.(idx, substage);
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: isCompleted ? 'default' : 'pointer',
              background: isNext ? 'rgba(212,160,23,0.06)' : 'transparent',
              border: isNext
                ? '0.5px solid rgba(212,160,23,0.15)'
                : '0.5px solid transparent',
              transition: 'all 150ms'
            }}
            onMouseEnter={e => {
              if (!isCompleted) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(212,160,23,0.08)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background =
                isNext ? 'rgba(212,160,23,0.06)' : 'transparent';
            }}
          >
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              flexShrink: 0,
              marginTop: '1px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isCompleted ? '#4CAF50' : 'transparent',
              border: isCompleted
                ? '2px solid #4CAF50'
                : isNext
                  ? '2px solid #D4A017'
                  : '1.5px solid var(--color-border-secondary)',
              transition: 'all 200ms'
            }}>
              {isCompleted && (
                <span style={{ fontSize: '9px', color: 'white', fontWeight: 700, lineHeight: 1 }}>✓</span>
              )}
              {!isCompleted && isNext && (
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#D4A017' }} />
              )}
            </div>
            <span style={{
              fontSize: '11px',
              lineHeight: 1.4,
              color: isCompleted
                ? 'var(--color-text-tertiary)'
                : isNext
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
              textDecoration: isCompleted ? 'line-through' : 'none',
              fontWeight: isNext ? 500 : 400,
              flex: 1
            }}>
              {substage}
            </span>
            {isNext && (
              <span style={{
                fontSize: '9px',
                color: '#D4A017',
                background: 'rgba(212,160,23,0.12)',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 600,
                letterSpacing: '0.03em',
                flexShrink: 0,
                alignSelf: 'center'
              }}>
                next
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
