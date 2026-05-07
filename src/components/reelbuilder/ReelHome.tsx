import { useState } from "react";
import { Plus, Play, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface Props {
  brandName: string;
  onNewReel: () => void;
  onOpenRecent: () => void;
  onUseTemplate: (topic: string, tone: string) => void;
}

const recentReels = [
  {
    name: "Nordform Origin Story",
    platform: "Instagram Reels",
    duration: "60s · 5 scenes",
    date: "Created 4 days ago",
    colors: ["hsl(160 25% 14%)", "hsl(160 25% 17%)", "hsl(160 25% 12%)"],
  },
  {
    name: "Meet Your Morning — Ep.1",
    platform: "TikTok",
    duration: "45s · 4 scenes",
    date: "Created 1 week ago",
    colors: ["hsl(160 20% 13%)", "hsl(160 20% 16%)", "hsl(160 20% 11%)"],
  },
  {
    name: "The Science Behind Daily Stack",
    platform: "YouTube Shorts",
    duration: "90s · 7 scenes",
    date: "Created 2 weeks ago",
    colors: ["hsl(160 15% 12%)", "hsl(160 15% 15%)", "hsl(160 15% 10%)"],
  },
];

const stats = [
  { label: "Total reels", value: "8" },
  { label: "Total scenes", value: "42" },
  { label: "This month", value: "2" },
];

const templates = [
  {
    name: "Brand Origin Story",
    sceneColors: ["#2A1A0A", "#1A1A0A", "#0A1A1A"],
    scenes: "5 scenes · 60s",
    tags: ["Origin", "Warm"],
    uses: "3.2k uses",
    tone: "Warm and personal",
    sceneList: [
      { num: "01", title: "Establishing shot", time: "0:00–0:12", visual: "Aerial shot of Stockholm at golden hour. Camera descends toward a kitchen counter with the Nordform Daily Stack." },
      { num: "02", title: "The problem", time: "0:12–0:24", visual: "Close-up hands sorting through supplement bottles. Clean Nordic light. Deliberate motion." },
      { num: "03", title: "The build", time: "0:24–0:36", visual: "The formulation process. Lab setting. Clean, minimal, evidence-based." },
      { num: "04", title: "The product", time: "0:36–0:48", visual: "The Daily Stack on a marble kitchen counter. Stockholm apartment visible through window." },
      { num: "05", title: "The CTA", time: "0:48–1:00", visual: "The Nordform packaging centred on a clean surface. Logo reveal. Forest green fills the frame edge." },
    ],
    bestFor: "Instagram Reels, TikTok",
  },
  {
    name: "Product Demo",
    sceneColors: ["#0A1A2A", "#1A2A1A", "#2A1A1A"],
    scenes: "4 scenes · 45s",
    tags: ["Product", "Bold"],
    uses: "2.8k uses",
    tone: "Bold and energetic",
    sceneList: [
      { num: "01", title: "Hook", time: "0:00–0:11", visual: "Bold product close-up with dynamic lighting." },
      { num: "02", title: "Features", time: "0:11–0:22", visual: "Quick cuts showing product details and usage." },
      { num: "03", title: "Benefits", time: "0:22–0:33", visual: "Lifestyle shot showing the product in context." },
      { num: "04", title: "CTA", time: "0:33–0:45", visual: "Product packaging with brand logo and purchase link." },
    ],
    bestFor: "Instagram Reels, YouTube Shorts",
  },
  {
    name: "Behind The Scenes",
    sceneColors: ["#1A1A2A", "#2A1A2A", "#1A2A2A"],
    scenes: "6 scenes · 90s",
    tags: ["Authentic", "Casual"],
    uses: "2.4k uses",
    tone: "Warm and personal",
    sceneList: [
      { num: "01", title: "Intro", time: "0:00–0:15", visual: "Raw, handheld opening of the workspace." },
      { num: "02", title: "Process", time: "0:15–0:30", visual: "Candid shots of the team working." },
      { num: "03", title: "Details", time: "0:30–0:45", visual: "Close-ups of craft and care in production." },
      { num: "04", title: "People", time: "0:45–1:00", visual: "Team members sharing quick thoughts." },
      { num: "05", title: "Result", time: "1:00–1:15", visual: "The finished product or outcome." },
      { num: "06", title: "Outro", time: "1:15–1:30", visual: "Invitation to follow for more." },
    ],
    bestFor: "TikTok, Instagram Reels",
  },
  {
    name: "Customer Testimonial",
    sceneColors: ["#0A2A1A", "#1A2A0A", "#2A2A0A"],
    scenes: "3 scenes · 30s",
    tags: ["Social proof", "Warm"],
    uses: "2.1k uses",
    tone: "Warm and personal",
    sceneList: [
      { num: "01", title: "Introduction", time: "0:00–0:10", visual: "Customer in their environment, natural setting." },
      { num: "02", title: "Story", time: "0:10–0:20", visual: "Customer sharing their experience with the product." },
      { num: "03", title: "Endorsement", time: "0:20–0:30", visual: "Product shot with customer's recommendation." },
    ],
    bestFor: "Instagram Reels, Facebook Reels",
  },
  {
    name: "Launch Countdown",
    sceneColors: ["#2A0A0A", "#2A1A0A", "#2A2A0A"],
    scenes: "5 scenes · 60s",
    tags: ["Launch", "Urgent"],
    uses: "1.9k uses",
    tone: "Bold and energetic",
    sceneList: [
      { num: "01", title: "Teaser", time: "0:00–0:12", visual: "Mysterious close-ups building anticipation." },
      { num: "02", title: "Reveal hints", time: "0:12–0:24", visual: "Partial product reveals with dramatic lighting." },
      { num: "03", title: "Features", time: "0:24–0:36", visual: "Key features shown with bold text overlays." },
      { num: "04", title: "Date reveal", time: "0:36–0:48", visual: "Launch date with countdown visual." },
      { num: "05", title: "CTA", time: "0:48–1:00", visual: "Sign up or follow prompt with urgency." },
    ],
    bestFor: "Instagram Reels, TikTok",
  },
  {
    name: "Day In The Life",
    sceneColors: ["#1A0A2A", "#0A1A2A", "#0A2A1A"],
    scenes: "7 scenes · 90s",
    tags: ["Lifestyle", "Personal"],
    uses: "1.7k uses",
    tone: "Warm and personal",
    sceneList: [
      { num: "01", title: "Morning", time: "0:00–0:13", visual: "Waking up, morning routine establishing shot." },
      { num: "02", title: "Commute", time: "0:13–0:26", visual: "Journey to work or studio." },
      { num: "03", title: "Work", time: "0:26–0:39", visual: "Key work moments and tasks." },
      { num: "04", title: "Break", time: "0:39–0:52", visual: "Lunch or coffee break moment." },
      { num: "05", title: "Afternoon", time: "0:52–1:05", visual: "Afternoon productivity and meetings." },
      { num: "06", title: "Wind down", time: "1:05–1:18", visual: "End of day transition." },
      { num: "07", title: "Reflection", time: "1:18–1:30", visual: "Closing thoughts to camera." },
    ],
    bestFor: "TikTok, YouTube Shorts",
  },
  {
    name: "Educational Tips",
    sceneColors: ["#0A0A2A", "#1A0A1A", "#2A0A2A"],
    scenes: "4 scenes · 45s",
    tags: ["Value", "Professional"],
    uses: "1.5k uses",
    tone: "Calm and considered",
    sceneList: [
      { num: "01", title: "Hook question", time: "0:00–0:11", visual: "Bold text question on screen with speaker." },
      { num: "02", title: "Tip 1 & 2", time: "0:11–0:22", visual: "Quick demonstrations with text overlays." },
      { num: "03", title: "Tip 3", time: "0:22–0:33", visual: "Final tip with deeper explanation." },
      { num: "04", title: "Summary CTA", time: "0:33–0:45", visual: "Recap and follow prompt." },
    ],
    bestFor: "TikTok, Instagram Reels",
  },
  {
    name: "Event Highlight",
    sceneColors: ["#2A2A0A", "#1A2A2A", "#0A2A2A"],
    scenes: "5 scenes · 60s",
    tags: ["Event", "Energetic"],
    uses: "1.3k uses",
    tone: "Bold and energetic",
    sceneList: [
      { num: "01", title: "Arrival", time: "0:00–0:12", visual: "Venue establishing shot with energy." },
      { num: "02", title: "Highlights", time: "0:12–0:24", visual: "Best moments montage with music." },
      { num: "03", title: "People", time: "0:24–0:36", visual: "Attendees enjoying the event." },
      { num: "04", title: "Key moment", time: "0:36–0:48", visual: "The main event or reveal." },
      { num: "05", title: "Wrap up", time: "0:48–1:00", visual: "Thank you and next event teaser." },
    ],
    bestFor: "Instagram Reels, YouTube Shorts",
  },
];

export function ReelHome({ brandName, onNewReel, onOpenRecent, onUseTemplate }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="hidden md:block font-display text-2xl text-foreground">ReelBuilder</h1>
          <p className="text-[13px] text-muted-foreground md:mt-1">{brandName}</p>
        </div>
        <Button onClick={onNewReel} className="h-12 px-6 gap-2">
          <Plus size={18} /> New reel
        </Button>
      </div>

      {/* Recent reels */}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-4">Recent reels</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {recentReels.map((reel, i) => (
          <div
            key={i}
            onClick={onOpenRecent}
            className="rounded-xl border border-border overflow-hidden cursor-pointer hover:-translate-y-px transition-transform bg-card"
          >
            <div className="h-[140px] relative flex">
              {reel.colors.map((c, ci) => (
                <div key={ci} className="flex-1" style={{ backgroundColor: c }} />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(45,74,62,0.9)" }}>
                  <Play size={18} className="text-[#F5F0E8] ml-0.5" fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="p-3.5 px-4">
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-[10px] bg-primary/15 text-primary mb-1.5">{reel.platform}</span>
              <p className="text-sm font-medium text-foreground">{reel.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{reel.duration}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-muted-foreground">{reel.date}</p>
                <span className="text-[12px] text-primary cursor-pointer">Open</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 text-center">
            <p className="font-display text-2xl text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Reel templates */}
      <div className="flex items-center justify-between mt-10 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reel templates</p>
        <span className="text-[12px] text-primary cursor-pointer">Browse all</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {templates.map((t, i) => (
          <div
            key={i}
            onClick={() => setSelectedTemplate(t)}
            className="w-[220px] flex-shrink-0 rounded-xl border border-border overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 transition-all bg-card"
          >
            <div className="h-0.5 bg-primary" />
            <div className="h-[120px] flex">
              {t.sceneColors.map((c, ci) => (
                <div key={ci} className="flex-1" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="p-3.5 px-4">
              <p className="text-[13px] font-medium text-foreground">{t.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.scenes}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {t.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">{tag}</span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground text-right mt-1.5">{t.uses}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Template modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-[760px] w-[90vw] p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">{selectedTemplate?.name} template</DialogTitle>
          {selectedTemplate && (
            <div className="flex flex-col md:flex-row max-h-[85vh]">
              <div className="md:w-[45%] p-7 bg-muted/30 overflow-y-auto">
                <h2 className="font-display text-xl text-foreground">{selectedTemplate.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-medium">PT</div>
                  <span className="text-[13px] text-muted-foreground">ProStudio Team</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground ml-auto">{selectedTemplate.uses}</span>
                </div>

                <div className="border-t border-border my-4" />

                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Scene structure</p>
                <div className="flex flex-col gap-2">
                  {selectedTemplate.sceneList.map((s) => (
                    <div key={s.num} className="flex items-center gap-3">
                      <span className="text-[11px] text-primary font-medium w-6">Scene {s.num}</span>
                      <span className="text-[12px] text-foreground flex-1">{s.title}</span>
                      <span className="text-[10px] text-muted-foreground">{s.time}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tone</p>
                  <p className="text-[12px] text-foreground mt-0.5">{selectedTemplate.tone}</p>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Best for</p>
                  <p className="text-[12px] text-foreground mt-0.5">{selectedTemplate.bestFor}</p>
                </div>

                <Button
                  onClick={() => {
                    const t = selectedTemplate;
                    setSelectedTemplate(null);
                    onUseTemplate(t.name, t.tone);
                  }}
                  className="w-full h-11 rounded-lg mt-5"
                >
                  Use this template
                </Button>
                <p className="text-[12px] text-primary text-center mt-2.5 cursor-pointer">Preview example</p>
              </div>

              <div className="md:w-[55%] bg-[hsl(160_25%_5%)] p-6 flex flex-col gap-3 overflow-y-auto">
                {selectedTemplate.sceneList.map((s) => (
                  <div key={s.num} className="rounded-lg p-3 border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                    <p className="text-[10px] text-primary font-medium">Scene {s.num}</p>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: "hsl(38 30% 90%)" }}>{s.title}</p>
                    <p className="text-[11px] leading-relaxed mt-1" style={{ color: "hsl(160 15% 55%)" }}>{s.visual}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
