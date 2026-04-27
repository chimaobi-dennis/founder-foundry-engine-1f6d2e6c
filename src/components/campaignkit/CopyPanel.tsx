import { useState } from "react";
import { Copy, RefreshCw, Download, Bookmark, CalendarPlus } from "lucide-react";
import { PlatformTab, PlatformContent } from "./types";
import { toast } from "@/hooks/use-toast";
import { safeCopyToClipboard } from "@/lib/clipboard";

interface Props {
  tab: PlatformTab;
  content: PlatformContent;
}

const nextDays = () => {
  const days: { label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      label: d.toLocaleDateString("en-GB", { weekday: "short" }) + " " + d.getDate(),
      date: d,
    });
  }
  return days;
};

const timeSlots = ["09:00", "12:00", "17:00", "20:00"];

export function CopyPanel({ tab, content }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selDay, setSelDay] = useState(0);
  const [selTime, setSelTime] = useState("09:00");
  const days = nextDays();

  const displayText = tab === "Headlines" ? "" : (content.copy || "");
  const wordCount = displayText.trim().split(/\s+/).filter(Boolean).length;

  const handleCopy = async () => {
    await safeCopyToClipboard(displayText);
    toast({ title: "Copied to clipboard" });
  };

  const handleSaveToCalendar = () => {
    const day = days[selDay];
    toast({
      title: `Added to ContentCalendar — ${day.label} Mar at ${selTime}`,
    });
    setShowCalendar(false);
  };

  if (tab === "Headlines") return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h4 className="text-[13px] font-ui font-medium uppercase tracking-wider text-muted-foreground mb-4">
        {tab}
      </h4>

      {content.subject && (
        <p className="text-sm font-ui font-medium text-foreground mb-2">Subject: {content.subject}</p>
      )}
      {content.headline && (
        <p className="text-sm font-ui font-medium text-foreground mb-2">{content.headline}</p>
      )}

      <p className="text-sm font-ui text-foreground leading-[1.7] whitespace-pre-line">{displayText}</p>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleCopy}
          className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors"
        >
          <Copy size={12} /> Copy text
        </button>
        <button className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-primary text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-colors">
          <RefreshCw size={12} /> Regenerate this
        </button>
        <span className="text-[11px] text-muted-foreground font-ui ml-auto">{wordCount} words</span>
      </div>

      <div className="border-t border-border mt-4 pt-4 flex items-center gap-3 flex-wrap">
        <button className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors">
          <Bookmark size={12} /> Save to Library
        </button>
        <button className="text-[12px] font-ui px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors">
          <Download size={12} /> Download creative
        </button>
        <div className="relative">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="text-[12px] font-ui px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
          >
            <CalendarPlus size={12} /> Save to Calendar
          </button>

          {showCalendar && (
            <div className="absolute bottom-full mb-2 right-0 w-[260px] rounded-xl border border-border bg-card shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Platform</p>
              <div className="text-[12px] font-ui text-foreground mb-3 px-2 py-1 rounded-md bg-muted/50 border border-border inline-block">
                {tab}
              </div>

              <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Date</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {days.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelDay(i)}
                    className={`text-[11px] font-ui px-2 py-1 rounded-full transition-colors ${
                      selDay === i
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Time</p>
              <select
                value={selTime}
                onChange={(e) => setSelTime(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[12px] font-ui text-foreground mb-3"
              >
                {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <button
                onClick={handleSaveToCalendar}
                className="w-full h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-ui font-medium hover:bg-primary/90 transition-colors"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
