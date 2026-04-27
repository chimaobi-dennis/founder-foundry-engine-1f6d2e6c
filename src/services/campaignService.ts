import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt } from './aiService';

const db = supabase as any;

/**
 * Prefill campaign brief with all available brand data
 */
export async function prefillCampaignBrief(brandId: string) {
  // Fetch brand DNA
  const { data: dna } = await db
    .from('brand_dna')
    .select('target_audience, core_promise, brand_voice, positioning_statement, customer_insight, campaign_strategy')
    .eq('brand_id', brandId)
    .single();

  // Fetch brand basic info
  const { data: brand } = await db
    .from('brands')
    .select('name, product_type')
    .eq('id', brandId)
    .single();

  // Fetch recent mentor messages to extract campaign-relevant context
  const { data: conversation } = await db
    .from('mentor_conversations')
    .select('id')
    .eq('brand_id', brandId)
    .single();

  let mentorContext = null;
  if (conversation?.id) {
    const { data: messages } = await db
      .from('mentor_messages')
      .select('content, role')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(20);
    mentorContext = messages;
  }

  // Fetch brand stage data for campaign-relevant fields
  const { data: stageData } = await db
    .from('brand_stage_data')
    .select('field_key, value')
    .eq('brand_id', brandId)
    .in('field_key', ['problem_statement', 'target_audience', 'who_has_problem', 'core_promise', 'campaign_strategy']);

  // Build prefill object — priority: brand_dna > brand_stage_data > brand name
  const stageMap = Object.fromEntries((stageData || []).map(s => [s.field_key, s.value]));

  return {
    product_name: brand?.name || '',
    target_audience: dna?.target_audience || stageMap['target_audience'] || stageMap['who_has_problem'] || '',
    key_benefit: dna?.core_promise || stageMap['core_promise'] || '',
    tone: dna?.brand_voice || '',
    call_to_action: '',
    campaign_goal: dna?.campaign_strategy || stageMap['campaign_strategy'] || '',
    mentor_context: mentorContext
  };
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  brandId: string,
  userId: string,
  brief: {
    name: string;
    product_name: string;
    target_audience: string;
    campaign_goal: string;
    tone: string;
    key_benefit: string;
    call_to_action: string;
    asset_id?: string;
    asset_type?: 'output' | 'product_image';
  }
) {
  const { data, error } = await db
    .from('campaigns')
    .insert({
      brand_id: brandId,
      user_id: userId,
      name: brief.name,
      product_name: brief.product_name,
      target_audience: brief.target_audience,
      campaign_goal: brief.campaign_goal,
      tone: brief.tone,
      key_benefit: brief.key_benefit,
      call_to_action: brief.call_to_action,
      asset_id: brief.asset_id || null,
      asset_type: brief.asset_type || null,
      status: 'active'
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Generate campaign creatives using AI
 */
export async function generateCampaignCreatives(campaignId: string, brief: any, brandDna: any) {
  const systemPrompt = await getSystemPrompt('campaign_copy') || `
You are an expert brand copywriter. Generate platform-specific marketing copy for all 8 platforms.
Return ONLY valid JSON — no markdown, no explanation.
`;

  const userPrompt = `
Generate campaign creatives for all 8 platforms for this brief:

BRAND: ${brief.product_name}
TARGET AUDIENCE: ${brief.target_audience}
CAMPAIGN GOAL: ${brief.campaign_goal}
KEY BENEFIT: ${brief.key_benefit}
TONE: ${brief.tone}
CALL TO ACTION: ${brief.call_to_action}

BRAND CONTEXT:
- Voice: ${brandDna?.brand_voice || 'Not defined'}
- Positioning: ${brandDna?.positioning_statement || 'Not defined'}
- Customer insight: ${brandDna?.customer_insight || 'Not defined'}

Return a JSON object with exactly these keys:
{
  "headlines": { "headline": "...", "copy_text": "...", "subject_line": "" },
  "instagram": { "headline": "...", "copy_text": "...", "subject_line": "" },
  "facebook_ad": { "headline": "...", "copy_text": "...", "subject_line": "" },
  "google_ad": { "headline": "...", "copy_text": "...", "subject_line": "" },
  "email": { "headline": "...", "copy_text": "...", "subject_line": "..." },
  "whatsapp": { "headline": "", "copy_text": "...", "subject_line": "" },
  "twitter_x": { "headline": "", "copy_text": "...", "subject_line": "" },
  "sms": { "headline": "", "copy_text": "...", "subject_line": "" }
}
`;

  const result = await callAI({
    taskType: 'campaign_copy',
    messages: [{ role: 'user', content: userPrompt }],
    systemPrompt,
    maxTokens: 4000
  });

  if (!result.success || !result.text) throw new Error(result.error || 'Generation failed');

  // Parse JSON response
  let creatives: Record<string, any>;
  try {
    const clean = result.text.replace(/```json|```/g, '').trim();
    creatives = JSON.parse(clean);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  // Save all 8 creatives to campaign_creatives
  const platforms = ['headlines', 'instagram', 'facebook_ad', 'google_ad', 'email', 'whatsapp', 'twitter_x', 'sms'];
  const inserts = platforms.map(platform => ({
    campaign_id: campaignId,
    platform,
    headline: creatives[platform]?.headline || null,
    copy_text: creatives[platform]?.copy_text || null,
    subject_line: creatives[platform]?.subject_line || null
  }));

  const { error } = await db.from('campaign_creatives').insert(inserts);
  if (error) throw error;

  return creatives;
}

/**
 * Get all campaigns for a brand with creative count
 */
export async function getCampaigns(brandId: string) {
  const { data, error } = await db
    .from('campaigns')
    .select(`
      id, name, product_name, campaign_goal, tone, status, created_at,
      campaign_creatives (id)
    `)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Get a single campaign with all its creatives
 */
export async function getCampaignWithCreatives(campaignId: string) {
  const { data, error } = await db
    .from('campaigns')
    .select(`*, campaign_creatives (*)`)
    .eq('id', campaignId)
    .single();
  if (error) throw error;
  return data;
}
