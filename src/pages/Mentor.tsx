import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, PanelRightOpen, PanelRightClose } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { BrandMilestonePanel } from "@/components/mentor/BrandMilestonePanel";
import { ChatPanel } from "@/components/mentor/ChatPanel";
import { BrandDNAPanel } from "@/components/mentor/BrandDNAPanel";
import { MentorEmptyState, MentorMode } from "@/components/mentor/MentorEmptyState";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { brands as allBrands, roastData, lagosData } from "@/components/mentor/data";
import { MentorBrand, BrandData, BrandDNAField, Message, InlineSavePrompt } from "@/components/mentor/types";

const TABLET_MAX = 1024;
const MENTOR_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-chat`;
const DETECT_MILESTONE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-milestone`;

let milestoneCounter = 100;

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(
    typeof window !== "undefined" ? window.innerWidth < TABLET_MAX : false
  );
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => setIsTablet(window.innerWidth < TABLET_MAX));
  }
  return isTablet;
}

const emptyDNAFields: BrandDNAField[] = [
  "Brand name", "Industry", "Voice", "Target audience", "Positioning",
  "Brand references", "Core promise", "Campaign strategy", "Customer insight", "Product positioning",
].map(key => ({ key, label: key, value: null }));

const aiResponses: Record<string, string> = {
  idea: "Interesting. Most people describe a solution — you are describing a feeling. That is actually the better starting point. Who specifically feels this problem most acutely? Not a demographic — a specific person. Describe them.",
  brand: "That is worth pulling on. Most founders know something is off before they can name it. What have you tried already to fix it — and why did it not work?",
  new: "Interesting. Most people describe a solution — you are describing a feeling. That is actually the better starting point. Who specifically feels this problem most acutely? Not a demographic — a specific person. Describe them.",
};

// DNA field detection patterns for auto-generating save prompts
const DNA_PATTERNS: { field: string; patterns: RegExp[] }[] = [
  { field: "Voice", patterns: [/brand voice.{0,10}(is|should be|:)\s*(.{10,80})/i, /voice.{0,10}(is|should be)\s*(.{10,80})/i] },
  { field: "Positioning", patterns: [/positioning.{0,10}(is|should be|:)\s*(.{10,80})/i, /position.{0,10}(is|should be)\s*(.{10,80})/i] },
  { field: "Target audience", patterns: [/target.{0,10}(audience|customer).{0,10}(is|are|:)\s*(.{10,80})/i] },
  { field: "Core promise", patterns: [/promise.{0,10}(is|should be|:)\s*(.{10,80})/i, /core promise.{0,10}(is|:)\s*(.{10,80})/i] },
  { field: "Brand references", patterns: [/reference.{0,10}(is|are|:)\s*(.{10,80})/i] },
];

function detectSavePrompts(content: string, messageId: string): InlineSavePrompt | null {
  for (const { field, patterns } of DNA_PATTERNS) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const value = (match[match.length - 1] || "").replace(/[.!?]+$/, "").trim();
        if (value.length > 8) {
          return {
            afterMessageId: messageId,
            label: `Save ${field.toLowerCase()}: ${value.slice(0, 60)}${value.length > 60 ? "..." : ""}`,
            dnaField: field,
            value,
          };
        }
      }
    }
  }
  return null;
}

let brandCounter = 0;
let msgCounter = 100;

