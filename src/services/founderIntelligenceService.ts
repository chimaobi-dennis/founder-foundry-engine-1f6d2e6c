import { requirePrompt } from '@/services/aiService';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/* ========================================================================
   Founder Intelligence Service
   ------------------------------------------------------------------------
   Unified memory + intelligence layer for Kinika AI systems.

   PURPOSE:
   - Aggregate structured founder/business memory
   - Aggregate conversational memory
   - Aggregate creative/design memory
   - Synthesize unified AI context
   - Reduce stateless generation
   - Enable cumulative founder intelligence

   MODULES THAT SHOULD USE THIS:
   - Mentor
   - ContentStudio
   - CampaignKit
   - ProStudio
   - DocStudio
   - ReelBuilder
   - Future agents

   ======================================================================== */

export type IntelligenceModule =
  | 'mentor'
  | 'campaign_generation'
  | 'visual_generation'
  | 'documents'
  | 'video'
  | 'strategy'
  | 'general';

export interface StructuredMemory {
  brand: {
    id: string;
    name: string;
    journey_stage?: string;
    primary_color?: string;
    secondary_color?: string;
  };

  dna: Record<string, any>;

  stageData: Record<
    string,
    {
      value: string;
      stage_key: string;
      is_ai_discovered?: boolean;
      updated_at?: string;
    }
  >;

  groupedStageData: Record<string, Record<string, string>>;
}

export interface ConversationMemory {
  recentMessages: {
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }[];

  founderLanguagePatterns: string[];
  emotionalSignals: string[];
  strategicSignals: string[];
}

export interface GenerationPreferences {
  visualDirection?: string;
  visualAssets?: string[];
  layoutComplexity?: string;
  creativeMode?: string;
  aiFreedom?: number;
  imageDensity?: number;
}

export interface CreativeMemory {
  recentCreativeOutputs: {
    id: string;
    platform: string;
    headline?: string;
    summary?: string;
    created_at: string;
  }[];

  recurringThemes: string[];
  recurringVisualPatterns: string[];
  recurringTypographyPatterns: string[];
  recurringColorDirections: string[];
  recurringCTAStyles: string[];

  antiRepetitionSignals: string[];

  // AI Workspace Generation Preferences (from recent briefs)
  generationPreferences: GenerationPreferences;
}

export interface FounderIntelligenceContext {
  structuredMemory: StructuredMemory;
  conversationMemory: ConversationMemory;
  creativeMemory: CreativeMemory;

  synthesizedContext: {
    founderNarrative: string;
    strategicDirection: string;
    brandPersonality: string;
    communicationStyle: string;
    audienceSignals: string[];
    visualIdentitySignals: string[];
    antiRepetitionInstructions: string[];
  };

  promptContext: string;
}

/* ========================================================================
   MAIN ENTRY
   ======================================================================== */

export async function buildFounderIntelligenceContext(
  brandId: string,
  module: IntelligenceModule = 'general'
): Promise<FounderIntelligenceContext> {
  const [
    structuredMemory,
    conversationMemory,
    creativeMemory,
  ] = await Promise.all([
    getStructuredMemory(brandId),
    getConversationMemory(brandId),
    getCreativeMemory(brandId),
  ]);

  const synthesizedContext = synthesizeContext({
    structuredMemory,
    conversationMemory,
    creativeMemory,
    module,
  });

  const promptContext = buildPromptContext({
    structuredMemory,
    conversationMemory,
    creativeMemory,
    synthesizedContext,
    module, continuityRules: await requirePrompt('brand_continuity_rules') });

  return {
    structuredMemory,
    conversationMemory,
    creativeMemory,
    synthesizedContext,
    promptContext,
  };
}

/* ========================================================================
   STRUCTURED MEMORY
   ======================================================================== */

