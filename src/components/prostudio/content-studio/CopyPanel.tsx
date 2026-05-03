import { useState } from "react";
import { RefreshCw, CalendarPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasItem } from "../CanvasSwitcher";

interface CopyPanelProps {
  canvas: CanvasItem;
  onChange?: (patch: Partial<CanvasItem>) => void;
  onSave?: (patch: Partial<CanvasItem>) => void;
  onRegenerateVisual?: () => void;
  onApproveClick?: () => void;
  regenerating?: boolean;
  isApproved?: boolean;
}

export function CopyPanel({
  canvas,
  onChange,
  onSave,
  onRegenerateVisual,
  onApproveClick,
  regenerating,
  isApproved,
}: CopyPanelProps) {
  const isGenerating = canvas.status === "generating";
  const isEmail = canvas.platformSlug === "email";
  const isSocial = ["instagram", "twitter_x", "facebook_ad"].includes(canvas.platformSlug || "");
  const charCount = (canvas.copyText || "").length;
  const wordCount = (canvas.copyText || "").trim().split(/\s+/).filter(Boolean).length;
  const limit = canvas.characterLimit || null;

  const handleFieldChange = (field: keyof CanvasItem, value: any) => {
    onChange?.({ [field]: value });
  };

  const handleFieldSave = (field: keyof CanvasItem, value: any) => {
    onSave?.({ [field]: value });
  };

  if (isGenerating) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-card overflow-hidden">
        <div className="px-4 pr-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
              style={{ background: canvas.platformIcon || "#8A96A3" }}
            />
            <h3 className="font-ui text-[13px] font-semibold text-foreground uppercase tracking-wider truncate">
              {canvas.label}
            </h3>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pr-4 py-4 space-y-4">
          <style>{`
            @keyframes copy-skel { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
          `}</style>
          {isEmail && <SkeletonField labelHeight={10} barHeight={40} />}
          <SkeletonField labelHeight={10} barHeight={40} />
          <SkeletonField labelHeight={10} barHeight={140} lines={5} />
          {isSocial && (
            <div>
              <div className="h-[10px] w-16 rounded mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="flex flex-wrap gap-1.5">
                {[40, 60, 50, 35].map((w, i) => (
                  <div
                    key={i}
                    className="h-5 rounded-full"
                    style={{
                      width: w,
                      background: "rgba(212,160,23,0.10)",
                      animation: `copy-skel 1.6s ease-in-out infinite`,
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-4 pr-4 py-3 border-t border-border space-y-2 flex-shrink-0">
          <div className="w-full h-9 rounded-md" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="w-full h-10 rounded-md" style={{ background: "rgba(212,160,23,0.18)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-card overflow-hidden">
      <div className="px-4 pr-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: canvas.platformIcon || "#8A96A3" }}
          />
          <h3 className="font-ui text-[13px] font-semibold text-foreground uppercase tracking-wider truncate">
            {canvas.label}
          </h3>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pr-4 py-4 space-y-4">
        {isEmail && (
          <Field label="Subject line">
            <input
              value={canvas.subjectLine || ""}
              onChange={(e) => handleFieldChange("subjectLine", e.target.value)}
              onBlur={(e) => handleFieldSave("subjectLine", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-2.5 text-[13px] font-ui"
            />
          </Field>
        )}

        <Field label="Headline">
          <input
            value={canvas.headline || ""}
            onChange={(e) => handleFieldChange("headline", e.target.value)}
            onBlur={(e) => handleFieldSave("headline", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-2.5 text-[13px] font-ui"
          />
        </Field>

        <Field label="Copy">
          <textarea
            value={canvas.copyText || ""}
            onChange={(e) => handleFieldChange("copyText", e.target.value)}
            onBlur={(e) => handleFieldSave("copyText", e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-[13px] font-ui resize-none"
          />
          <div className="flex items-center justify-between mt-1.5 text-[11px] font-ui text-muted-foreground">
            <span>{wordCount} words</span>
            <span className={cn(limit && charCount > limit && "text-destructive")}>
              {charCount}
              {limit ? ` / ${limit}` : ""} chars
            </span>
          </div>
        </Field>

        {isSocial && (
          <Field label="Hashtags">
            <div className="flex flex-wrap gap-1.5">
              {(canvas.hashtags || []).map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] font-ui px-2 py-1 rounded-full bg-primary/10 text-primary"
                >
                  #{h.replace(/^#/, "")}
                </span>
              ))}
              {(!canvas.hashtags || canvas.hashtags.length === 0) && (
                <span className="text-[12px] font-ui text-muted-foreground">No hashtags</span>
              )}
            </div>
          </Field>
        )}
      </div>
      <div className="px-4 pr-4 py-3 border-t border-border space-y-2 flex-shrink-0">
        <button
          onClick={onRegenerateVisual}
          disabled={regenerating}
          className="w-full h-9 rounded-md border border-border text-[12px] font-ui hover:bg-muted/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {regenerating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Regenerate visual
        </button>
        <button
          onClick={onApproveClick}
          disabled={canvas.status !== "ready" || isApproved}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-[13px] font-ui font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <CalendarPlus size={14} />
          {isApproved ? "Approved" : "Approve & Schedule"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-ui text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
