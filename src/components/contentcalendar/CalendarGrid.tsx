import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarSlot, platformStyles, platformLabel } from "./types";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  slots: CalendarSlot[];
  year: number;
  month: number; // 0-11
  view: "month" | "week";
  onChangeMonth: (year: number, month: number) => void;
  onChangeView: (v: "month" | "week") => void;
  onGoToday: () => void;
  onSlotClick: (slot: CalendarSlot) => void;
  onEmptyClick: (date: string) => void;
  loading?: boolean;
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 17 }, (_, i) => i + 6);

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const dayOfWeek = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(start.getDate() - dayOfWeek);
  const days: Date[] = [];
  const current = new Date(start);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function CalendarGrid({
  slots,
  year,
  month,
  view,
  onChangeMonth,
  onChangeView,
  onGoToday,
  onSlotClick,
  onEmptyClick,
  loading,
}: CalendarGridProps) {
  const today = new Date();
  const todayKey = toKey(today);

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  const slotMap = useMemo(() => {
    const map: Record<string, CalendarSlot[]> = {};
    slots.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [slots]);

  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    if (month === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, month + 1);
  };

  const weekStart = useMemo(() => {
    const d = new Date(today);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }, [todayKey]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const renderSlot = (slot: CalendarSlot) => {
    const ps = platformStyles[slot.platform] || {
      bg: "rgba(138,150,163,0.15)",
      text: "#8A96A3",
      dot: "#8A96A3",
    };
    return (
      <button
        key={slot.id}
        onClick={(e) => {
          e.stopPropagation();
          onSlotClick(slot);
        }}
        className="w-full flex items-center gap-1 rounded-md px-2 py-1 mb-1 text-left transition-colors hover:opacity-80 truncate"
        style={{ backgroundColor: ps.bg }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: ps.dot }}
        />
        <span
          className="text-[11px] font-ui truncate flex-1"
          style={{ color: ps.text }}
        >
          {slot.title || platformLabel(slot.platform)}
        </span>
        <span
          className="text-[10px] font-ui flex-shrink-0"
          style={{ color: ps.text }}
        >
          {slot.time}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-10 z-[8] bg-background border-b border-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-display text-[20px] text-foreground">{monthName}</h2>
          <button
            onClick={nextMonth}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
          >
            <ChevronRight size={18} />
          </button>
          {loading && (
            <span className="text-[11px] font-ui text-muted-foreground">
              Loading…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => onChangeView("month")}
              className={cn(
                "px-3 py-1.5 text-[12px] font-ui transition-colors",
                view === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              Month
            </button>
            <button
              onClick={() => onChangeView("week")}
              className={cn(
                "px-3 py-1.5 text-[12px] font-ui transition-colors",
                view === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              Week
            </button>
          </div>
          <button
            onClick={onGoToday}
            className="h-8 px-3 rounded-lg border border-border text-[12px] font-ui text-foreground hover:bg-muted/50 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "month" ? (
          <div className="min-w-0">
            <div className="grid grid-cols-7 border-b border-border">
              {dayNames.map((d) => (
                <div
                  key={d}
                  className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui text-center py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((day, i) => {
                const key = toKey(day);
                const isCurrentMonth = day.getMonth() === month;
                const isToday = key === todayKey;
                const daySlots = slotMap[key] || [];
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[100px] border-r border-b border-border p-1.5 relative group",
                      !isCurrentMonth && "bg-muted/20"
                    )}
                  >
                    <div className="flex justify-end mb-1">
                      <span
                        className={cn(
                          "text-[12px] font-ui font-medium w-6 h-6 flex items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground",
                          !isCurrentMonth && "text-muted-foreground/40",
                          isCurrentMonth && !isToday && "text-foreground"
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    {daySlots.map(renderSlot)}
                    {daySlots.length === 0 && isCurrentMonth && (
                      <button
                        onClick={() => onEmptyClick(key)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus size={14} className="text-muted-foreground/30" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0">
            <div className="w-12 flex-shrink-0 border-r border-border">
              <div className="h-10" />
              {hours.map((h) => (
                <div
                  key={h}
                  className="h-12 flex items-start justify-end pr-2 pt-0.5"
                >
                  <span className="text-[10px] font-ui text-muted-foreground">
                    {pad(h)}:00
                  </span>
                </div>
              ))}
            </div>

            {weekDays.map((day, i) => {
              const key = toKey(day);
              const isToday = key === todayKey;
              const daySlots = slotMap[key] || [];
              return (
                <div key={i} className="flex-1 min-w-0 border-r border-border">
                  <div
                    className={cn(
                      "h-10 flex flex-col items-center justify-center border-b border-border",
                      isToday && "bg-primary/10"
                    )}
                  >
                    <span className="text-[10px] font-ui uppercase text-muted-foreground">
                      {dayNames[i]}
                    </span>
                    <span
                      className={cn(
                        "text-[13px] font-ui font-medium",
                        isToday ? "text-primary" : "text-foreground"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="relative">
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="h-12 border-b border-border/50 group cursor-pointer"
                        onClick={() => onEmptyClick(key)}
                      >
                        <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={10} className="text-muted-foreground/30" />
                        </div>
                      </div>
                    ))}
                    {daySlots.map((slot) => {
                      const [hStr] = slot.time.split(":");
                      const hour = parseInt(hStr, 10);
                      const topOffset = (hour - 6) * 48;
                      const ps = platformStyles[slot.platform] || {
                        bg: "rgba(138,150,163,0.15)",
                        text: "#8A96A3",
                        dot: "#8A96A3",
                      };
                      return (
                        <button
                          key={slot.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlotClick(slot);
                          }}
                          className="absolute left-1 right-1 rounded-md px-2 py-1 text-left z-[1]"
                          style={{
                            top: topOffset,
                            height: 44,
                            backgroundColor: ps.bg,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                            style={{ backgroundColor: ps.dot }}
                          />
                          <span
                            className="text-[11px] font-ui"
                            style={{ color: ps.text }}
                          >
                            {slot.title || platformLabel(slot.platform)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
