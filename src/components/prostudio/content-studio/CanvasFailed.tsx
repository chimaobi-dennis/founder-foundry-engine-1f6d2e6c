// CanvasFailed — shown in place of the generating shimmer when a creative's
// status is "failed" (either reported from the server or detected as stuck on
// mount). Same dimensions as the canvas; offers Retry / Skip affordances.

import { XCircle } from "lucide-react";

interface Props {
  width: number;
  height: number;
  zoom: number;
  retrying?: boolean;
  onRetry?: () => void;
  onSkip?: () => void;
}

export function CanvasFailed({ width, height, zoom, retrying, onRetry, onSkip }: Props) {
  const w = width * zoom;
  const h = height * zoom;
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: w, height: h, background: "#1A2A3A" }}
    >
      <div className="flex flex-col items-center text-center px-6 max-w-[360px]">
        <XCircle size={40} style={{ color: "#E05C5C" }} strokeWidth={1.6} />
        <p className="mt-3 font-ui text-[15px] text-white">Generation failed</p>
        <p className="mt-1 font-ui text-[13px] text-muted-foreground">
          This could be a timeout or connection issue.
        </p>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-5 h-9 px-5 rounded-md font-ui text-[13px] font-medium transition-opacity disabled:opacity-60"
          style={{ background: "#D4A017", color: "#0D1B2A" }}
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
        {onSkip && (
          <>
            <p className="mt-3 font-ui text-[11px] text-muted-foreground">or</p>
            <button
              onClick={onSkip}
              className="mt-1 font-ui text-[12px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Skip this platform
            </button>
          </>
        )}
      </div>
    </div>
  );
}
