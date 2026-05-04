import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ApproveSchedulePlatform {
  creativeId: string;
  platformName: string;
  platformColor?: string;
  alreadyScheduled?: boolean;
}

interface PlatformSchedule {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  platforms: ApproveSchedulePlatform[];
  /** Schedules selected platforms in order. Throws to abort. */
  onScheduleSelected: (
    items: { creativeId: string; date: string; time: string }[],
    onProgress: (current: number, total: number, name: string) => void,
  ) => Promise<void>;
  /** Approve all without scheduling. */
  onApproveOnly: () => Promise<void>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function ApproveScheduleAllModal({
  open,
  onOpenChange,
  platforms,
  onScheduleSelected,
  onApproveOnly,
}: Props) {
  const eligible = useMemo(
    () => platforms.filter((p) => !p.alreadyScheduled),
    [platforms],
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [perPlatform, setPerPlatform] = useState(false);
  const [globalDate, setGlobalDate] = useState<string>(todayStr());
  const [globalHour, setGlobalHour] = useState("09");
  const [globalMinute, setGlobalMinute] = useState("00");
  const [individual, setIndividual] = useState<Record<string, PlatformSchedule>>({});
  const [busy, setBusy] = useState(false);
  const [busyOnly, setBusyOnly] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, boolean> = {};
    const ind: Record<string, PlatformSchedule> = {};
    eligible.forEach((p) => {
      init[p.creativeId] = true;
      ind[p.creativeId] = { date: todayStr(), time: "09:00" };
    });
    setSelected(init);
    setIndividual(ind);
    setPerPlatform(false);
    setGlobalDate(todayStr());
    setGlobalHour("09");
    setGlobalMinute("00");
    setProgress(null);
  }, [open, eligible]);

  const checkedIds = Object.keys(selected).filter((id) => selected[id]);
  const checkedCount = checkedIds.length;

  const handleConfirm = async () => {
    if (!checkedCount) return;
    const items = checkedIds.map((id) => {
      if (perPlatform) {
        const s = individual[id] || { date: globalDate, time: `${globalHour}:${globalMinute}` };
        return { creativeId: id, date: s.date, time: s.time };
      }
      return { creativeId: id, date: globalDate, time: `${globalHour}:${globalMinute}` };
    });
    setBusy(true);
    try {
      await onScheduleSelected(items, (current, total, name) =>
        setProgress({ current, total, name }),
      );
      onOpenChange(false);
    } catch {
      // toast handled by caller
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleApproveOnly = async () => {
    setBusyOnly(true);
    try {
      await onApproveOnly();
      onOpenChange(false);
    } finally {
      setBusyOnly(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-[18px]">
            Approve & Schedule All
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {eligible.length === 0 ? (
            <p className="text-[12px] font-ui text-muted-foreground">
              No platforms available to schedule.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                {eligible.map((p) => {
                  const isChecked = !!selected[p.creativeId];
                  const sched = individual[p.creativeId];
                  return (
                    <div
                      key={p.creativeId}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [p.creativeId]: !!v }))
                        }
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: p.platformColor || "#8A96A3" }}
                      />
                      <span className="flex-1 text-[13px] font-ui text-foreground truncate">
                        {p.platformName}
                      </span>
                      {perPlatform && isChecked && sched && (
                        <div className="flex items-center gap-1.5">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-ui"
                              >
                                <CalendarIcon className="mr-1 h-3 w-3" />
                                {format(parseDate(sched.date), "MMM d")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                selected={parseDate(sched.date)}
                                onSelect={(d) => {
                                  if (!d) return;
                                  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                  setIndividual((prev) => ({
                                    ...prev,
                                    [p.creativeId]: { ...prev[p.creativeId], date: s },
                                  }));
                                }}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <input
                            type="time"
                            value={sched.time}
                            onChange={(e) =>
                              setIndividual((prev) => ({
                                ...prev,
                                [p.creativeId]: { ...prev[p.creativeId], time: e.target.value },
                              }))
                            }
                            className="h-8 rounded-md border border-input bg-background px-1.5 text-[11px] font-ui"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!perPlatform && (
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
                    Schedule all selected for:
                  </div>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 justify-start text-left font-normal h-10"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(parseDate(globalDate), "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseDate(globalDate)}
                          onSelect={(d) => {
                            if (!d) return;
                            setGlobalDate(
                              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                            );
                          }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <select
                      value={globalHour}
                      onChange={(e) => setGlobalHour(e.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-2 text-[13px] font-ui"
                    >
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span>:</span>
                    <select
                      value={globalMinute}
                      onChange={(e) => setGlobalMinute(e.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-2 text-[13px] font-ui"
                    >
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="text-[12px] font-ui text-foreground">
                  Use different times per platform
                </label>
                <Switch checked={perPlatform} onCheckedChange={setPerPlatform} />
              </div>

              {progress && (
                <div className="text-[12px] font-ui text-muted-foreground pt-2 border-t border-border">
                  Scheduling {progress.name}… {progress.current} of {progress.total}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handleApproveOnly}
            disabled={busy || busyOnly || eligible.length === 0}
            className="text-[12px] font-ui text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {busyOnly ? "Approving…" : "Approve only (schedule later)"}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="text-[12px] font-ui text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleConfirm}
              disabled={!checkedCount || busy || eligible.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Approve & Schedule
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
