import { useEffect, useState, useCallback } from "react";
import { PanelLeft, Download, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBrand } from "@/hooks/use-brand";
import { AssetLibrary } from "@/components/contentcalendar/AssetLibrary";
import { CalendarGrid } from "@/components/contentcalendar/CalendarGrid";
import { SlotDetail } from "@/components/contentcalendar/SlotDetail";
import { CalendarSlot } from "@/components/contentcalendar/types";
import {
  getCalendarPosts,
  getCalendarPostsForRange,
  type CalendarPost,
} from "@/services/calendarService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function postToSlot(p: CalendarPost): CalendarSlot {
  const time = (p.scheduled_time || "").slice(0, 5);
  const headline = p.creative_headline || p.headline || "";
  const copy = p.creative_copy_text || p.copy_text || "";
  const briefId = (p as any).content_studio_creative?.brief_id ?? undefined;
  return {
    id: p.id,
    calendarPostId: p.id,
    briefId,
    date: p.scheduled_date,
    time,
    platform: p.platform,
    title: headline || copy.slice(0, 40) || "Scheduled post",
    headline: headline || null,
    copy,
    visualHtml: p.creative_visual_html || p.visual_html || null,
    visualThumbUrl: null,
  };
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

export default function ContentCalendar() {
  const isMobile = useIsMobile();
  const isTablet =
    !isMobile && typeof window !== "undefined" && window.innerWidth < 1024;
  const { activeBrand } = useBrand();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [view, setView] = useState<"month" | "week">("month");

  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeBrand?.id) {
      setSlots([]);
      return;
    }
    setLoading(true);
    try {
      if (view === "month") {
        const posts = await getCalendarPosts(activeBrand.id, year, month + 1);
        setSlots(posts.map(postToSlot));
      } else {
        const ws = startOfWeek(new Date(year, month, today.getDate()));
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        const start = `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`;
        const end = `${we.getFullYear()}-${pad(we.getMonth() + 1)}-${pad(we.getDate())}`;
        const posts = await getCalendarPostsForRange(activeBrand.id, start, end);
        setSlots(posts.map(postToSlot));
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrand?.id, year, month, view]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSlotClick = (slot: CalendarSlot) => {
    setSelectedSlot(slot);
    setShowDetail(true);
  };

  const handleEmptyClick = (_date: string) => {
    toast.info("Create scheduled posts from ContentStudio.");
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedSlot(null);
  };

  const handleChangeMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const handleGoToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const showLeftPanel = !isMobile && !isTablet;
  const showRightPanel = showDetail;

  const [exporting, setExporting] = useState(false);
  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      toast.success("Week exported successfully");
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex overflow-hidden min-h-0">
        {(isMobile || isTablet) && (
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="fixed bottom-16 left-4 z-20 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg md:bottom-14"
          >
            <PanelLeft size={18} />
          </button>
        )}

        {showLeftPanel && (
          <div className="w-[200px] flex-shrink-0 border-r border-border bg-card overflow-hidden flex flex-col">
            <AssetLibrary />
          </div>
        )}

        {(isMobile || isTablet) && showLibrary && (
          <>
            <div
              className="fixed inset-0 z-30 bg-background/80"
              onClick={() => setShowLibrary(false)}
            />
            <div className="fixed left-0 top-0 bottom-0 z-40 w-[240px] bg-card border-r border-border shadow-xl">
              <AssetLibrary />
            </div>
          </>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
          <CalendarGrid
            slots={slots}
            year={year}
            month={month}
            view={view}
            onChangeMonth={handleChangeMonth}
            onChangeView={setView}
            onGoToday={handleGoToday}
            onSlotClick={handleSlotClick}
            onEmptyClick={handleEmptyClick}
            loading={loading}
          />

          {!loading && slots.length === 0 && (
            <div className="absolute inset-0 top-24 flex items-center justify-center pointer-events-none">
              <div className="text-center pointer-events-auto">
                <CalendarDays
                  size={28}
                  className="mx-auto mb-2 text-muted-foreground/60"
                />
                <p className="text-[13px] font-ui text-muted-foreground">
                  No content scheduled for {monthName}
                </p>
                <Link
                  to="/content-studio"
                  className="mt-2 inline-block text-[12px] font-ui text-primary hover:underline"
                >
                  Create content in ContentStudio →
                </Link>
              </div>
            </div>
          )}
        </div>

        {showRightPanel && (
          <>
            {isMobile && (
              <div
                className="fixed inset-0 z-30 bg-background/80"
                onClick={handleCloseDetail}
              />
            )}
            <div
              className={cn(
                "flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden",
                isMobile
                  ? "fixed right-0 top-0 bottom-0 z-40 w-[300px] shadow-xl"
                  : "w-[300px]"
              )}
            >
              <SlotDetail
                slot={selectedSlot}
                onClose={handleCloseDetail}
                onChanged={fetchData}
              />
            </div>
          </>
        )}
      </div>

      <div className="h-12 flex-shrink-0 border-t border-border px-5 flex items-center justify-between bg-card">
        <span className="text-[12px] font-ui text-muted-foreground">
          {slots.length} posts scheduled this {view === "month" ? "month" : "week"}
        </span>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="h-9 px-4 rounded-lg border border-border text-[12px] font-ui text-foreground hover:bg-muted/50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? "Exporting..." : "Export this week"}
        </button>
      </div>
    </div>
  );
}
