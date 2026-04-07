import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, PanelRightOpen, PanelRightClose } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBrand } from "@/contexts/BrandContext";
import { getBrandDNA, updateBrandDNAField, BrandDNA } from "@/services/brandService";
import {
  getOrCreateConversation,
  getMessages,
  saveMessage,
  getMilestones,
  createMilestone,
  deleteMilestone,
  updateMilestoneName,
  updateMilestoneCategoryDB,
  MentorConversation,
} from "@/services/mentorService";
import { BrandMilestonePanel } from "@/components/mentor/BrandMilestonePanel";
import { ChatPanel } from "@/components/mentor/ChatPanel";
import { BrandDNAPanel } from "@/components/mentor/BrandDNAPanel";
import { MentorEmptyState, MentorMode } from "@/components/mentor/MentorEmptyState";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  MentorBrand,
  BrandData,
  BrandDNAField,
  Message,
  InlineSavePrompt,
  Milestone,
  MilestoneMarker,
  MilestoneCategory,
} from "@/components/mentor/types";
import { callAI } from "@/lib/ai";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TABLET_MAX = 1024;
let milestoneCounter = 100;
let msgCounter = 100;

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

// ─── DNA field key → DB column mapping ──────────────────────────────────────

const DNA_UI_TO_DB: Record<string, { table: "brands" | "brand_dna"; column: string }> = {
  "Brand name":          { table: "brands",    column: "name" },
  "Industry":            { table: "brands",    column: "industry" },
  "Voice":               { table: "brand_dna", column: "brand_voice" },
  "Target audience":     { table: "brand_dna", column: "target_audience" },
  "Positioning":         { table: "brand_dna", column: "positioning_statement" },
  "Brand references":    { table: "brand_dna", column: "brand_references" },
  "Core promise":        { table: "brand_dna", column: "core_promise" },
  "Campaign strategy":   { table: "brand_dna", column: "campaign_strategy" },
  "Customer insight":    { table: "brand_dna", column: "customer_insight" },
  "Product positioning": { table: "brand_dna", column: "product_positioning" },
};

// ─── Milestone category conversion ──────────────────────────────────────────

const UI_TO_DB_CATEGORY: Record<string, string> = {
  "Brand Discovery":    "brand_discovery",
  "Campaign Strategy":  "campaign_strategy",
  "Customer Insight":   "customer_insight",
  "Product Positioning":"product_positioning",
  "Growth Brainstorm":  "growth_brainstorm",
  "Pitch Preparation":  "pitch_preparation",
};

