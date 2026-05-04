import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  platformName: string;
  initialDate?: string; // YYYY-MM-DD
  initialTime?: string; // HH:MM
  onConfirm: (date: string, time: string) => Promise<void> | void;
  confirmLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function ScheduleModal({
  open,
  onOpenChange,
  platformName,
  initialDate,
  initialTime,
  onConfirm,
  confirmLabel = "Schedule",
}: Props) {
  const [date, setDate] = useState<Date | undefined>();
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialDate) {
      const [y, m, d] = initialDate.split("-").map(Number);
      setDate(new Date(y, m - 1, d));
    } else {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      setDate(t);
    }
    if (initialTime) {
      const [h, mi] = initialTime.split(":");
      setHour(h);
      setMinute(mi);
    } else {
      setHour("09");
      setMinute("00");
    }
  }, [open, initialDate, initialTime]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleConfirm = async () => {
    if (!date) return;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const timeStr = `${hour}:${minute}`;
    setBusy(true);
    try {
      await onConfirm(dateStr, timeStr);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-[18px]">
            Schedule {platformName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-ui mb-1.5">
              Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < today}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-ui mb-1.5">
              Time (24h)
            </label>
            <div className="flex items-center gap-2">
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="flex-1 h-10 rounded-md border border-input bg-background px-2.5 text-[13px] font-ui"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-foreground">:</span>
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="flex-1 h-10 rounded-md border border-input bg-background px-2.5 text-[13px] font-ui"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="text-[12px] font-ui text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleConfirm}
            disabled={!date || busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
