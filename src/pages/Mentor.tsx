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
import { callAI } from "@/lib/ai";

const TABLET_MAX = 1024;

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

  const detectMilestone = useCallback(async (brandId: string, aiMsgId: string, allMessages: Message[], latestAiContent: string) => {
    try {
      const currentData = brandDataMap[brandId];
      const recentMessages = [...allMessages.slice(-6), { role: "ai" as const, content: latestAiContent }]
        .map(m => ({ role: m.role === "founder" ? "user" : "assistant", content: m.content }));

      const existingNames = (currentData?.milestones || []).map(m => m.name).join(", ");

      const result = await callAI([
        {
          role: "user",
          content: `You are a conversation analyst. Analyze this conversation and determine if the topic has shifted to a new area that deserves a milestone marker.

Existing milestones: ${existingNames || "None"}

Recent messages:
${recentMessages.map(m => `${m.role}: ${m.content}`).join("\n")}

If there is a meaningful new topic shift not already covered by existing milestones, respond with EXACTLY this format:
MILESTONE: [category] | [short name]

Categories: Brand Discovery, Campaign Strategy, Customer Insight, Product Positioning, Growth Strategy, Creative Direction

If no milestone is needed, respond with: NO_MILESTONE

Be selective — only mark significant shifts, not minor tangents.`
        }
      ], 200);

      if (!result || result.includes("NO_MILESTONE")) return;

      const match = result.match(/MILESTONE:\s*(.+?)\s*\|\s*(.+)/);
      if (!match) return;

      const newMilestoneId = `m-auto-${++milestoneCounter}`;
      const category = match[1].trim();
      const name = match[2].trim();

      const newMilestone = {
        id: newMilestoneId,
        category: category as import("@/components/mentor/types").MilestoneCategory,
        name,
        timeAgo: "Just now",
      };

      setBrandDataMap(prev => {
        const bd = prev[brandId];
        if (!bd) return prev;
        return {
          ...prev,
          [brandId]: {
            ...bd,
            milestones: [...bd.milestones, newMilestone],
            milestoneMarkers: [...bd.milestoneMarkers, { beforeMessageId: aiMsgId, milestoneId: newMilestoneId }],
          },
        };
      });
    } catch (e) {
      console.error("Milestone detection failed:", e);
    }
  }, [brandDataMap]);

  const handleAIResponse = useCallback(async (brandId: string, allMessages: Message[]) => {
    setChatError(null);
    setTypingBrands(prev => new Set(prev).add(brandId));
    setSlowThinking(false);

    slowTimerRef.current = setTimeout(() => setSlowThinking(true), 6000);

    const aiMsgId = `ai-${++msgCounter}`;

    try {
      const dnaContext = getDNAContext();
      const systemContext = `You are a sharp, experienced business mentor and brand strategist working with a founder on their brand. You are direct, honest, and occasionally challenging. You push back on bad ideas constructively. You sound like a trusted advisor — not an AI assistant.

Current brand context:
Brand: ${dnaContext.brand_name || "Unknown brand"}
Industry: ${dnaContext.industry || "Not yet defined"}
Voice: ${dnaContext.voice || "Not yet defined"}
Positioning: ${dnaContext.positioning || "Not yet defined"}
Target audience: ${dnaContext.target_audience || "Not yet defined"}
Core promise: ${dnaContext.core_promise || "Not yet defined"}

Rules:
- Maximum 3 sentences per response
- End most responses with one sharp follow-up question
- Never use bullet points
- Never say great question or similar
- Sound like a person not an AI`;

      const conversationMessages = allMessages.slice(-8).map(m => ({
        role: m.role === "founder" ? "user" : "assistant",
        content: m.content,
      }));

      const messages = [
        { role: "user", content: systemContext },
        { role: "assistant", content: "Understood. Ready." },
        ...conversationMessages,
      ];

      const response = await callAI(messages, 800);

      if (!response) {
        throw new Error("Could not connect — try again");
      }

      const aiMsg: Message = { id: aiMsgId, role: "ai", content: response };
      setBrandDataMap(prev => {
        const data = prev[brandId];
        if (!data) return prev;
        return {
          ...prev,
          [brandId]: { ...data, messages: [...data.messages, aiMsg] },
        };
      });

      // Detect save prompts
      const savePrompt = detectSavePrompts(response, aiMsgId);
      if (!savePrompt) {
        // Fallback keyword check
        const lower = response.toLowerCase();
        let fallbackPrompt: InlineSavePrompt | null = null;
        if (lower.includes("brand voice") || lower.includes("you sound like") || lower.includes("your voice")) {
          fallbackPrompt = { afterMessageId: aiMsgId, label: "Save brand voice insight", dnaField: "Voice", value: response.slice(0, 100) };
        } else if (lower.includes("position") || lower.includes("third space") || lower.includes("gap")) {
          fallbackPrompt = { afterMessageId: aiMsgId, label: "Save positioning insight", dnaField: "Positioning", value: response.slice(0, 100) };
        } else if (lower.includes("promise") || lower.includes("built for") || lower.includes("made for")) {
          fallbackPrompt = { afterMessageId: aiMsgId, label: "Save brand promise", dnaField: "Core promise", value: response.slice(0, 100) };
        }
        if (fallbackPrompt) {
          setBrandDataMap(prev => {
            const data = prev[brandId];
            if (!data) return prev;
            return { ...prev, [brandId]: { ...data, savePrompts: [...data.savePrompts, fallbackPrompt!] } };
          });
        }
      } else {
        setBrandDataMap(prev => {
          const data = prev[brandId];
          if (!data) return prev;
          return { ...prev, [brandId]: { ...data, savePrompts: [...data.savePrompts, savePrompt] } };
        });
      }

      // Detect milestone in background
      detectMilestone(brandId, aiMsgId, allMessages, response);

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
  }, [getDNAContext, detectMilestone]);

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