async function getStructuredMemory(
  brandId: string
): Promise<StructuredMemory> {
  const [{ data: brand }, { data: dna }, { data: stageData }] =
    await Promise.all([
      db
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single(),

      db
        .from('brand_dna')
        .select('*')
        .eq('brand_id', brandId)
        .maybeSingle(),

      db
        .from('brand_stage_data')
        .select('*')
        .eq('brand_id', brandId),
    ]);

  const normalizedStageData: StructuredMemory['stageData'] = {};
  const groupedStageData: StructuredMemory['groupedStageData'] = {};

  (stageData || []).forEach((item: any) => {
    normalizedStageData[item.field_key] = {
      value: item.value,
      stage_key: item.stage_key,
      is_ai_discovered: item.is_ai_discovered,
      updated_at: item.updated_at,
    };

    if (!groupedStageData[item.stage_key]) {
      groupedStageData[item.stage_key] = {};
    }

    groupedStageData[item.stage_key][item.field_key] = item.value;
  });

  return {
    brand: {
      id: brand?.id,
      name: brand?.name,
      journey_stage: brand?.journey_stage,
      primary_color: brand?.primary_color,
      secondary_color: brand?.secondary_color,
    },

    dna: dna || {},

    stageData: normalizedStageData,

    groupedStageData,
  };
}

/* ========================================================================
   CONVERSATION MEMORY
   ======================================================================== */

