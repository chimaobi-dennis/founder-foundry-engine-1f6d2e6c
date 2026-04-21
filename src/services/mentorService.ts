import { supabase } from '@/integrations/supabase/client';
import { callAI, type TaskType, getSystemPrompt, injectPromptVariables } from './aiService';
import { logAIError } from './errorService';
import { getAssetsForAIContext } from './projectAssetsService';
import { isUntitledProject, updateProjectName } from './brandService';

// ─── Types ───────────────────────────────────────────────

export interface MentorConversation {
  id: string;
  brand_id: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface MentorMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  ai_response_failed?: boolean;
  created_at: string;
}

export interface Milestone {
  id: string;
  brand_id: string;
  conversation_id: string;
  name: string;
  category: string;
  message_id: string | null;
  created_at: string;
  stage_key: string | null;
  is_substage_milestone: boolean;
}

export interface ChoicePrompt {
  id: string;
  conversation_id: string;
  message_id: string;
  prompt_type: string;
  question: string;
  options: { label: string; value: string; description?: string }[];
  selected_option: string | null;
  is_answered: boolean;
  dna_field: string | null;
  created_at: string;
}

export interface MentorAIResult {
  text: string;
  choicePrompt?: {
    type: string;
    question: string;
    dnaField: string | null;
    options: { label: string; value: string; description?: string }[];
  } | null;
}

// ─── Conversation ─────────────────────────────────────────

export const getOrCreateConversation = async (
  brandId: string
): Promise<MentorConversation | null> => {
  const { data: existing } = await (supabase as any)
    .from('mentor_conversations')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  if (existing) return existing;

  const { data, error } = await (supabase as any)
    .from('mentor_conversations')
    .insert({ brand_id: brandId, message_count: 0 })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return data;
};

// ─── Messages ─────────────────────────────────────────────

