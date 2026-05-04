import { useEffect, useState, useRef } from "react";
import { X, Trash2, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CalendarSlot, platformStyles, platformLabel } from "./types";
import { ScheduleModal } from "@/components/prostudio/content-studio/ScheduleModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteCalendarPost,
} from "@/services/calendarService";
import { rescheduleCreative } from "@/services/contentStudioService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

interface SlotDetailProps {
  slot: CalendarSlot | null;
  onClose: () => void;
  onChanged: () => void;
}

export function SlotDetail({ slot, onClose, onChanged }: SlotDetailProps) {
  const navigate = useNavigate();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [briefIdState, setBriefIdState] = useState<string | null>(slot?.briefId ?? null);
  const fetchedFor = useRef<string | null>(null);

  // Resolve brief id from the linked content_studio_creative if not provided.
  useEffect(() => {
    if (!slot?.calendarPostId || slot.briefId || fetchedFor.current === slot.id) {
      setBriefIdState(slot?.briefId ?? null);
      return;
    }
    fetchedFor.current = slot.id;
    (async () => {
      const { data } = await db
        .from("calendar_posts")
        .select("content_studio_creatives(brief_id)")
        .eq("id", slot.calendarPostId)
        .maybeSingle();
      const bid = data?.content_studio_creatives?.brief_id ?? null;
      setBriefIdState(bid);
    })();
  }, [slot?.id]);

  if (!slot) return null;

  const ps = platformStyles[slot.platform] || {
    bg: "rgba(138,150,163,0.15)",
    text: "#8A96A3",
    dot: "#8A96A3",
  };
  const label = platformLabel(slot.platform);
  const dt = new Date(slot.date);
  const formattedDate = dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleReschedule = async (date: string, time: string) => {
    if (!slot.calendarPostId) {
      toast.error("Cannot reschedule this entry");
      return;
    }
    try {
      await rescheduleCreative(slot.calendarPostId, date, time);
      toast.success(`Rescheduled to ${date} at ${time}`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Failed to reschedule");
      throw e;
    }
  };

  const handleRemove = async () => {
    if (!slot.calendarPostId) return;
    try {
      await deleteCalendarPost(slot.calendarPostId);
      toast.success("Removed from calendar");
      setRemoveOpen(false);
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    }
  };

  const handleOpenStudio = () => {
    if (!briefIdState) {
      toast.info("This entry isn't linked to a brief");
      return;
    }
    navigate(`/content-studio/${briefIdState}`);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: ps.dot }}
            />
            <span className="text-[13px] font-ui font-medium text-foreground">
              {label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-[12px] font-ui text-muted-foreground inline-flex items-center gap-1.5">
            <CalendarIcon size={12} />
            {formattedDate} · {slot.time}
          </p>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-ui block mb-2">
              Visual
            </label>
            {slot.visualThumbUrl ? (
              <img
                src={slot.visualThumbUrl}
                alt={slot.title}
                className="w-full rounded-lg border border-border object-cover"
                style={{ maxHeight: 220 }}
              />
            ) : slot.visualHtml ? (
              <div
                className="w-full rounded-lg overflow-hidden bg-muted"
                style={{ height: 160 }}
              >
                <iframe
                  srcDoc={slot.visualHtml}
                  className="w-full h-full pointer-events-none"
                  sandbox=""
                />
              </div>
            ) : (
              <div
                className="w-full rounded-lg bg-muted/50 border border-border"
                style={{ height: 120 }}
              />
            )}
          </div>

          {(slot.headline || slot.title) && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-ui block mb-2">
                Headline
              </label>
              <p className="text-[13px] font-ui text-foreground leading-relaxed">
                {slot.headline || slot.title}
              </p>
            </div>
          )}

          {slot.copy && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-ui block mb-2">
                Copy
              </label>
              <p className="text-[13px] font-ui text-foreground leading-relaxed whitespace-pre-wrap">
                {slot.copy}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={handleOpenStudio}
            className="w-full h-10 rounded-lg border border-border text-[13px] font-ui text-foreground hover:bg-muted/50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={13} /> Open in Studio
          </button>
          <button
            onClick={() => setScheduleOpen(true)}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-ui font-medium hover:bg-primary/90 transition-colors"
          >
            Reschedule
          </button>
          <button
            onClick={() => setRemoveOpen(true)}
            className="w-full text-center text-[12px] font-ui text-muted-foreground hover:text-destructive inline-flex items-center justify-center gap-1 py-1"
          >
            <Trash2 size={12} /> Remove from calendar
          </button>
        </div>
      </div>

      <ScheduleModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        platformName={label}
        initialDate={slot.date}
        initialTime={slot.time}
        onConfirm={handleReschedule}
        confirmLabel="Reschedule"
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this from the calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              The scheduled post will be removed from your calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