const Mentor = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const [brands, setBrands] = useState<MentorBrand[]>(allBrands);
  const [activeBrandId, setActiveBrandId] = useState("nordform");

  const [brandDataMap, setBrandDataMap] = useState<Record<string, BrandData>>({
    nordform: roastData,
    sthlm: lagosData,
  });

  const [emptyBrands, setEmptyBrands] = useState<Record<string, MentorMode>>({});
  const [typingBrands, setTypingBrands] = useState<Set<string>>(new Set());
  const [chatError, setChatError] = useState<string | null>(null);
  const [slowThinking, setSlowThinking] = useState(false);
  const lastMessageRef = useRef<string>("");
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const mode = searchParams.get("mode") as MentorMode;
    if (mode === "idea" || mode === "brand") {
      brandCounter++;
      const newId = `cta-${brandCounter}`;
      const newBrand: MentorBrand = {
        id: newId,
        name: "Untitled Brand",
        colorClass: "bg-muted-foreground",
        startedDate: "Mar 2026",
      };
      const newData: BrandData = {
        brand: newBrand,
        milestones: [],
        messages: [],
        savePrompts: [],
        milestoneMarkers: [],
        dnaFields: emptyDNAFields.map(f => ({ ...f })),
      };
      setBrands(prev => [...prev, newBrand]);
      setBrandDataMap(prev => ({ ...prev, [newId]: newData }));
      setActiveBrandId(newId);
      setEmptyBrands(prev => ({ ...prev, [newId]: mode }));
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBrandData = brandDataMap[activeBrandId];
  const activeBrand = brands.find(b => b.id === activeBrandId) || brands[0];
  const activeEmptyMode = emptyBrands[activeBrandId] || null;
  const isTyping = typingBrands.has(activeBrandId);

  const [scrollToMilestoneId, setScrollToMilestoneId] = useState<string | null>(null);
  const [highlightDNAField, setHighlightDNAField] = useState<string | null>(null);

  const handleSelectBrand = (brand: MentorBrand) => {
    setActiveBrandId(brand.id);
  };

  const handleAddBrand = () => {
    brandCounter++;
    const newId = `new-${brandCounter}`;
    const newBrand: MentorBrand = {
      id: newId,
      name: "Untitled Brand",
      colorClass: "bg-muted-foreground",
      startedDate: "Mar 2026",
    };
    const newData: BrandData = {
      brand: newBrand,
      milestones: [],
      messages: [],
      savePrompts: [],
      milestoneMarkers: [],
      dnaFields: emptyDNAFields.map(f => ({ ...f })),
    };
    setBrands(prev => [...prev, newBrand]);
    setBrandDataMap(prev => ({ ...prev, [newId]: newData }));
    setActiveBrandId(newId);
    setEmptyBrands(prev => ({ ...prev, [newId]: "new" }));
  };

  const getDNAContext = useCallback(() => {
    const data = brandDataMap[activeBrandId];
    if (!data) return {};
    const fieldMap: Record<string, string> = {};
    for (const f of data.dnaFields) {
      const key = f.key.toLowerCase().replace(/\s+/g, "_");
      fieldMap[key] = f.value || "Not yet defined";
    }
    return fieldMap;
  }, [activeBrandId, brandDataMap]);

  const streamAIResponse = useCallback(async (brandId: string, allMessages: Message[]) => {
    setChatError(null);
    setTypingBrands(prev => new Set(prev).add(brandId));
    setSlowThinking(false);

    // Start slow-thinking timer
    slowTimerRef.current = setTimeout(() => setSlowThinking(true), 8000);

    const aiMsgId = `ai-${++msgCounter}`;

    try {
      const resp = await fetch(MENTOR_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          brandDNA: getDNAContext(),
        }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.text().catch(() => "");
        let errMsg = "Could not connect — try again";
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.error) errMsg = parsed.error;
        } catch {}
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";
      let streamDone = false;
      let addedMsg = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setBrandDataMap(prev => {
                const data = prev[brandId];
                if (!data) return prev;
                if (!addedMsg) {
                  addedMsg = true;
                  return {
                    ...prev,
                    [brandId]: {
                      ...data,
                      messages: [...data.messages, { id: aiMsgId, role: "ai" as const, content: assistantSoFar }],
                    },
                  };
                }
                return {
                  ...prev,
                  [brandId]: {
                    ...data,
                    messages: data.messages.map(m =>
                      m.id === aiMsgId ? { ...m, content: assistantSoFar } : m
                    ),
                  },
                };
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setBrandDataMap(prev => {
                const data = prev[brandId];
                if (!data) return prev;
                return {
                  ...prev,
                  [brandId]: {
                    ...data,
                    messages: data.messages.map(m =>
                      m.id === aiMsgId ? { ...m, content: assistantSoFar } : m
                    ),
                  },
                };
              });
            }
          } catch { /* ignore */ }
        }
      }

      // Detect save prompts from the completed response
      const savePrompt = detectSavePrompts(assistantSoFar, aiMsgId);
      if (savePrompt) {
        setBrandDataMap(prev => {
          const data = prev[brandId];
          if (!data) return prev;
          return {
            ...prev,
            [brandId]: {
              ...data,
              savePrompts: [...data.savePrompts, savePrompt],
            },
          };
        });
      }

    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not connect — try again");
    } finally {
      clearTimeout(slowTimerRef.current);
      setSlowThinking(false);
      setTypingBrands(prev => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
    }
  }, [getDNAContext]);

  const handleSendMessage = useCallback((text: string) => {
    const brandId = activeBrandId;
    setChatError(null);
    const founderMsg: Message = { id: `f-${++msgCounter}`, role: "founder", content: text };

    setBrandDataMap(prev => {
      const data = prev[brandId];
      if (!data) return prev;
      return {
        ...prev,
        [brandId]: { ...data, messages: [...data.messages, founderMsg] },
      };
    });

    lastMessageRef.current = text;

    // Get updated messages including the new one
    const allMessages = [...(brandDataMap[brandId]?.messages || []), founderMsg];
    streamAIResponse(brandId, allMessages);
  }, [activeBrandId, brandDataMap, streamAIResponse]);

  const handleRetry = useCallback(() => {
    const brandId = activeBrandId;
    const messages = brandDataMap[brandId]?.messages || [];
    if (messages.length > 0) {
      setChatError(null);
      streamAIResponse(brandId, messages);
    }
  }, [activeBrandId, brandDataMap, streamAIResponse]);

  const handleEmptySubmit = useCallback((text: string) => {
    const brandId = activeBrandId;
    const mode = emptyBrands[brandId] || "new";

    const founderMsg: Message = { id: `${brandId}-f1`, role: "founder", content: text };
    setBrandDataMap(prev => ({
      ...prev,
      [brandId]: { ...prev[brandId], messages: [founderMsg] },
    }));

    setEmptyBrands(prev => {
      const next = { ...prev };
      delete next[brandId];
      return next;
    });

    // Use real AI for the response
    streamAIResponse(brandId, [founderMsg]);
  }, [activeBrandId, emptyBrands, streamAIResponse]);

  const handleSelectMilestone = (milestoneId: string) => {
    setScrollToMilestoneId(milestoneId);
    if (isMobile) setLeftOpen(false);
  };

  const handleMilestoneScrolled = useCallback(() => {
    setScrollToMilestoneId(null);
  }, []);

  const handleSaveDNA = useCallback((field: string, value: string) => {
    setBrandDataMap(prev => {
      const data = prev[activeBrandId];
      if (!data) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...data,
          dnaFields: data.dnaFields.map(f =>
            f.key === field ? { ...f, value, savedFrom: "Brand Discovery", savedTimeAgo: "Just now" } : f
          ),
        },
      };
    });
    setHighlightDNAField(field);
    setTimeout(() => setHighlightDNAField(null), 1500);
  }, [activeBrandId]);

  const showLeftInline = !isMobile;
  const showRightInline = !isMobile && !isTablet;

  return (
    <div className="flex-1 min-h-0 flex flex-row overflow-hidden w-full max-w-full" style={{ minWidth: 0 }}>
      {showLeftInline ? (
        <aside className="w-60 flex-shrink-0 min-w-0 border-r border-border bg-card/50 overflow-hidden">
          <BrandMilestonePanel
            brands={brands}
            activeBrand={activeBrand}
            onSelectBrand={handleSelectBrand}
            onAddBrand={handleAddBrand}
            milestones={activeBrandData?.milestones || []}
            onSelectMilestone={handleSelectMilestone}
          />
        </aside>
      ) : (
        <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Brand & Milestones</SheetTitle>
            <BrandMilestonePanel
              brands={brands}
              activeBrand={activeBrand}
              onSelectBrand={(b) => { handleSelectBrand(b); setLeftOpen(false); }}
              onAddBrand={() => { handleAddBrand(); setLeftOpen(false); }}
              milestones={activeBrandData?.milestones || []}
              onSelectMilestone={handleSelectMilestone}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 min-w-0 max-w-full flex flex-col overflow-hidden relative" style={{ boxSizing: "border-box" }}>
        {isMobile && (
          <div className="h-10 flex items-center px-3 gap-2 border-b border-border flex-shrink-0">
            <button onClick={() => setLeftOpen(true)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Menu size={18} />
            </button>
            <span className="text-[13px] font-ui text-foreground flex-1">Mentor</span>
            <button onClick={() => setRightOpen(!rightOpen)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
          </div>
        )}

        {isTablet && !isMobile && (
          <button onClick={() => setRightOpen(!rightOpen)} className="absolute top-2 right-2 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        )}

        {activeEmptyMode ? (
          <MentorEmptyState mode={activeEmptyMode} onSubmit={handleEmptySubmit} />
        ) : activeBrandData ? (
          <ChatPanel
            brand={activeBrand}
            messages={activeBrandData.messages}
            milestones={activeBrandData.milestones}
            milestoneMarkers={activeBrandData.milestoneMarkers}
            savePrompts={activeBrandData.savePrompts}
            onSaveDNA={handleSaveDNA}
            scrollToMilestoneId={scrollToMilestoneId}
            onMilestoneScrolled={handleMilestoneScrolled}
            isMobile={isMobile}
            isTyping={isTyping}
            onSendMessage={handleSendMessage}
            error={chatError}
            onRetry={handleRetry}
            slowThinking={slowThinking}
          />
        ) : null}
      </div>

      {showRightInline ? (
        <aside className="w-[280px] flex-shrink-0 min-w-0 border-l border-border bg-card/50 overflow-hidden">
          <BrandDNAPanel
            fields={activeBrandData?.dnaFields || emptyDNAFields}
            highlightField={highlightDNAField}
          />
        </aside>
      ) : (
        <Sheet open={rightOpen} onOpenChange={setRightOpen}>
          <SheetContent side="right" className="w-80 p-0">
            <SheetTitle className="sr-only">Brand DNA</SheetTitle>
            <BrandDNAPanel
              fields={activeBrandData?.dnaFields || emptyDNAFields}
              highlightField={highlightDNAField}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default Mentor;