export const getMessages = async (
  conversationId: string
): Promise<MentorMessage[]> => {
  const { data, error } = await (supabase as any)
    .from('mentor_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data ?? [];
};

export const saveMessage = async (
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<MentorMessage | null> => {
  const { data, error } = await (supabase as any)
    .from('mentor_messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();

  if (error) {
    console.error('Error saving message:', error);
    return null;
  }

  // Update last_message_at on the conversation
  await (supabase as any)
    .from('mentor_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
};

// ─── Milestones ───────────────────────────────────────────

export const getMilestones = async (
  brandId: string
): Promise<Milestone[]> => {
  const { data, error } = await (supabase as any)
    .from('milestones')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }

  return data ?? [];
};

export const createMilestone = async (
  brandId: string,
  conversationId: string,
  name: string,
  category: string,
  messageId?: string,
  context?: string
): Promise<Milestone | null> => {
  const { data, error } = await (supabase as any)
    .from('milestones')
    .insert({
      brand_id: brandId,
      conversation_id: conversationId,
      name,
      category,
      message_id: messageId ?? null,
      stage_key: context ?? null,
      is_substage_milestone: !!context
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating milestone:', error);
    return null;
  }

  return data;
};

export const deleteMilestone = async (
  milestoneId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('milestones')
    .delete()
    .eq('id', milestoneId);

  return { success: !error, error: error?.message };
};

export const updateMilestoneName = async (
  milestoneId: string,
  name: string
): Promise<void> => {
  await (supabase as any)
    .from('milestones')
    .update({ name })
    .eq('id', milestoneId);
};

export const updateMilestoneCategoryDB = async (
  milestoneId: string,
  category: string
): Promise<void> => {
  await (supabase as any)
    .from('milestones')
    .update({ category })
    .eq('id', milestoneId);
};

// ─── Get messages for AI context (last N messages) ───────

export const getMessagesForAIContext = async (
  conversationId: string,
  limit: number = 10
): Promise<{ role: string; content: string }[]> => {
  const { data } = await (supabase as any)
    .from('mentor_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse();
};

// ─── Unanswered message handling ─────────────────────

// Check if the last message in a conversation is unanswered
// Returns the unanswered user message or null
export const getUnansweredMessage = async (
  conversationId: string
): Promise<MentorMessage | null> => {
  const { data } = await (supabase as any)
    .from('mentor_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (!data || data.length === 0) return null;

  // Most recent message
  const lastMessage = data[0];

  // If the most recent message is from the user it is unanswered
  if (lastMessage.role === 'user') {
    return lastMessage;
  }

  return null;
};

// Mark a message as having failed AI response
// We track this by adding a failed_at timestamp
export const markMessageAsFailed = async (
  messageId: string
): Promise<void> => {
  await (supabase as any)
    .from('mentor_messages')
    .update({ ai_response_failed: true })
    .eq('id', messageId);
};

// Clear failed flag when retrying
export const clearMessageFailedFlag = async (
  messageId: string
): Promise<void> => {
  await (supabase as any)
    .from('mentor_messages')
    .update({ ai_response_failed: false })
    .eq('id', messageId);
};

// ─── AI response using centralized AI service ─────────────

export const generateProjectTitle = async (
  userId: string,
  brandId: string,
  brandName: string,
  firstUserMessage: string,
  firstAIResponse: string
): Promise<string | null> => {
  // Only run if project is still untitled
  if (!isUntitledProject(brandName)) return null;

  const result = await callAI({
    taskType: 'mentor_chat',
    userId,
    systemPrompt: `You generate short, descriptive project titles. You receive a founder's first message and the mentor's response. You output exactly 3 words that capture the essence of what is being built. 

Rules:
- Exactly 3 words. Never more, never less.
- Each word starts with a capital letter
- No punctuation
- No generic words like "The", "A", "An", "My", "New"
- Should sound like a real product or company name
- Examples: "Smart Founder OS", "Origin Brand Platform", "Solo Architect Tool", "Nordic Wellness App", "Legal Doc Engine"
- Output only the 3 words. Nothing else.`,
    messages: [
      {
        role: 'user',
        content: `Founder's first message: "${firstUserMessage}"\n\nMentor's response: "${firstAIResponse.slice(0, 300)}"\n\nGenerate a 3-word project title:`
      }
    ],
    maxTokens: 20
  });

  if (!result.success || !result.text) return null;

  // Clean the response — take first 3 words only
  const words = result.text
    .trim()
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3);

  if (words.length < 2) return null;

  return words.join(' ');
};

export const getMentorAIResponse = async (
  userId: string,
  brand: any,
  dna: any,
  conversationHistory: { role: string; content: string }[],
  userMessage: string,
  onChunk?: (text: string) => void,
  onProjectNamed?: (name: string) => void
): Promise<MentorAIResult | null> => {
  let systemPrompt = await getSystemPrompt('mentor_chat');

  if (!systemPrompt) {
    systemPrompt = `You are an experienced business mentor. Brand: {{brand_name}}. Be direct and helpful.`;
  }

  // Fetch current stage focus
  let stageFocus = '';
  if (brand?.journey_stage) {
    const { getJourneyStageByKey } = await import('./brandService');
    const stageData = await getJourneyStageByKey(brand.journey_stage);
    if (stageData?.mentor_focus) {
      stageFocus = `\n\nCURRENT STAGE — ${stageData.name.toUpperCase()}:\n${stageData.mentor_focus}`;
    }
  }

  systemPrompt = injectPromptVariables(systemPrompt, {
    brand_name: brand?.name ?? '',
    industry: brand?.industry ?? '',
    brand_voice: dna?.brand_voice ?? '',
    positioning_statement: dna?.positioning_statement ?? '',
    target_audience: dna?.target_audience ?? '',
    core_promise: dna?.core_promise ?? '',
    brand_references: dna?.brand_references ?? '',
    campaign_strategy: dna?.campaign_strategy ?? '',
    customer_insight: dna?.customer_insight ?? '',
    journey_stage: brand?.journey_stage ?? 'spark',
    stage_focus: stageFocus
  });

  // Inject project assets context
  const assetsContext = await getAssetsForAIContext(brand.id);
  if (assetsContext) {
    systemPrompt += assetsContext;
  }

  const result = await callAI({
    taskType: 'mentor_chat',
    userId,
    systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ],
    maxTokens: 2000,
    userAction: 'sent_mentor_message',
    onChunk
  });

  if (!result.success || !result.text) {
    await logAIError(
      userId,
      'mentor',
      result.error ?? 'No response from AI',
      {
        brandName: brand?.name,
        conversationHistoryLength: conversationHistory.length
      },
      'mentor_chat'
    );
    return null;
  }

  // Extract choice prompt if present
  const choicePromptMatch = result.text.match(
    /<CHOICE_PROMPT>([\s\S]*?)<\/CHOICE_PROMPT>/
  );

  let choicePrompt = null;
  let cleanText = result.text;

  if (choicePromptMatch) {
    try {
      const jsonString = choicePromptMatch[1].trim();
      const parsed = JSON.parse(jsonString);
      choicePrompt = {
        type: parsed.type,
        question: parsed.question,
        dnaField: parsed.dna_field ?? null,
        options: parsed.options
      };
    } catch (e) {
      console.error('Failed to parse choice prompt JSON:', e);
      console.error('Raw match:', choicePromptMatch[1]);
    }
    // Strip the entire CHOICE_PROMPT block including tags (even if parsing fails)
    cleanText = result.text
      .replace(/<CHOICE_PROMPT>[\s\S]*?<\/CHOICE_PROMPT>/g, '')
      .trim();
  }

  // cleanText is what gets saved to the database
  // choicePrompt is the extracted structured data

  // After getting a successful response check if we should auto-name
  const isFirstExchange = conversationHistory.length === 0 ||
    conversationHistory.filter(m => m.role === 'assistant').length === 0;

  const messageIsSubstantive = userMessage.trim().split(' ').length >= 5;

  if (
    isFirstExchange &&
    messageIsSubstantive &&
    isUntitledProject(brand?.name ?? '')
  ) {
    // Fire and forget — do not await, do not block the response
    generateProjectTitle(
      userId,
      brand.id,
      brand.name,
      userMessage,
      cleanText
    ).then(async (title) => {
      if (title) {
        const { success } = await updateProjectName(brand.id, title);
        if (success && onProjectNamed) {
          onProjectNamed(title);
        }
      }
    });
  }

  return { text: cleanText, choicePrompt };
};

// ─── Choice Prompts ─────────────────────────────────────────

export const saveChoicePrompt = async (
  conversationId: string,
  messageId: string,
  promptType: string,
  question: string,
  options: { label: string; value: string; description?: string }[],
  dnaField?: string
): Promise<ChoicePrompt | null> => {
  const { data, error } = await (supabase as any)
    .from('mentor_choice_prompts')
    .insert({
      conversation_id: conversationId,
      message_id: messageId,
      prompt_type: promptType,
      question,
      options,
      dna_field: dnaField ?? null,
      is_answered: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving choice prompt:', error);
    return null;
  }
  return data;
};

export const answerChoicePrompt = async (
  promptId: string,
  selectedOption: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('mentor_choice_prompts')
    .update({
      selected_option: selectedOption,
      is_answered: true
    })
    .eq('id', promptId);

  return { success: !error, error: error?.message };
};

export const getChoicePromptsForConversation = async (
  conversationId: string
): Promise<ChoicePrompt[]> => {
  const { data } = await (supabase as any)
    .from('mentor_choice_prompts')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at');

  return data ?? [];
};

// ─── Custom DNA Fields ─────────────────────────────────────

export const saveCustomDNAField = async (
  brandId: string,
  fieldKey: string,
  fieldLabel: string,
  fieldValue: string,
  messageId?: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('brand_dna_custom_fields')
    .upsert({
      brand_id: brandId,
      field_key: fieldKey,
      field_label: fieldLabel,
      field_value: fieldValue,
      created_from_message_id: messageId ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'brand_id,field_key' });

  return { success: !error, error: error?.message };
};

export const getCustomDNAFields = async (brandId: string) => {
  const { data } = await (supabase as any)
    .from('brand_dna_custom_fields')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at');

  return data ?? [];
};

// ─── Lovable Prompt Generation ─────────────────────────────────────

export const generateLovablePrompt = async (
  userId: string,
  brand: any,
  dna: any,
  conversationContext: string
): Promise<string | null> => {
  const result = await callAI({
    taskType: 'mentor_chat',
    userId,
    systemPrompt: `You are a technical product advisor helping a founder generate a precise prompt for Lovable (an AI app builder).

Based on the conversation context provided, generate a clear, specific Lovable prompt that will build exactly what the founder and mentor discussed.

The prompt should:
- Describe the specific screen or feature to build
- Include the visual style: dark background #0D1B2A, amber accent #D4A017, DM Sans font
- Specify the exact components needed
- Be ready to paste directly into Lovable

Output only the prompt text. No explanation. No preamble.`,
    messages: [
      {
        role: 'user',
        content: `Brand: ${brand?.name}. Context from our conversation: ${conversationContext}. Generate a Lovable prompt to build what we discussed.`
      }
    ],
    maxTokens: 800
  });

  return result.text ?? null;
};

// ─── Stage Field Detection ─────────────────────────────────────────────

export interface DetectedStageField {
  stageKey: string;
  fieldKey: string;
  fieldLabel: string;
  value: string;
  confidence: 'high' | 'medium';
}

export const detectStageFields = (
  responseText: string,
  currentStage: string,
  allStageFields: Record<string, any[]>
): DetectedStageField[] => {
  const clean = responseText.replace(/\*\*/g, '').toLowerCase();
  const detected: DetectedStageField[] = [];

  const lower = responseText.toLowerCase();

  const patterns: {
    stageKey: string;
    fieldKey: string;
    fieldLabel: string;
    keywords: string[];
    confidence: 'high' | 'medium';
    check?: (text: string) => boolean;
  }[] = [
    {
      stageKey: 'spark',
      fieldKey: 'problem_statement',
      fieldLabel: 'Problem Statement',
      keywords: ['the problem is', 'problem you are solving', 'core problem'],
      confidence: 'high'
    },
    {
      stageKey: 'spark',
      fieldKey: 'who_has_problem',
      fieldLabel: 'Who Has This Problem',
      keywords: ['your target', 'primary customer', 'solo architect', 'your ideal'],
      confidence: 'high'
    },
    {
      stageKey: 'brand',
      fieldKey: 'brand_voice',
      fieldLabel: 'Brand Voice',
      keywords: ['brand voice', 'your voice is', 'tone should be', 'sharp strategist'],
      confidence: 'high',
      check: (text) => (
        (lower.includes('brand voice is') ||
        lower.includes('your voice is') ||
        lower.includes('voice should be') ||
        lower.includes('sharp strategist') ||
        lower.includes('tone is')) &&
        !lower.includes('?') &&
        !lower.includes('my mistake') &&
        responseText.length > 100
      )
    },
    {
      stageKey: 'brand',
      fieldKey: 'positioning',
      fieldLabel: 'Positioning',
      keywords: ['positioning', 'vision vault', 'position yourself'],
      confidence: 'high',
      check: (text) => (
        (lower.includes('your positioning is') ||
        lower.includes('position yourself as') ||
        lower.includes('positioning statement') ||
        lower.includes('you are positioned as') ||
        lower.includes('vision vault') ||
        lower.includes('what makes you different')) &&
        !lower.includes('we have to lean') &&
        !lower.includes('my mistake') &&
        !lower.includes('got ahead') &&
        !lower.includes('?')
      )
    },
    {
      stageKey: 'brand',
      fieldKey: 'core_promise',
      fieldLabel: 'Core Promise',
      keywords: ['core promise', 'unfair advantage', 'you promise', 'the promise is'],
      confidence: 'high'
    },
    {
      stageKey: 'launch',
      fieldKey: 'campaign_strategy',
      fieldLabel: 'Campaign Strategy',
      keywords: ['campaign strategy', 'stop the tax', 'build your vault', 'launch approach'],
      confidence: 'medium'
    }
  ];

  patterns.forEach(pattern => {
    if (pattern.check && !pattern.check(responseText)) return;
    if (pattern.keywords.some(k => clean.includes(k))) {
      const sentence = extractRelevantSentence(responseText, pattern.keywords);
      if (sentence && sentence.length > 10) {
        detected.push({
          stageKey: pattern.stageKey,
          fieldKey: pattern.fieldKey,
          fieldLabel: pattern.fieldLabel,
          value: sentence,
          confidence: pattern.confidence
        });
      }
    }
  });

  return detected;
};

const extractRelevantSentence = (
  text: string,
  keywords: string[]
): string => {
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '');
  const sentences = clean
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s =>
      s.length > 20 &&
      !s.toLowerCase().startsWith('my mistake') &&
      !s.toLowerCase().startsWith('i got') &&
      !s.endsWith('?')
    );

  for (const keyword of keywords) {
    const match = sentences.find(s => s.toLowerCase().includes(keyword));
    if (match) return match;
  }

  return sentences[0] ?? '';
};
