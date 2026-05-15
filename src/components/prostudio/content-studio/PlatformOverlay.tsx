/**
 * PlatformOverlay — visualises the platform's safe zone + required zones on
 * top of a creative canvas. Coordinates are expressed in source-pixel space
 * and the overlay is scaled by `zoom` to align with the rendered preview.
 */

import { useMemo } from 'react';
import {
  getSafeZoneRect,
  getRequiredZones,
  type PlatformConfig,
} from '@/lib/platformRenderer';

interface Props {
  platform: PlatformConfig | null | undefined;
  /** Source-pixel canvas width */
  width: number;
  /** Source-pixel canvas height */
  height: number;
  /** Display scale (1 = 100%) */
  zoom: number;
  /** Hide labels (e.g. on small mobile previews) */
  compact?: boolean;
}

export function PlatformOverlay({ platform, width, height, zoom, compact }: Props) {
  const safe = useMemo(() => getSafeZoneRect(platform), [platform]);
  const zones = useMemo(() => getRequiredZones(platform), [platform]);

  const hasSafeZone =
    safe.top > 0 || safe.left > 0 ||
    safe.width !== (platform?.image_width ?? width) ||
    safe.height !== (platform?.image_height ?? height);

  if (!hasSafeZone && zones.length === 0) return null;

  return (
    <div
      aria-hidden
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: width * zoom,
        height: height * zoom,
        zIndex: 20,
      }}
    >
      {/* Safe-zone outline */}
      {hasSafeZone && (
        <div
          className="absolute"
          style={{
            top: safe.top * zoom,
            left: safe.left * zoom,
            width: safe.width * zoom,
            height: safe.height * zoom,
            border: '1px dashed hsl(var(--primary) / 0.55)',
            borderRadius: 2,
            boxShadow: '0 0 0 9999px hsl(var(--background) / 0.0)',
          }}
        >
          {!compact && (
            <span
              className="absolute -top-4 left-0 text-[9px] font-ui uppercase tracking-wider"
              style={{ color: 'hsl(var(--primary) / 0.85)' }}
            >
              Safe zone
            </span>
          )}
        </div>
      )}

      {/* Required-zone outlines */}
      {zones.map((z, i) => (
        <div
          key={`${z.name}-${i}`}
          className="absolute"
          style={{
            top: z.y * zoom,
            left: z.x * zoom,
            width: z.width * zoom,
            height: z.height * zoom,
            border: `1px dashed ${z.required ? '#D4A017aa' : '#8A96A3aa'}`,
            background: z.required
              ? 'rgba(212,160,23,0.06)'
              : 'rgba(138,150,163,0.05)',
            borderRadius: 2,
          }}
        >
          {!compact && (
            <span
              className="absolute top-1 left-1 px-1 rounded-[2px] text-[9px] font-ui"
              style={{
                background: 'hsl(var(--card) / 0.8)',
                color: 'hsl(var(--foreground))',
                backdropFilter: 'blur(4px)',
              }}
            >
              {z.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