const DB_TO_UI_CATEGORY: Record<string, MilestoneCategory> = {
  brand_discovery:     "Brand Discovery",
  campaign_strategy:   "Campaign Strategy",
  customer_insight:    "Customer Insight",
  product_positioning: "Product Positioning",
  growth_brainstorm:   "Growth Brainstorm",
  pitch_preparation:   "Pitch Preparation",
  free_form:           "Brand Discovery",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildDNAFields(
  brand: { name: string; industry?: string },
  dna: BrandDNA | null
): BrandDNAField[] {
  return [
    { key: "Brand name",          label: "Brand name",          value: brand.name || null,                    savedFrom: brand.name ? "Brand Discovery" : undefined },
    { key: "Industry",            label: "Industry",            value: brand.industry || null,                savedFrom: brand.industry ? "Brand Discovery" : undefined },
    { key: "Voice",               label: "Voice",               value: dna?.brand_voice || null,              savedFrom: dna?.brand_voice ? "Brand Discovery" : undefined },
    { key: "Target audience",     label: "Target audience",     value: dna?.target_audience || null,          savedFrom: dna?.target_audience ? "Customer Insight" : undefined },
    { key: "Positioning",         label: "Positioning",         value: dna?.positioning_statement || null,    savedFrom: dna?.positioning_statement ? "Product Positioning" : undefined },
    { key: "Brand references",    label: "Brand references",    value: dna?.brand_references || null,         savedFrom: dna?.brand_references ? "Brand Discovery" : undefined },
    { key: "Core promise",        label: "Core promise",        value: dna?.core_promise || null,             savedFrom: dna?.core_promise ? "Brand Discovery" : undefined },
    { key: "Campaign strategy",   label: "Campaign strategy",   value: dna?.campaign_strategy || null,        savedFrom: dna?.campaign_strategy ? "Campaign Strategy" : undefined },
    { key: "Customer insight",    label: "Customer insight",    value: dna?.customer_insight || null,         savedFrom: dna?.customer_insight ? "Customer Insight" : undefined },
    { key: "Product positioning", label: "Product positioning", value: dna?.product_positioning || null,      savedFrom: dna?.product_positioning ? "Product Positioning" : undefined },
  ];
}

// ─── DNA save-prompt detection ───────────────────────────────────────────────

const DNA_PATTERNS: { field: string; patterns: RegExp[] }[] = [
  { field: "Voice",            patterns: [/brand voice.{0,10}(is|should be|:)\s*(.{10,80})/i, /voice.{0,10}(is|should be)\s*(.{10,80})/i] },
  { field: "Positioning",      patterns: [/positioning.{0,10}(is|should be|:)\s*(.{10,80})/i, /position.{0,10}(is|should be)\s*(.{10,80})/i] },
  { field: "Target audience",  patterns: [/target.{0,10}(audience|customer).{0,10}(is|are|:)\s*(.{10,80})/i] },
  { field: "Core promise",     patterns: [/promise.{0,10}(is|should be|:)\s*(.{10,80})/i, /core promise.{0,10}(is|:)\s*(.{10,80})/i] },
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

// ─── Component ───────────────────────────────────────────────────────────────

const Mentor = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const { brands: realBrands, activeBrand, switchBrand, createNewBrand, refreshBrands, isLoading } = useBrand();

  const brands: MentorBrand[] = realBrands.map(brand => ({
    id: brand.id,
    name: brand.name,
    colorClass: "",
    startedDate: new Date(brand.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const activeBrandId = activeBrand?.id || "";

  const currentActiveBrand: MentorBrand | null = activeBrand
    ? {
        id: activeBrand.id,
        name: activeBrand.name,
        colorClass: "",
        startedDate: new Date(activeBrand.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }
    : null;

  const [brandDataMap, setBrandDataMap] = useState<Record<string, BrandData>>({});
  const [conversationMap, setConversationMap] = useState<Record<string, MentorConversation>>({});
  const [loadedBrands, setLoadedBrands] = useState<Set<string>>(new Set());

  const [emptyBrands, setEmptyBrands] = useState<Record<string, MentorMode>>({});
  const [typingBrands, setTypingBrands] = useState<Set<string>>(new Set());
  const [chatError, setChatError] = useState<string | null>(null);
  const [slowThinking, setSlowThinking] = useState(false);
  const lastMessageRef = useRef<string>("");
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Ref so callbacks can always access the latest conversation map without stale closure
  const conversationMapRef = useRef(conversationMap);
  useEffect(() => { conversationMapRef.current = conversationMap; }, [conversationMap]);

  // ─── Load brand data when active brand changes ─────────────────────────────

  useEffect(() => {
    if (!activeBrandId || !activeBrand || loadedBrands.has(activeBrandId)) return;

    const loadBrandData = async () => {
      const conversation = await getOrCreateConversation(activeBrandId);
      if (!conversation) return;

      setConversationMap(prev => ({ ...prev, [activeBrandId]: conversation }));
      conversationMapRef.current = { ...conversationMapRef.current, [activeBrandId]: conversation };

      const [dbMessages, dbMilestones, dna] = await Promise.all([
        getMessages(conversation.id),
        getMilestones(activeBrandId),
        getBrandDNA(activeBrandId),
      ]);

      const uiMessages: Message[] = dbMessages.map(m => ({
        id: m.id,
        role: m.role === "user" ? "founder" : "ai",
        content: m.content,
      }));

      const uiMilestones: Milestone[] = dbMilestones.map(m => ({
        id: m.id,
        category: DB_TO_UI_CATEGORY[m.category] || "Brand Discovery",
        name: m.name,
        timeAgo: formatTimeAgo(m.created_at),
      }));

      const milestoneMarkers: MilestoneMarker[] = dbMilestones
        .filter(m => m.message_id)
        .map(m => ({ beforeMessageId: m.message_id!, milestoneId: m.id }));

      const dnaFields = buildDNAFields(activeBrand, dna);

      const mentorBrand: MentorBrand = {
        id: activeBrand.id,
        name: activeBrand.name,
        colorClass: "",
        startedDate: new Date(activeBrand.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };

      setBrandDataMap(prev => ({
        ...prev,
        [activeBrandId]: {
          brand: mentorBrand,
          messages: uiMessages,
          milestones: uiMilestones,
          milestoneMarkers,
          savePrompts: [],
          dnaFields,
        },
      }));

      // Set empty mode if no messages and no mode was explicitly assigned
      setEmptyBrands(prev => {
        if (uiMessages.length === 0 && !prev[activeBrandId]) {
          return { ...prev, [activeBrandId]: "new" };
        }
        return prev;
      });

      setLoadedBrands(prev => new Set(prev).add(activeBrandId));
    };

    loadBrandData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId]);

  // ─── Handle CTA query param (idea / brand mode) ───────────────────────────

  useEffect(() => {
    const mode = searchParams.get("mode") as MentorMode;
    if (mode === "idea" || mode === "brand") {
      const init = async () => {
        const newBrand = await createNewBrand("Untitled Brand");
        if (newBrand) {
          setEmptyBrands(prev => ({ ...prev, [newBrand.id]: mode }));
        }
        setSearchParams({}, { replace: true });
      };
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBrandData = brandDataMap[activeBrandId] || null;
  const activeEmptyMode = emptyBrands[activeBrandId] || null;
  const isTyping = typingBrands.has(activeBrandId);

  // Demo conversation for empty state preview (never shown as real messages)
  const demoMessages = [
    {
      id: "demo-1",
      role: "ai",
      content: "Welcome to Mentor. I’m your thinking partner for building a sharp, differentiated brand. Ask me anything about your brand, product, or audience."
    },
    {
      id: "demo-2",
      role: "founder",
      content: "How do I stand out in a crowded market?"
    },
    {
      id: "demo-3",
      role: "ai",
      content: "Let’s start with your positioning. What do you offer that nobody else does, and who is it for?"
    }
  ];

  const [scrollToMilestoneId, setScrollToMilestoneId] = useState<string | null>(null);
  const [highlightDNAField, setHighlightDNAField] = useState<string | null>(null);

  // ─── Brand handlers ───────────────────────────────────────────────────────

  const handleSelectBrand = async (brand: MentorBrand) => {
    await switchBrand(brand.id);
  };

  const handleAddBrand = async () => {
    const newBrand = await createNewBrand("Untitled Brand");
    if (newBrand) {
      // Let the activeBrandId useEffect load the data; just set the empty mode
      setEmptyBrands(prev => ({ ...prev, [newBrand.id]: "idea" }));
    }
  };

  // ─── DNA context for AI system prompt ────────────────────────────────────

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

  // ─── Persist a DNA field to Supabase ─────────────────────────────────────

  const persistDNAField = useCallback(async (
    brandId: string,
    fieldKey: string,
    value: string | null
  ) => {
    const mapping = DNA_UI_TO_DB[fieldKey];
    if (!mapping) return;

    if (mapping.table === "brands") {
      await (supabase as any)
        .from("brands")
        .update({ [mapping.column]: value })
        .eq("id", brandId);
      // Refresh brand list so the panel shows the updated name
      if (fieldKey === "Brand name") refreshBrands();
    } else {
      await updateBrandDNAField(brandId, mapping.column as keyof BrandDNA, value ?? "");
    }
  }, [refreshBrands]);

  // ─── Milestone auto-detection ─────────────────────────────────────────────

  const detectMilestone = useCallback(async (
    brandId: string,
    aiMsgId: string,
    allMessages: Message[],
    latestAiContent: string
  ) => {
    try {
      const currentData = brandDataMap[brandId];
      const recentMessages = [...allMessages.slice(-6), { role: "ai" as const, content: latestAiContent }]
        .map(m => ({ role: m.role === "founder" ? "user" : "assistant", content: m.content }));
      const existingNames = (currentData?.milestones || []).map(m => m.name).join(", ");

      const result = await callAI([{
        role: "user",
        content: `You are a conversation analyst. Analyze this conversation and determine if the topic has shifted to a new area that deserves a milestone marker.

Existing milestones: ${existingNames || "None"}

Recent messages:
${recentMessages.map(m => `${m.role}: ${m.content}`).join("\n")}

If there is a meaningful new topic shift not already covered by existing milestones, respond with EXACTLY this format:
MILESTONE: [category] | [short name]

Categories: Brand Discovery, Campaign Strategy, Customer Insight, Product Positioning, Growth Brainstorm, Pitch Preparation

If no milestone is needed, respond with: NO_MILESTONE

Be selective — only mark significant shifts, not minor tangents.`,
      }], 200);

      if (!result || result.includes("NO_MILESTONE")) return;

      const match = result.match(/MILESTONE:\s*(.+?)\s*\|\s*(.+)/);
      if (!match) return;

      const uiCategory = match[1].trim() as MilestoneCategory;
      const name = match[2].trim();
      const dbCategory = UI_TO_DB_CATEGORY[uiCategory] || "free_form";

      // Persist to DB and use the returned ID
      const conversation = conversationMapRef.current[brandId];
      let milestoneId = `m-auto-${++milestoneCounter}`;
      if (conversation) {
        const saved = await createMilestone(brandId, conversation.id, name, dbCategory, aiMsgId);
        if (saved) milestoneId = saved.id;
      }

      const newMilestone: Milestone = { id: milestoneId, category: uiCategory, name, timeAgo: "Just now" };

      setBrandDataMap(prev => {
        const bd = prev[brandId];
        if (!bd) return prev;
        return {
          ...prev,
          [brandId]: {
            ...bd,
            milestones: [...bd.milestones, newMilestone],
            milestoneMarkers: [...bd.milestoneMarkers, { beforeMessageId: aiMsgId, milestoneId }],
          },
        };
      });
    } catch (e) {
      console.error("Milestone detection failed:", e);
    }
  }, [brandDataMap]);

  // ─── AI response handler ──────────────────────────────────────────────────

  const handleAIResponse = useCallback(async (brandId: string, allMessages: Message[]) => {
    setChatError(null);
    setTypingBrands(prev => new Set(prev).add(brandId));
    setSlowThinking(false);
    slowTimerRef.current = setTimeout(() => setSlowThinking(true), 6000);

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

      const response = await callAI([
        { role: "user", content: systemContext },
        { role: "assistant", content: "Understood. Ready." },
        ...conversationMessages,
      ], 800);

      if (!response) throw new Error("Could not connect — try again");

      // Save AI message to DB and use the real UUID for milestone references
      const conversation = conversationMapRef.current[brandId];
      let aiMsgId: string;
      if (conversation) {
        const saved = await saveMessage(conversation.id, "assistant", response);
        aiMsgId = saved?.id ?? `ai-${++msgCounter}`;
      } else {
        aiMsgId = `ai-${++msgCounter}`;
      }

      const aiMsg: Message = { id: aiMsgId, role: "ai", content: response };
      setBrandDataMap(prev => {
        const data = prev[brandId];
        if (!data) return prev;
        return { ...prev, [brandId]: { ...data, messages: [...data.messages, aiMsg] } };
      });

      // Detect and attach inline save prompts
      const savePrompt = detectSavePrompts(response, aiMsgId);
      if (!savePrompt) {
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

      // Detect milestone in background (fire and forget)
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

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSendMessage = useCallback((text: string) => {
    const brandId = activeBrandId;
    setChatError(null);
    lastMessageRef.current = text;

    // Fire-and-forget DB save for founder message (temp ID is fine; only AI message IDs
    // are referenced by milestones and save prompts)
    const conversation = conversationMapRef.current[brandId];
    if (conversation) saveMessage(conversation.id, "user", text);

    const founderMsg: Message = { id: `f-${++msgCounter}`, role: "founder", content: text };
    setBrandDataMap(prev => {
      const data = prev[brandId];
      if (!data) return prev;
      return { ...prev, [brandId]: { ...data, messages: [...data.messages, founderMsg] } };
    });

    const allMessages = [...(brandDataMap[brandId]?.messages || []), founderMsg];
    handleAIResponse(brandId, allMessages);
  }, [activeBrandId, brandDataMap, handleAIResponse]);

  const handleRetry = useCallback(() => {
    const brandId = activeBrandId;
    const messages = brandDataMap[brandId]?.messages || [];
    if (messages.length > 0) {
      setChatError(null);
      handleAIResponse(brandId, messages);
    }
  }, [activeBrandId, brandDataMap, handleAIResponse]);

  // ─── Empty state submit (first message) ──────────────────────────────────

  const handleEmptySubmit = useCallback((text: string) => {
    const brandId = activeBrandId;

    const conversation = conversationMapRef.current[brandId];
    if (conversation) saveMessage(conversation.id, "user", text);

    const founderMsg: Message = { id: `${brandId}-f1`, role: "founder", content: text };

    setBrandDataMap(prev => {
      const existing = prev[brandId];
      return {
        ...prev,
        [brandId]: {
          brand: existing?.brand || currentActiveBrand || { id: brandId, name: "Brand", colorClass: "", startedDate: "" },
          milestones: existing?.milestones || [],
          milestoneMarkers: existing?.milestoneMarkers || [],
          savePrompts: existing?.savePrompts || [],
          dnaFields: existing?.dnaFields || emptyDNAFields.map(f => ({ ...f })),
          messages: [founderMsg],
        },
      };
    });

    setEmptyBrands(prev => {
      const next = { ...prev };
      delete next[brandId];
      return next;
    });

    handleAIResponse(brandId, [founderMsg]);
  }, [activeBrandId, currentActiveBrand, handleAIResponse]);

  // ─── Milestone handlers ───────────────────────────────────────────────────

  const handleSelectMilestone = (milestoneId: string) => {
    setScrollToMilestoneId(milestoneId);
    if (isMobile) setLeftOpen(false);
  };

  const handleMilestoneScrolled = useCallback(() => {
    setScrollToMilestoneId(null);
  }, []);

  const handleRenameMilestone = useCallback(async (id: string, newName: string) => {
    setBrandDataMap(prev => {
      const data = prev[activeBrandId];
      if (!data) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...data,
          milestones: data.milestones.map(m => m.id === id ? { ...m, name: newName } : m),
        },
      };
    });
    await updateMilestoneName(id, newName);
  }, [activeBrandId]);

  const handleDeleteMilestone = useCallback(async (id: string) => {
    const data = brandDataMap[activeBrandId];
    if (!data) return;
    const deleted = data.milestones.find(m => m.id === id);
    const deletedMarkers = data.milestoneMarkers.filter(mm => mm.milestoneId === id);

    setBrandDataMap(prev => {
      const bd = prev[activeBrandId];
      if (!bd) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...bd,
          milestones: bd.milestones.filter(m => m.id !== id),
          milestoneMarkers: bd.milestoneMarkers.filter(mm => mm.milestoneId !== id),
        },
      };
    });

    await deleteMilestone(id);

    if (deleted) {
      toast(`Deleted "${deleted.name}"`, {
        action: {
          label: "Undo",
          onClick: () => {
            // Restore locally (DB re-insert would assign a new ID)
            setBrandDataMap(prev => {
              const bd = prev[activeBrandId];
              if (!bd) return prev;
              return {
                ...prev,
                [activeBrandId]: {
                  ...bd,
                  milestones: [...bd.milestones, deleted],
                  milestoneMarkers: [...bd.milestoneMarkers, ...deletedMarkers],
                },
              };
            });
          },
        },
        duration: 5000,
      });
    }
  }, [activeBrandId, brandDataMap]);

  const handleEditMilestoneCategory = useCallback(async (id: string, newCategory: MilestoneCategory) => {
    setBrandDataMap(prev => {
      const data = prev[activeBrandId];
      if (!data) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...data,
          milestones: data.milestones.map(m => m.id === id ? { ...m, category: newCategory } : m),
        },
      };
    });
    await updateMilestoneCategoryDB(id, UI_TO_DB_CATEGORY[newCategory] || "free_form");
  }, [activeBrandId]);

  // ─── DNA handlers ─────────────────────────────────────────────────────────

  const handleSaveDNA = useCallback(async (field: string, value: string) => {
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
    await persistDNAField(activeBrandId, field, value);
  }, [activeBrandId, persistDNAField]);

  const handleEditDNAField = useCallback(async (fieldKey: string, newValue: string) => {
    setBrandDataMap(prev => {
      const data = prev[activeBrandId];
      if (!data) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...data,
          dnaFields: data.dnaFields.map(f =>
            f.key === fieldKey ? { ...f, value: newValue, savedFrom: f.savedFrom || "Manual edit", savedTimeAgo: "Just now" } : f
          ),
        },
      };
    });
    setHighlightDNAField(fieldKey);
    setTimeout(() => setHighlightDNAField(null), 1500);
    await persistDNAField(activeBrandId, fieldKey, newValue);
  }, [activeBrandId, persistDNAField]);

  const handleClearDNAField = useCallback(async (fieldKey: string) => {
    const data = brandDataMap[activeBrandId];
    if (!data) return;
    const clearedField = data.dnaFields.find(f => f.key === fieldKey);
    const oldValue = clearedField?.value;
    const oldSavedFrom = clearedField?.savedFrom;
    const oldSavedTimeAgo = clearedField?.savedTimeAgo;

    setBrandDataMap(prev => {
      const bd = prev[activeBrandId];
      if (!bd) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...bd,
          dnaFields: bd.dnaFields.map(f =>
            f.key === fieldKey ? { ...f, value: null, savedFrom: undefined, savedTimeAgo: undefined } : f
          ),
        },
      };
    });

    await persistDNAField(activeBrandId, fieldKey, null);

    toast(`Cleared "${clearedField?.label}"`, {
      action: {
        label: "Undo",
        onClick: async () => {
          setBrandDataMap(prev => {
            const bd = prev[activeBrandId];
            if (!bd) return prev;
            return {
              ...prev,
              [activeBrandId]: {
                ...bd,
                dnaFields: bd.dnaFields.map(f =>
                  f.key === fieldKey ? { ...f, value: oldValue || null, savedFrom: oldSavedFrom, savedTimeAgo: oldSavedTimeAgo } : f
                ),
              },
            };
          });
          if (oldValue) await persistDNAField(activeBrandId, fieldKey, oldValue);
        },
      },
      duration: 5000,
    });
  }, [activeBrandId, brandDataMap, persistDNAField]);

  // ─── Layout ───────────────────────────────────────────────────────────────

  const showLeftInline = !isMobile;
  const showRightInline = !isMobile && !isTablet;


  // If no brand is selected, show empty state with CTA
  if (!currentActiveBrand && !isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center px-4">
        <div className="w-[90%] max-w-[560px] rounded-2xl p-8 bg-card dark:bg-[#1A2A3A] border-[0.5px] border-[#E8E2D9] dark:border-[#2A3A4A]">
          <div className="w-2 h-2 rounded-full bg-primary animate-amber-pulse mb-4" />
          <p className="font-display text-[18px] leading-[1.7] text-foreground mb-2">No brand selected — start by creating your first brand</p>
          <div className="my-6 h-px bg-border dark:border-[#2A3A4A] w-full" style={{ height: "0.5px" }} />
          <div className="flex gap-3">
            <button
              className="flex-1 h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] hover:bg-primary/90 transition-colors"
              onClick={handleAddBrand}
            >
              + New Brand
            </button>
            <button
              className="flex-1 h-12 rounded-lg border border-primary text-primary font-semibold text-[15px] hover:bg-primary/10 transition-colors"
              onClick={handleAddBrand}
            >
              Try Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-row overflow-hidden w-full max-w-full" style={{ minWidth: 0 }}>
      {showLeftInline ? (
        <aside className="w-60 flex-shrink-0 min-w-0 border-r border-border bg-card/50 overflow-hidden">
          <BrandMilestonePanel
            brands={brands}
            activeBrand={currentActiveBrand}
            onSelectBrand={handleSelectBrand}
            onAddBrand={handleAddBrand}
            milestones={activeBrandData?.milestones || []}
            onSelectMilestone={handleSelectMilestone}
            onRenameMilestone={handleRenameMilestone}
            onDeleteMilestone={handleDeleteMilestone}
            onEditMilestoneCategory={handleEditMilestoneCategory}
          />
        </aside>
      ) : (
        <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Brand & Milestones</SheetTitle>
            <BrandMilestonePanel
              brands={brands}
              activeBrand={currentActiveBrand}
              onSelectBrand={(b) => { handleSelectBrand(b); setLeftOpen(false); }}
              onAddBrand={() => { handleAddBrand(); setLeftOpen(false); }}
              milestones={activeBrandData?.milestones || []}
              onSelectMilestone={handleSelectMilestone}
              onRenameMilestone={handleRenameMilestone}
              onDeleteMilestone={handleDeleteMilestone}
              onEditMilestoneCategory={handleEditMilestoneCategory}
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
          // Show empty state greeting
          <MentorEmptyState mode={activeEmptyMode} onSubmit={handleEmptySubmit} />
        ) : activeBrandData && activeBrandData.messages.length > 0 ? (
          // Show real messages from DB
          <ChatPanel
            brand={currentActiveBrand}
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
        ) : (
          // Show empty state greeting and demo conversation as preview only
          <div className="flex flex-col h-full w-full items-center justify-center">
            <MentorEmptyState mode={activeEmptyMode || "new"} onSubmit={handleEmptySubmit} />
            <div className="w-full max-w-[560px] mt-8">
              <div className="rounded-xl bg-card border border-border p-6">
                <div className="font-semibold text-[15px] mb-3 text-muted-foreground">Demo conversation preview</div>
                {demoMessages.map((msg) => (
                  <div key={msg.id} className="mb-3">
                    <div className={`rounded-xl px-4 py-3 max-w-[75%] min-w-0 break-words ${msg.role === "founder" ? "bg-primary/10 ml-auto" : "bg-card border border-border"}`}>
                      <span className="text-[13.5px] font-ui text-foreground whitespace-pre-line break-words">{msg.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showRightInline ? (
        <aside className="w-[280px] flex-shrink-0 min-w-0 border-l border-border bg-card/50 overflow-hidden">
          <BrandDNAPanel
            fields={activeBrandData?.dnaFields || emptyDNAFields}
            highlightField={highlightDNAField}
            onEditField={handleEditDNAField}
            onClearField={handleClearDNAField}
          />
        </aside>
      ) : (
        <Sheet open={rightOpen} onOpenChange={setRightOpen}>
          <SheetContent side="right" className="w-80 p-0">
            <SheetTitle className="sr-only">Brand DNA</SheetTitle>
            <BrandDNAPanel
              fields={activeBrandData?.dnaFields || emptyDNAFields}
              highlightField={highlightDNAField}
              onEditField={handleEditDNAField}
              onClearField={handleClearDNAField}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default Mentor;
