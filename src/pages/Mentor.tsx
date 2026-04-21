import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, PanelRightOpen, PanelRightClose } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/contexts/AuthContext";
import { addBreadcrumb } from "@/services/errorService";
import { getBrandDNA, updateBrandDNAField, updateBrandName, BrandDNA, type JourneyStage } from "@/services/brandService";
import {
  getOrCreateConversation,
  getMessages,
  saveMessage,
  deleteMessage,
  getMilestones,
  createMilestone,
  deleteMilestone,
  updateMilestoneName,
  updateMilestoneCategoryDB,
  getUnansweredMessage,
  markMessageAsFailed,
  clearMessageFailedFlag,
  getMentorAIResponse,
  getMessagesForAIContext,
  MentorConversation,
  ChoicePrompt,
  saveChoicePrompt,
  answerChoicePrompt,
  getChoicePromptsForConversation,
  saveCustomDNAField,
  getCustomDNAFields,
  generateLovablePrompt,
} from "@/services/mentorService";
import { saveStageField } from "@/services/journeyDataService";
import { logError } from "@/services/errorService";
import type { ParsedSavePrompt } from "@/lib/savePromptParser";
import { createThinkingSequence, ThinkingState } from '@/services/streamingService';
import { callAI } from "@/services/aiService";
import { BrandMilestonePanel } from "@/components/mentor/BrandMilestonePanel";
import { ChatPanel } from "@/components/mentor/ChatPanel";
import { BrandDNAPanel } from "@/components/mentor/BrandDNAPanel";
import { MentorEmptyState, MentorMode } from "@/components/mentor/MentorEmptyState";
import { ProjectOnboarding } from "@/components/mentor/ProjectOnboarding";
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
  { field: "Brand voice",      patterns: [/voice.{0,10}(is|should be|:)\s*(.{10,80})/i] },
  { field: "Positioning",     patterns: [/position yourself as\s*(.{10,80})/i, /your positioning is\s*(.{10,80})/i, /positioning statement.{0,10}(is|:)\s*(.{10,80})/i] },
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingCheckedFor, setOnboardingCheckedFor] = useState<Set<string>>(new Set());

  const { brands: realBrands, activeBrand, activeBrandDNA, switchBrand, createNewBrand, refreshBrands, refreshBrandDNA, isLoading, currentStageData } = useBrand();
  const { user } = useAuth();

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

  // Track previous brand for breadcrumb
  const previousBrandRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeBrandId && previousBrandRef.current && previousBrandRef.current !== activeBrandId) {
      addBreadcrumb('switched_brand', 'mentor', { 
        fromBrandId: previousBrandRef.current,
        toBrandId: activeBrandId 
      });
    }
    if (activeBrandId) {
      previousBrandRef.current = activeBrandId;
    }
  }, [activeBrandId]);

  const [brandDataMap, setBrandDataMap] = useState<Record<string, BrandData>>({});
  const [conversationMap, setConversationMap] = useState<Record<string, MentorConversation>>({});
  const [loadedBrands, setLoadedBrands] = useState<Set<string>>(new Set());

  const [emptyBrands, setEmptyBrands] = useState<Record<string, MentorMode>>({});
  const [typingBrands, setTypingBrands] = useState<Set<string>>(new Set());
  const [chatError, setChatError] = useState<string | null>(null);
  const [slowThinking, setSlowThinking] = useState(false);
  const [activeChoicePrompts, setActiveChoicePrompts] = useState<ChoicePrompt[]>([]);
  const [customDNAFields, setCustomDNAFields] = useState<any[]>([]);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [allStageFields, setAllStageFields] = useState<Record<string, any[]>>({});
  const [capturedData, setCapturedData] = useState<Record<string, Record<string, string>>>({});
  // Keys of save prompts already accepted, formatted as `${messageId}::${fieldKey}`.
  // Sourced from brand_stage_data.captured_from_message_id so the "Saved" pill
  // persists across reloads.
  const [savedStagePromptKeys, setSavedStagePromptKeys] = useState<Set<string>>(new Set());
  const [thinkingState, setThinkingState] = useState<ThinkingState>({
    isThinking: false,
    currentMessage: '',
    progress: 0
  });
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  // Brands currently generating their very first AI message after onboarding —
  // used to suppress the empty-state greeting and show the streaming/thinking UI instead.
  const [firstMessageBrands, setFirstMessageBrands] = useState<Set<string>>(new Set());
  const firstMessageBrandsRef = useRef(firstMessageBrands);
  useEffect(() => { firstMessageBrandsRef.current = firstMessageBrands; }, [firstMessageBrands]);
  const lastMessageRef = useRef<string>("");
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Unanswered message tracking
  const [unansweredMessageId, setUnansweredMessageId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const messageRefsMap = useRef<Record<string, HTMLDivElement | null>>({});

  // Ref so callbacks can always access the latest conversation map without stale closure
  const conversationMapRef = useRef(conversationMap);
  useEffect(() => { conversationMapRef.current = conversationMap; }, [conversationMap]);

  // ─── Load brand data when active brand changes ─────────────────────────────

  useEffect(() => {
    if (!activeBrandId || !activeBrand || loadedBrands.has(activeBrandId)) return;

    const loadBrandData = async () => {
      addBreadcrumb('opened_mentor', 'mentor', { brandId: activeBrandId });
      
      const conversation = await getOrCreateConversation(activeBrandId);
      if (!conversation) return;

      setConversationMap(prev => ({ ...prev, [activeBrandId]: conversation }));
      conversationMapRef.current = { ...conversationMapRef.current, [activeBrandId]: conversation };

      const [dbMessages, dbMilestones, dna] = await Promise.all([
        getMessages(conversation.id),
        getMilestones(activeBrandId),
        getBrandDNA(activeBrandId),
      ]);

      const [choicePrompts, customFields] = await Promise.all([
        getChoicePromptsForConversation(conversation.id),
        getCustomDNAFields(activeBrandId),
      ]);

      // Load stage fields directly from Supabase
      const { data: stageFieldsData } = await (supabase as any)
        .from('journey_stage_fields')
        .select('*')
        .order('sort_order');
      const groupedStageFields: Record<string, any[]> = {};
      (stageFieldsData ?? []).forEach((field: any) => {
        if (!groupedStageFields[field.stage_key]) groupedStageFields[field.stage_key] = [];
        groupedStageFields[field.stage_key].push(field);
      });

      // Pre-populate which save prompts have already been accepted, so the
      // "Saved" pill is restored under the right message after a reload.
      const { data: savedRows } = await (supabase as any)
        .from('brand_stage_data')
        .select('field_key, captured_from_message_id')
        .eq('brand_id', activeBrandId)
        .not('captured_from_message_id', 'is', null);
      const savedKeys = new Set<string>(
        (savedRows ?? [])
          .filter((r: any) => r.captured_from_message_id && r.field_key)
          .map((r: any) => `${r.captured_from_message_id}::${r.field_key}`)
      );

      setActiveChoicePrompts(choicePrompts);
      setCustomDNAFields(customFields);
      setAllStageFields(groupedStageFields);
      setSavedStagePromptKeys(prev => {
        const next = new Set(prev);
        savedKeys.forEach(k => next.add(k));
        return next;
      });

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
        stage_key: m.stage_key ?? null,
        is_substage_milestone: m.is_substage_milestone ?? false,
        created_at: m.created_at,
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

      // Set empty mode if no messages and no mode was explicitly assigned —
      // but skip when we are about to inject the first AI message after onboarding.
      setEmptyBrands(prev => {
        if (
          uiMessages.length === 0 &&
          !prev[activeBrandId] &&
          !firstMessageBrandsRef.current.has(activeBrandId)
        ) {
          return { ...prev, [activeBrandId]: "new" };
        }
        return prev;
      });

      // Check for unanswered messages
      const unanswered = await getUnansweredMessage(conversation.id);
      if (unanswered) {
        // Pre-fill the input with the unanswered message
        setInputValue(unanswered.content);
        // Mark it visually as unanswered
        setUnansweredMessageId(unanswered.id);
        
        // Scroll to unanswered message after a short delay
        setTimeout(() => {
          const el = messageRefsMap.current[unanswered.id];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }

      setLoadedBrands(prev => new Set(prev).add(activeBrandId));
    };

    loadBrandData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId]);

  // ─── Onboarding check ──────────────────────────────────────────────────────
  // When a brand is active and has not completed onboarding, show the overlay
  useEffect(() => {
    if (!activeBrandId || !activeBrand) return;
    if (onboardingCheckedFor.has(activeBrandId)) return;

    const checkOnboarding = async () => {
      const { data } = await (supabase as any)
        .from('brands')
        .select('onboarding_completed')
        .eq('id', activeBrandId)
        .single();

      setOnboardingCheckedFor(prev => new Set(prev).add(activeBrandId));
      if (data && data.onboarding_completed === false) {
        setShowOnboarding(true);
      }
    };

    checkOnboarding();
  }, [activeBrandId, activeBrand, onboardingCheckedFor]);

  // Ref so we can call triggerFirstAIMessage (defined later) from
  // handleOnboardingComplete without dealing with hoisting / dependency ordering.
  const triggerFirstAIMessageRef = useRef<((brandId: string) => Promise<void>) | null>(null);

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    // Refresh brands so any extracted name / stage updates flow through
    await refreshBrands();
    await refreshBrandDNA();
    // Force re-load of brand data and right-panel substages
    setLoadedBrands(prev => {
      const next = new Set(prev);
      next.delete(activeBrandId);
      return next;
    });
    setForceRefresh(prev => prev + 1);

    // Clear the empty-state greeting for this brand — we are about to populate
    // the conversation with the first AI message instead.
    setEmptyBrands(prev => {
      const next = { ...prev };
      delete next[activeBrandId];
      return next;
    });

    // Mark this brand as generating its first message so the UI shows the
    // streaming/thinking ChatPanel instead of the empty state.
    setFirstMessageBrands(prev => new Set(prev).add(activeBrandId));

    // Wait for brand data + conversation to reload, then trigger the hidden
    // CONTEXT_LOADED message to start the conversation.
    setTimeout(() => {
      triggerFirstAIMessageRef.current?.(activeBrandId);
    }, 300);
  }, [activeBrandId, refreshBrands, refreshBrandDNA]);

  // ─── Handle CTA query param (idea / brand mode) ───────────────────────────

  useEffect(() => {
    const mode = searchParams.get("mode") as MentorMode;
    if (mode === "idea" || mode === "brand") {
      const init = async () => {
        const newBrand = await createNewBrand("Untitled Project");
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

  const [scrollToMilestoneId, setScrollToMilestoneId] = useState<string | null>(null);
  const [highlightDNAField, setHighlightDNAField] = useState<string | null>(null);

  // ─── Brand handlers ───────────────────────────────────────────────────────

  const handleSelectBrand = async (brand: MentorBrand) => {
    await switchBrand(brand.id);
  };

  const handleAddBrand = async () => {
    const newBrand = await createNewBrand("Untitled Project");
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

  const handleSaveToBrandDNA = async (
    field: string,
    value: string,
    promptId: string
  ) => {
    if (!activeBrand) return;

    const cleanValue = stripMarkdown(value);

    // Find which stage this field belongs to
    let stageKey = activeBrand.journey_stage ?? 'brand';
    let fieldKey = field;

    // Check all stage fields for a match
    for (const [sk, fields] of Object.entries(allStageFields)) {
      const match = fields.find(
        f => f.field_key === field || f.maps_to_dna_field === field
      );
      if (match) {
        stageKey = sk;
        fieldKey = match.field_key;
        break;
      }
    }

    // Save to stage data directly via Supabase
    await (supabase as any)
      .from('brand_stage_data')
      .upsert({
        brand_id: activeBrand.id,
        stage_key: stageKey,
        field_key: fieldKey,
        value: cleanValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'brand_id,stage_key,field_key' });

    // Also save to brand_dna for backward compatibility
    await persistDNAField(activeBrand.id, field, cleanValue);

    // Update local state
    setCapturedData(prev => ({
      ...prev,
      [stageKey]: { ...prev[stageKey], [fieldKey]: cleanValue }
    }));

    // Note: We're not managing savePrompts state in this version
    await refreshBrandDNA();
    // Tell the right-panel substage view to re-fetch from brand_stage_data
    setForceRefresh(prev => prev + 1);
  };

  // ─── SAVE_PROMPT handler — writes parsed AI save pill to brand_stage_data ──
  // Also mirrors to brand_dna when a mapping exists, so the right-panel DNA
  // view and the Brand DNA page stay in sync. Persists captured_from_message_id
  // so the "Saved" pill can be restored across reloads.
  const handleSaveStagePrompt = useCallback(async (prompt: ParsedSavePrompt, messageId?: string) => {
    if (!activeBrand) return;

    // Resolve stage_key: prefer the one provided by the AI, else find by
    // matching field_key in our cached stage field definitions, else fall
    // back to the active journey stage.
    let stageKey = prompt.stageKey;
    if (!stageKey) {
      for (const [sk, fields] of Object.entries(allStageFields)) {
        if ((fields as any[]).some(f => f.field_key === prompt.fieldKey)) {
          stageKey = sk;
          break;
        }
      }
    }
    if (!stageKey) stageKey = activeBrand.journey_stage ?? 'spark';

    const cleanValue = stripMarkdown(prompt.value);

    const conversation = conversationMapRef.current[activeBrand.id];

    try {
      // 1. Save to brand_stage_data (drives Journey Record completion %)
      const { success, error } = await saveStageField(
        activeBrand.id,
        stageKey,
        prompt.fieldKey,
        cleanValue,
        messageId,
        conversation?.id,
        prompt.label,
        'brand_discovery'
      );
      if (!success) throw new Error(error || 'Save failed');

      // 2. Mirror to brand_dna when a mapping exists. Match by field_key,
      //    label, or maps_to_dna_field on the cached stage field def.
      const stageFieldDefs = (allStageFields[stageKey] ?? []) as any[];
      const fieldDef = stageFieldDefs.find(f => f.field_key === prompt.fieldKey);
      const dnaCandidates = [
        prompt.label,
        fieldDef?.maps_to_dna_field,
        fieldDef?.field_label,
      ].filter(Boolean) as string[];
      for (const candidate of dnaCandidates) {
        if (DNA_UI_TO_DB[candidate]) {
          await persistDNAField(activeBrand.id, candidate, cleanValue);
          break;
        }
      }

      // 3. Update local state and refresh both panels
      setCapturedData(prev => ({
        ...prev,
        [stageKey!]: { ...(prev[stageKey!] ?? {}), [prompt.fieldKey]: cleanValue },
      }));
      if (messageId) {
        setSavedStagePromptKeys(prev => {
          const next = new Set(prev);
          next.add(`${messageId}::${prompt.fieldKey}`);
          return next;
        });
      }
      await refreshBrandDNA();
      setForceRefresh(prev => prev + 1);

      toast(`Saved "${prompt.label}"`, { duration: 2000 });
    } catch (e) {
      await logError({
        userId: user?.id,
        errorType: 'database',
        module: 'mentor',
        errorMessage: e instanceof Error ? e.message : 'Failed to save stage prompt',
        context: { fieldKey: prompt.fieldKey, stageKey },
      });
      toast.error('Could not save — try again');
      throw e;
    }
  }, [activeBrand, allStageFields, user, persistDNAField, refreshBrandDNA]);


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

      const result = await callAI({
        taskType: 'mentor_chat',
        userId: user?.id,
        systemPrompt: 'You are a conversation analyst.',
        messages: [{
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
        }],
        maxTokens: 200
      });

      if (!result.success || !result.text || result.text.includes("NO_MILESTONE")) return;

      const match = result.text.match(/MILESTONE:\s*(.+?)\s*\|\s*(.+)/);
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

      const newMilestone: Milestone = { id: milestoneId, category: uiCategory, name, timeAgo: "Just now", stage_key: null, is_substage_milestone: false, created_at: new Date().toISOString() };

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
  }, [brandDataMap, user]);

  // Helper to determine if response is strategically significant
  const isStrategicallySignificant = (text: string): boolean => {
    const keywords = [
      'positioning', 'brand voice', 'core promise',
      'target audience', 'strategy', 'insight',
      'this is your', 'write that down', 'that is your'
    ];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  };

  // ─── AI response handler ──────────────────────────────────────────────────

  const handleAIResponse = useCallback(async (brandId: string, allMessages: Message[]) => {
    setChatError(null);
    setTypingBrands(prev => new Set(prev).add(brandId));
    setSlowThinking(false);
    slowTimerRef.current = setTimeout(() => setSlowThinking(true), 6000);

    addBreadcrumb('ai_responding', 'mentor', { 
      taskType: 'mentor_chat',
      historyLength: allMessages.length,
      brandId 
    });

    try {
      const dnaContext = getDNAContext();
      const conversationHistory = allMessages.slice(-8).map(m => ({
        role: m.role === "founder" ? "user" : "assistant",
        content: m.content,
      }));

      const lastUserMessage = conversationHistory
        .filter(m => m.role === "user")
        .pop()?.content || "";

      const response = await getMentorAIResponse(
        user?.id || "",
        activeBrand,
        dnaContext,
        conversationHistory,
        lastUserMessage
      );

      if (!response) throw new Error("Could not connect — try again");

      // Save AI message to DB and use the real UUID for milestone references
      const conversation = conversationMapRef.current[brandId];
      let aiMsgId: string;
      if (conversation) {
        const saved = await saveMessage(conversation.id, "assistant", response.text);
        aiMsgId = saved?.id ?? `ai-${++msgCounter}`;
      } else {
        aiMsgId = `ai-${++msgCounter}`;
      }

      const aiMsg: Message = { id: aiMsgId, role: "ai", content: response.text };
      setBrandDataMap(prev => {
        const data = prev[brandId];
        if (!data) return prev;
        return { ...prev, [brandId]: { ...data, messages: [...data.messages, aiMsg] } };
      });

      // Clear unanswered state — message is now answered
      setUnansweredMessageId(null);
      setInputValue("");

      // Handle choice prompt if present
      if (response.choicePrompt && conversation) {
        const saved = await saveChoicePrompt(
          conversation.id,
          aiMsgId,
          response.choicePrompt.type,
          response.choicePrompt.question,
          response.choicePrompt.options,
          response.choicePrompt.dnaField ?? undefined
        );
        if (saved) {
          setActiveChoicePrompts(prev => [...prev, saved]);
        }
      }

      // Detect and attach inline save prompts
      const savePrompt = detectSavePrompts(response.text, aiMsgId);
      if (!savePrompt) {
        const lower = response.text.toLowerCase();
        let fallbackPrompt: InlineSavePrompt | null = null;
        if (lower.includes("brand voice") || lower.includes("you sound like") || lower.includes("your voice")) {
          fallbackPrompt = { afterMessageId: aiMsgId, label: "Save brand voice insight", dnaField: "Voice", value: response.text.slice(0, 100) };
        } else if (lower.includes("position") || lower.includes("third space") || lower.includes("gap")) {
          fallbackPrompt = { afterMessageId: aiMsgId, label: "Save positioning insight", dnaField: "Positioning", value: response.text.slice(0, 100) };
        } else if (lower.includes("promise") || lower.includes("built for") || lower.includes("made for")) {
          fallbackPrompt = { afterMessageId: aiMsgId, label: "Save brand promise", dnaField: "Core promise", value: response.text.slice(0, 100) };
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
      detectMilestone(brandId, aiMsgId, allMessages, response.text);

    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Could not connect — try again");
      
      // Mark the last user message as failed
      const lastUserMsg = allMessages.filter(m => m.role === "founder").pop();
      if (lastUserMsg) {
        await markMessageAsFailed(lastUserMsg.id);
        setUnansweredMessageId(lastUserMsg.id);
      }
    } finally {
      clearTimeout(slowTimerRef.current);
      setSlowThinking(false);
      setTypingBrands(prev => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
    }
  }, [getDNAContext, detectMilestone, user, activeBrand]);

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !activeBrand || !user) return;
    setInputValue('');

    const brandId = activeBrandId;
    const conversation = conversationMapRef.current[brandId];
    if (!conversation) return;

    // Save user message
    const userMsg = await saveMessage(conversation.id, 'user', content);
    if (!userMsg) return;

    // Add user message to state
    const founderMsg: Message = { id: userMsg.id, role: "founder", content };
    setBrandDataMap(prev => {
      const data = prev[brandId];
      if (!data) return prev;
      return { ...prev, [brandId]: { ...data, messages: [...data.messages, founderMsg] } };
    });

    // Get current messages for context
    const currentMessages = brandDataMap[brandId]?.messages || [];
    const dnaContext = getDNAContext();

    // Determine context for thinking sequence
    const isFirstMessage = currentMessages.filter(m => m.role === "ai").length === 0;
    const hasDNA = !!(dnaContext?.brand_voice || dnaContext?.positioning_statement);

    // Start thinking IMMEDIATELY — do not wait
    const thinker = createThinkingSequence(
      'mentor_chat',
      hasDNA,
      isFirstMessage,
      (state) => {
        setThinkingState(state);
      }
    );

    // No delay before calling AI — thinking and AI call run in parallel
    try {
      const conversationHistory = currentMessages.slice(-8).map(m => ({
        role: m.role === "founder" ? "user" : "assistant",
        content: m.content,
      }));

      let streamingStarted = false;

      const aiResult = await getMentorAIResponse(
        user.id,
        activeBrand,
        dnaContext,
        conversationHistory,
        content,
        (chunkText) => {
          if (!streamingStarted) {
            // First chunk arrived — stop thinking, start streaming
            streamingStarted = true;
            thinker.stop();
            setThinkingState({ isThinking: false, currentMessage: '', progress: 0 });
            setStreamingMessageId(`streaming-${Date.now()}`);
          }
          setStreamingText(chunkText);
        },
        async (newName) => {
          // Project was auto-named — refresh silently
          await refreshBrands();

          // Subtle confirmation — not intrusive
          toast(`Project named "${newName}"`, {
            duration: 3000,
          });
        }
      );

      // Streaming complete
      thinker.stop();
      setThinkingState({ isThinking: false, currentMessage: '', progress: 0 });
      setStreamingMessageId(null);
      setStreamingText('');

      if (aiResult) {
        const aiMsg = await saveMessage(conversation.id, 'assistant', aiResult.text);
        if (aiMsg) {
          const aiMessage: Message = { id: aiMsg.id, role: "ai", content: aiResult.text };
          setBrandDataMap(prev => {
            const data = prev[brandId];
            if (!data) return prev;
            return { ...prev, [brandId]: { ...data, messages: [...data.messages, aiMessage] } };
          });

          setUnansweredMessageId(null);

          if (aiResult.choicePrompt) {
            const saved = await saveChoicePrompt(
              conversation.id,
              aiMsg.id,
              aiResult.choicePrompt.type,
              aiResult.choicePrompt.question,
              aiResult.choicePrompt.options,
              aiResult.choicePrompt.dnaField ?? undefined
            );
            if (saved) setActiveChoicePrompts(prev => [...prev, saved]);
          }

          // Detect save prompts
          const savePrompt = detectSavePrompts(aiResult.text, aiMsg.id);
          if (!savePrompt) {
            const lower = aiResult.text.toLowerCase();
            let fallbackPrompt: InlineSavePrompt | null = null;
            if (lower.includes("brand voice") || lower.includes("you sound like") || lower.includes("your voice")) {
              fallbackPrompt = { afterMessageId: aiMsg.id, label: "Save brand voice insight", dnaField: "Voice", value: aiResult.text.slice(0, 100) };
            } else if (lower.includes("position") || lower.includes("third space") || lower.includes("gap")) {
              fallbackPrompt = { afterMessageId: aiMsg.id, label: "Save positioning insight", dnaField: "Positioning", value: aiResult.text.slice(0, 100) };
            } else if (lower.includes("promise") || lower.includes("built for") || lower.includes("made for")) {
              fallbackPrompt = { afterMessageId: aiMsg.id, label: "Save brand promise", dnaField: "Core promise", value: aiResult.text.slice(0, 100) };
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

          // Detect milestone
          detectMilestone(brandId, aiMsg.id, [...currentMessages, aiMessage], aiResult.text);
        }
      }
    } catch (error) {
      thinker.stop();
      setThinkingState({ isThinking: false, currentMessage: '', progress: 0 });
      setStreamingMessageId(null);
      setStreamingText('');
      if (userMsg) {
        await markMessageAsFailed(userMsg.id);
        setUnansweredMessageId(userMsg.id);
      }
    }
  }, [activeBrand, activeBrandId, user, getDNAContext, detectMilestone, refreshBrands]);

  // ─── First AI message after onboarding ────────────────────────────────────
  // Sends a hidden trigger message to the AI to generate the opening message
  // that acknowledges the loaded context. The trigger user message is NOT
  // saved to the DB and never appears in the UI — only the AI response does.
  const triggerFirstAIMessage = useCallback(async (brandId: string) => {
    if (!user) return;

    // Wait briefly for conversation to be created/loaded if not yet ready
    let conversation = conversationMapRef.current[brandId];
    if (!conversation) {
      for (let i = 0; i < 10 && !conversation; i++) {
        await new Promise(r => setTimeout(r, 200));
        conversation = conversationMapRef.current[brandId];
      }
    }
    if (!conversation) {
      setFirstMessageBrands(prev => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
      return;
    }

    // Resolve the latest brand record (refreshBrands has just run)
    const { data: latestBrand } = await (supabase as any)
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();
    const brandForAI = latestBrand ?? activeBrand;
    if (!brandForAI) {
      setFirstMessageBrands(prev => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
      return;
    }

    const dnaContext = await getBrandDNA(brandId);

    const thinker = createThinkingSequence(
      'mentor_chat',
      !!(dnaContext?.brand_voice || dnaContext?.positioning_statement),
      true,
      (state) => setThinkingState(state)
    );

    // ─── Build dynamic trigger message ──────────────────────────────────────
    // Include captured fields and the next unfilled substage from the active
    // stage so the AI can acknowledge specifics and transition naturally.
    let capturedSection = "";
    let nextDirective = "Acknowledge the project context warmly in 2-3 sentences — show you understand what they are building. Then ask one focused, conversational question to start the conversation. Do not use bullet points or headers. Do not list back everything you know.";

    try {
      const stageKey = brandForAI.journey_stage ?? 'spark';
      const { getJourneyStageByKey } = await import('@/services/brandService');
      const { getSubstagesWithData } = await import('@/services/journeyDataService');
      const stageData = await getJourneyStageByKey(stageKey);
      const substages = stageData?.substages ?? [];
      const substageRows = await getSubstagesWithData(brandId, stageKey, substages);

      const capturedLines = substageRows
        .filter(r => r.isComplete && r.value)
        .map(r => `${r.label}: ${r.value}`);

      if (capturedLines.length > 0) {
        capturedSection = `\n\n${capturedLines.join('\n')}`;
      }

      const firstUncovered = substageRows.find(r => !r.isComplete);
      if (firstUncovered) {
        nextDirective = `The next thing we have not yet covered is: ${firstUncovered.label}\n\nAcknowledge the project context warmly in 2-3 sentences — show you understand what they are building. Then transition naturally into exploring the next uncovered area. Ask one focused, conversational question about it. Do not use bullet points or headers. Do not list back everything you know.`;
      } else if (substageRows.length > 0) {
        nextDirective = "All substages for the current stage are complete. Acknowledge this and suggest moving to the next stage.";
      }
    } catch (e) {
      console.error('Failed to build dynamic onboarding trigger:', e);
    }

    const triggerMessage = `[CONTEXT_LOADED] The founder has just completed onboarding. Here is what I already know about their project:${capturedSection}\n\n${nextDirective}`;

    try {
      let streamingStarted = false;

      const aiResult = await getMentorAIResponse(
        user.id,
        brandForAI,
        dnaContext,
        [],
        triggerMessage,
        (chunkText) => {
          if (!streamingStarted) {
            streamingStarted = true;
            thinker.stop();
            setThinkingState({ isThinking: false, currentMessage: '', progress: 0 });
            setStreamingMessageId(`streaming-${Date.now()}`);
          }
          setStreamingText(chunkText);
        },
        async (newName) => {
          await refreshBrands();
          toast(`Project named "${newName}"`, { duration: 3000 });
        }
      );

      thinker.stop();
      setThinkingState({ isThinking: false, currentMessage: '', progress: 0 });
      setStreamingMessageId(null);
      setStreamingText('');

      if (aiResult) {
        const aiMsg = await saveMessage(conversation.id, 'assistant', aiResult.text);
        if (aiMsg) {
          const aiMessage: Message = { id: aiMsg.id, role: "ai", content: aiResult.text };
          setBrandDataMap(prev => {
            const data = prev[brandId];
            if (!data) {
              return {
                ...prev,
                [brandId]: {
                  brand: { id: brandId, name: brandForAI.name, colorClass: "", startedDate: "" },
                  messages: [aiMessage],
                  milestones: [],
                  milestoneMarkers: [],
                  savePrompts: [],
                  dnaFields: emptyDNAFields,
                },
              };
            }
            return { ...prev, [brandId]: { ...data, messages: [...data.messages, aiMessage] } };
          });
        }
      }
    } catch (e) {
      thinker.stop();
      setThinkingState({ isThinking: false, currentMessage: '', progress: 0 });
      setStreamingMessageId(null);
      setStreamingText('');
      console.error('Failed to generate first AI message after onboarding:', e);
    } finally {
      setFirstMessageBrands(prev => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
    }
  }, [user, activeBrand, refreshBrands]);

  useEffect(() => {
    triggerFirstAIMessageRef.current = triggerFirstAIMessage;
  }, [triggerFirstAIMessage]);


  const handleRetry = useCallback(() => {
    const brandId = activeBrandId;
    const messages = brandDataMap[brandId]?.messages || [];
    if (messages.length > 0) {
      setChatError(null);
      handleAIResponse(brandId, messages);
    }
  }, [activeBrandId, brandDataMap, handleAIResponse]);

  const handleChoiceSelection = useCallback(async (
    prompt: ChoicePrompt,
    selectedValue: string,
    selectedLabel: string
  ) => {
    // Mark as answered
    await answerChoicePrompt(prompt.id, selectedValue);

    // Update activeChoicePrompts state
    setActiveChoicePrompts(prev =>
      prev.map(p => p.id === prompt.id
        ? { ...p, selected_option: selectedValue, is_answered: true }
        : p
      )
    );

    if (!activeBrand) return;

    const standardDNAFields = [
      'brand_voice',
      'positioning_statement',
      'core_promise',
      'target_audience',
      'brand_references',
      'campaign_strategy',
      'customer_insight',
      'product_positioning',
      'tone_descriptors',
      'brand_feel'
    ];

    const capitalise = (str: string): string =>
      str.split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    if (prompt.prompt_type === 'brand_name' || prompt.dna_field === 'brand_name') {
      const capitalisedName = capitalise(selectedValue);
      await updateBrandName(activeBrand.id, capitalisedName);
      await refreshBrands();
      setForceRefresh(prev => prev + 1);
    } else if (prompt.dna_field && standardDNAFields.includes(prompt.dna_field)) {
      // Standard DNA field — save to brand_dna table
      await updateBrandDNAField(activeBrand.id, prompt.dna_field as keyof BrandDNA, selectedValue);
      await refreshBrandDNA();
    } else if (prompt.dna_field) {
      // Truly custom field — save to brand_dna_custom_fields
      await saveCustomDNAField(
        activeBrand.id,
        prompt.dna_field,
        prompt.dna_field.replace(/_/g, ' '),
        selectedValue
      );
      const updated = await getCustomDNAFields(activeBrand.id);
      setCustomDNAFields(updated);
    }

    // Tell the right-panel substage view to re-fetch from brand_stage_data
    setForceRefresh(prev => prev + 1);

    // Send the selection as a user message
    const selectionMessage = `I like "${selectedLabel}".`;
    await handleSendMessage(selectionMessage);
  }, [activeBrand, refreshBrands, refreshBrandDNA, handleSendMessage]);

  const handleSaveCustomDNAField = async (fieldKey: string, fieldLabel: string, fieldValue: string) => {
    if (!activeBrand) return;
    await saveCustomDNAField(activeBrand.id, fieldKey, fieldLabel, fieldValue);
    const updated = await getCustomDNAFields(activeBrand.id);
    setCustomDNAFields(updated);
  };

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

  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // bold
      .replace(/\*(.*?)\*/g, '$1')     // italic
      .replace(/__(.*?)__/g, '$1')     // underline
      .replace(/`(.*?)`/g, '$1')       // code
      .trim();
  };

  const handleSaveDNA = useCallback(async (field: string, value: string) => {
    // Strip markdown before saving
    const cleanValue = stripMarkdown(value);

    setBrandDataMap(prev => {
      const data = prev[activeBrandId];
      if (!data) return prev;
      return {
        ...prev,
        [activeBrandId]: {
          ...data,
          dnaFields: data.dnaFields.map(f =>
            f.key === field ? { ...f, value: cleanValue, savedFrom: "Brand Discovery", savedTimeAgo: "Just now" } : f
          ),
        },
      };
    });
    setHighlightDNAField(field);
    setTimeout(() => setHighlightDNAField(null), 1500);
    await persistDNAField(activeBrandId, field, cleanValue);
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
          <p className="font-display text-[18px] leading-[1.7] text-foreground mb-2">No project selected — start by creating your first project</p>
          <div className="my-6 h-px bg-border dark:border-[#2A3A4A] w-full" style={{ height: "0.5px" }} />
          <div className="flex gap-3">
            <button
              className="flex-1 h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] hover:bg-primary/90 transition-colors"
              onClick={handleAddBrand}
            >
              + New Project
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

  if (!currentActiveBrand) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading brand...</div>
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
            realActiveBrand={activeBrand}
            activeBrandDNA={activeBrandDNA}
            onSelectBrand={handleSelectBrand}
            onAddBrand={handleAddBrand}
            milestones={activeBrandData?.milestones || []}
            onSelectMilestone={handleSelectMilestone}
            onRenameMilestone={handleRenameMilestone}
            onDeleteMilestone={handleDeleteMilestone}
            onEditMilestoneCategory={handleEditMilestoneCategory}
            conversation={conversationMapRef.current[currentActiveBrand?.id ?? ''] || null}
          />
        </aside>
      ) : (
        <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Brand & Milestones</SheetTitle>
            <BrandMilestonePanel
              brands={brands}
              activeBrand={currentActiveBrand}
              realActiveBrand={activeBrand}
              activeBrandDNA={activeBrandDNA}
              onSelectBrand={(b) => { handleSelectBrand(b); setLeftOpen(false); }}
              onAddBrand={() => { handleAddBrand(); setLeftOpen(false); }}
              milestones={activeBrandData?.milestones || []}
              onSelectMilestone={handleSelectMilestone}
              onRenameMilestone={handleRenameMilestone}
              onDeleteMilestone={handleDeleteMilestone}
              onEditMilestoneCategory={handleEditMilestoneCategory}
              conversation={conversationMapRef.current[currentActiveBrand?.id ?? ''] || null}
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

        {(() => {
          const isGeneratingFirstMessage = firstMessageBrands.has(activeBrandId);

          // While the first AI message is being generated after onboarding,
          // suppress the empty-state greeting and show the ChatPanel with
          // its thinking/streaming UI instead.
          if (!isGeneratingFirstMessage && activeEmptyMode) {
            return <MentorEmptyState mode={activeEmptyMode} onSubmit={handleEmptySubmit} />;
          }

          if (
            isGeneratingFirstMessage ||
            (activeBrandData && activeBrandData.messages.length > 0)
          ) {
            return (
              <ChatPanel
                brand={currentActiveBrand}
                stageName={currentStageData?.name}
                messages={activeBrandData?.messages ?? []}
                milestones={activeBrandData?.milestones ?? []}
                milestoneMarkers={activeBrandData?.milestoneMarkers ?? []}
                savePrompts={activeBrandData?.savePrompts ?? []}
                onSaveDNA={handleSaveDNA}
                scrollToMilestoneId={scrollToMilestoneId}
                onMilestoneScrolled={handleMilestoneScrolled}
                isMobile={isMobile}
                isTyping={isTyping}
                onSendMessage={handleSendMessage}
                error={chatError}
                onRetry={handleRetry}
                slowThinking={slowThinking}
                unansweredMessageId={unansweredMessageId}
                inputValue={inputValue}
                onInputValueChange={setInputValue}
                messageRefsMap={messageRefsMap}
                activeChoicePrompts={activeChoicePrompts}
                onChoiceSelect={handleChoiceSelection}
                thinkingState={thinkingState}
                streamingMessageId={streamingMessageId}
                streamingText={streamingText}
                onSaveStagePrompt={handleSaveStagePrompt}
                savedStagePromptKeys={savedStagePromptKeys}
              />
            );
          }

          return (
            <div className="flex flex-col h-full w-full items-center justify-center">
              <MentorEmptyState mode={activeEmptyMode || "new"} onSubmit={handleEmptySubmit} />
            </div>
          );
        })()}
      </div>

      {showRightInline ? (
        <aside className="w-[280px] flex-shrink-0 min-w-0 border-l border-border bg-card/50 overflow-hidden">
          <BrandDNAPanel
            fields={activeBrandData?.dnaFields || emptyDNAFields}
            highlightField={highlightDNAField}
            onEditField={handleEditDNAField}
            onClearField={handleClearDNAField}
            customFields={customDNAFields}
            onSaveCustomField={handleSaveCustomDNAField}
            conversation={conversationMapRef.current[currentActiveBrand?.id ?? ''] || null}
            dataRefreshTrigger={forceRefresh}
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
              customFields={customDNAFields}
              onSaveCustomField={handleSaveCustomDNAField}
              conversation={conversationMapRef.current[currentActiveBrand?.id ?? ''] || null}
              dataRefreshTrigger={forceRefresh}
            />
          </SheetContent>
        </Sheet>
      )}

      {showOnboarding && currentActiveBrand && (
        <ProjectOnboarding
          brandId={currentActiveBrand.id}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
};

export default Mentor;