async function getConversationMemory(
  brandId: string
): Promise<ConversationMemory> {
  const { data: conversation } = await db
    .from('mentor_conversations')
    .select('id')
    .eq('brand_id', brandId)
    .maybeSingle();

  if (!conversation?.id) {
    return emptyConversationMemory();
  }

  const { data: messages } = await db
    .from('mentor_messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(40);

  const normalizedMessages = (messages || [])
    .reverse()
    .map((m: any) => ({
      role: m.role,
      content: truncate(m.content, 1200),
      created_at: m.created_at,
    }));

  const founderMessages = normalizedMessages
    .filter((m) => m.role === 'user')
    .map((m) => m.content);

  return {
    recentMessages: normalizedMessages,

    founderLanguagePatterns: extractLanguagePatterns(founderMessages),

    emotionalSignals: extractEmotionalSignals(founderMessages),

    strategicSignals: extractStrategicSignals(founderMessages),
  };
}

function emptyConversationMemory(): ConversationMemory {
  return {
    recentMessages: [],
    founderLanguagePatterns: [],
    emotionalSignals: [],
    strategicSignals: [],
  };
}

/* ========================================================================
   CREATIVE MEMORY
   ======================================================================== */

async function getCreativeMemory(
  brandId: string
): Promise<CreativeMemory> {
  // Fetch recent creatives with their briefs for generation preferences
  const { data: creatives } = await db
    .from('content_studio_creatives')
    .select(`
      id,
      headline,
      copy_text,
      visual_html,
      created_at,
      brief_id,
      content_platforms (
        name,
        slug
      ),
      content_studio_briefs (
        brand_id,
        visual_direction,
        visual_assets,
        layout_complexity,
        creative_mode,
        ai_freedom,
        image_density,
        generation_settings
      )
    `)
    .order('created_at', { ascending: false })
    .limit(30);

  const filteredCreatives = (creatives || []).filter(
    (c: any) =>
      c.content_studio_briefs?.brand_id === brandId
  );

  // Extract generation preferences from most recent brief with settings
  const latestBriefWithSettings = filteredCreatives.find(
    (c: any) => c.content_studio_briefs?.generation_settings || c.content_studio_briefs?.visual_direction
  )?.content_studio_briefs;

  const generationPreferences: GenerationPreferences = latestBriefWithSettings
    ? {
        visualDirection: latestBriefWithSettings.visual_direction || latestBriefWithSettings.generation_settings?.visual_direction,
        visualAssets: latestBriefWithSettings.visual_assets || latestBriefWithSettings.generation_settings?.visual_assets,
        layoutComplexity: latestBriefWithSettings.layout_complexity || latestBriefWithSettings.generation_settings?.layout_complexity,
        creativeMode: latestBriefWithSettings.creative_mode || latestBriefWithSettings.generation_settings?.creative_mode,
        aiFreedom: latestBriefWithSettings.ai_freedom ?? latestBriefWithSettings.generation_settings?.ai_freedom,
        imageDensity: latestBriefWithSettings.image_density ?? latestBriefWithSettings.generation_settings?.image_density,
      }
    : {}; // Empty defaults if no previous generation settings found

  const recentCreativeOutputs = filteredCreatives.map((c: any) => ({
    id: c.id,
    platform: c.content_platforms?.name || 'Unknown',
    headline: c.headline,
    summary: summarizeCreative(c),
    created_at: c.created_at,
  }));

  const allHtml = filteredCreatives
    .map((c: any) => c.visual_html || '')
    .join('\n');

  return {
    recentCreativeOutputs,

    recurringThemes: extractCreativeThemes(filteredCreatives),

    recurringVisualPatterns: detectVisualPatterns(allHtml),

    recurringTypographyPatterns: detectTypographyPatterns(allHtml),

    recurringColorDirections: detectColorPatterns(allHtml),

    recurringCTAStyles: detectCTAPatterns(allHtml),

    antiRepetitionSignals: buildAntiRepetitionSignals(filteredCreatives),

    generationPreferences,
  };
}

/* ========================================================================
   SYNTHESIS
   ======================================================================== */

function synthesizeContext({
  structuredMemory,
  conversationMemory,
  creativeMemory,
  module,
}: {
  structuredMemory: StructuredMemory;
  conversationMemory: ConversationMemory;
  creativeMemory: CreativeMemory;
  module: IntelligenceModule;
}) {
  const founderNarrative = `
${structuredMemory.brand.name} is currently operating in the ${structuredMemory.brand.journey_stage || 'early'} stage.

Core positioning:
${structuredMemory.dna?.positioning_statement || 'Not yet defined'}

Core promise:
${structuredMemory.dna?.core_promise || 'Not yet defined'}
`;

  return {
    founderNarrative,

    strategicDirection:
      structuredMemory.dna?.campaign_strategy ||
      structuredMemory.dna?.positioning_statement ||
      '',

    brandPersonality:
      structuredMemory.dna?.brand_voice ||
      '',

    communicationStyle:
      conversationMemory.founderLanguagePatterns.join(', '),

    audienceSignals: [
      structuredMemory.dna?.target_audience,
      ...conversationMemory.strategicSignals,
    ].filter(Boolean),

    visualIdentitySignals: [
      ...creativeMemory.recurringVisualPatterns,
      ...creativeMemory.recurringTypographyPatterns,
      ...creativeMemory.recurringColorDirections,
    ],

    antiRepetitionInstructions:
      creativeMemory.antiRepetitionSignals,
  };
}

/* ========================================================================
   PROMPT CONTEXT BUILDER
   ======================================================================== */

function buildPromptContext({
  structuredMemory,
  conversationMemory,
  creativeMemory,
  synthesizedContext,
  module,
  continuityRules,
}: {
  structuredMemory: StructuredMemory;
  conversationMemory: ConversationMemory;
  creativeMemory: CreativeMemory;
  synthesizedContext: any;
  module: IntelligenceModule;
  continuityRules: string;
}): string {
  return `
# BRAND IDENTITY

Brand:
${structuredMemory.brand.name}

Journey Stage:
${structuredMemory.brand.journey_stage || 'unknown'}

Brand Voice:
${structuredMemory.dna?.brand_voice || ''}

Core Promise:
${structuredMemory.dna?.core_promise || ''}

Positioning:
${structuredMemory.dna?.positioning_statement || ''}

Target Audience:
${structuredMemory.dna?.target_audience || ''}

# STRUCTURED FOUNDER MEMORY

${JSON.stringify(structuredMemory.groupedStageData, null, 2)}

# FOUNDER LANGUAGE SIGNALS

${conversationMemory.founderLanguagePatterns.join('\n')}

# STRATEGIC SIGNALS

${conversationMemory.strategicSignals.join('\n')}

# RECENT CREATIVE DIRECTIONS

${creativeMemory.recentCreativeOutputs
  .map(
    (o) => `
Platform: ${o.platform}
Headline: ${o.headline || ''}
Summary: ${o.summary || ''}
`
  )
  .join('\n')}

# RECURRING VISUAL PATTERNS

${creativeMemory.recurringVisualPatterns.join('\n')}

# TYPOGRAPHY PATTERNS

${creativeMemory.recurringTypographyPatterns.join('\n')}

# COLOR DIRECTIONS

${creativeMemory.recurringColorDirections.join('\n')}

# ANTI-REPETITION RULES

${creativeMemory.antiRepetitionSignals.join('\n')}

# MODULE CONTEXT

Current Module:
${module}

${continuityRules}
`;
}

/* ========================================================================
   PATTERN DETECTORS
   ======================================================================== */

function detectVisualPatterns(html: string): string[] {
  const patterns: string[] = [];

  if (html.includes('grid')) {
    patterns.push('grid-based compositions');
  }

  if (html.includes('border-radius')) {
    patterns.push('soft rounded containers');
  }

  if (html.includes('Playfair')) {
    patterns.push('editorial serif typography');
  }

  if (html.includes('display:flex')) {
    patterns.push('flex-based modern layouts');
  }

  return dedupe(patterns);
}

function detectTypographyPatterns(html: string): string[] {
  const patterns: string[] = [];

  if (html.includes('Playfair')) {
    patterns.push('high-contrast serif headlines');
  }

  if (html.includes('DM Sans')) {
    patterns.push('clean sans-serif body typography');
  }

  if (html.includes('letter-spacing')) {
    patterns.push('editorial tracking and uppercase metadata');
  }

  return dedupe(patterns);
}

function detectColorPatterns(html: string): string[] {
  const colors = html.match(/#[0-9A-Fa-f]{6}/g) || [];

  return dedupe(colors).slice(0, 12);
}

function detectCTAPatterns(html: string): string[] {
  const patterns: string[] = [];

  if (html.toLowerCase().includes('swipe up')) {
    patterns.push('swipe-up CTA');
  }

  if (html.toLowerCase().includes('learn more')) {
    patterns.push('learn-more CTA');
  }

  if (html.toLowerCase().includes('book now')) {
    patterns.push('book-now CTA');
  }

  return dedupe(patterns);
}

/* ========================================================================
   CREATIVE ANALYSIS
   ======================================================================== */

function summarizeCreative(creative: any): string {
  const html = creative.visual_html || '';

  const summary: string[] = [];

  if (html.includes('Playfair')) {
    summary.push('editorial serif typography');
  }

  if (html.includes('grid')) {
    summary.push('grid structure');
  }

  if (html.includes('uppercase')) {
    summary.push('editorial metadata labels');
  }

  if (html.includes('border-radius')) {
    summary.push('rounded UI aesthetic');
  }

  return summary.join(', ');
}

function extractCreativeThemes(creatives: any[]): string[] {
  const text = creatives
    .map((c) => `${c.headline || ''} ${c.copy_text || ''}`)
    .join(' ')
    .toLowerCase();

  const themes: string[] = [];

  if (text.includes('trust')) themes.push('trust');
  if (text.includes('transparent')) themes.push('transparency');
  if (text.includes('growth')) themes.push('growth');
  if (text.includes('future')) themes.push('future');
  if (text.includes('scale')) themes.push('scale');

  return dedupe(themes);
}

function buildAntiRepetitionSignals(creatives: any[]): string[] {
  const signals: string[] = [];

  const repeatedHeadlines = creatives
    .map((c) => c.headline)
    .filter(Boolean);

  if (repeatedHeadlines.length > 5) {
    signals.push(
      'Avoid repeating identical headline structures'
    );
  }

  signals.push(
    'Create fresh compositions while preserving brand coherence'
  );

  signals.push(
    'Do not reuse identical section layouts from recent outputs'
  );

  return signals;
}

/* ========================================================================
   SIGNAL EXTRACTION
   ======================================================================== */

function extractLanguagePatterns(messages: string[]): string[] {
  const joined = messages.join(' ').toLowerCase();

  const patterns: string[] = [];

  if (joined.includes('founder')) {
    patterns.push('founder-centric language');
  }

  if (joined.includes('premium')) {
    patterns.push('premium positioning');
  }

  if (joined.includes('simple')) {
    patterns.push('clarity-oriented communication');
  }

  return dedupe(patterns);
}

function extractEmotionalSignals(messages: string[]): string[] {
  const joined = messages.join(' ').toLowerCase();

  const signals: string[] = [];

  if (joined.includes('frustrated')) {
    signals.push('operational frustration');
  }

  if (joined.includes('trust')) {
    signals.push('trust seeking');
  }

  if (joined.includes('confused')) {
    signals.push('clarity seeking');
  }

  return dedupe(signals);
}

function extractStrategicSignals(messages: string[]): string[] {
  const joined = messages.join(' ').toLowerCase();

  const signals: string[] = [];

  if (joined.includes('automation')) {
    signals.push('automation direction');
  }

  if (joined.includes('memory')) {
    signals.push('memory infrastructure positioning');
  }

  if (joined.includes('ai')) {
    signals.push('AI-native workflows');
  }

  return dedupe(signals);
}

/* ========================================================================
   HELPERS
   ======================================================================== */

function truncate(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}
