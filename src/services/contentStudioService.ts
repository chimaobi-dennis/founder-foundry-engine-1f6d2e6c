import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt, injectPromptVariables } from './aiService';
import { logError } from './errorService';

const db = supabase as any;

// ─── Platform management ──────────────────────────────────

export async function getActivePlatforms() {
  const { data, error } = await db
    .from('content_platforms')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ─── Brief management ─────────────────────────────────────

export async function getBriefs(brandId: string) {
  const { data, error } = await db
    .from('content_studio_briefs')
    .select(`
      *,
      content_studio_creatives (id, status, platform_id)
    `)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBriefWithCreatives(briefId: string) {
  const { data, error } = await db
    .from('content_studio_briefs')
    .select(`
      *,
      content_studio_creatives (
        *,
        content_platforms (*)
      )
    `)
    .eq('id', briefId)
    .single();
  if (error) throw error;
  return data;
}

export async function createBrief(brandId: string, userId: string, brief: {
  name: string;
  brief?: string;
  campaign_goal?: string;
  tone?: string;
  is_series?: boolean;
  series_interval?: string;
  selected_platform_ids: string[];
}) {
  const nextGenAt = brief.is_series
    ? calculateNextGenerationTime(brief.series_interval || 'weekly')
    : null;

  const { data, error } = await db
    .from('content_studio_briefs')
    .insert({
      brand_id: brandId,
      user_id: userId,
      ...brief,
      series_active: brief.is_series || false,
      next_generation_at: nextGenAt,
      status: 'draft'
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function prefillBriefFromBrand(brandId: string) {
  const { data: dna } = await db
    .from('brand_dna')
    .select('target_audience, core_promise, brand_voice, campaign_strategy')
    .eq('brand_id', brandId)
    .single();

  const { data: brand } = await db
    .from('brands')
    .select('name, journey_stage')
    .eq('id', brandId)
    .single();

  const { data: stageData } = await db
    .from('brand_stage_data')
    .select('field_key, value')
    .eq('brand_id', brandId);

  const stageMap = Object.fromEntries((stageData || []).map(s => [s.field_key, s.value]));

  return {
    name: `${brand?.name || 'My Brand'} — Content`,
    campaign_goal: dna?.campaign_strategy || stageMap['campaign_strategy'] || '',
    tone: dna?.brand_voice || '',
    brief: ''
  };
}

// ─── Content generation ───────────────────────────────────

export async function generateContentForBrief(
  briefId: string,
  onPlatformComplete?: (platformId: string, creative: any) => void
) {
  // Fetch brief with brand context
  const { data: brief } = await db
    .from('content_studio_briefs')
    .select(`*, brands(*, brand_dna(*))`)
    .eq('id', briefId)
    .single();

  if (!brief) throw new Error('Brief not found');

  // Get selected platforms
  const { data: platforms } = await db
    .from('content_platforms')
    .select('*')
    .in('id', brief.selected_platform_ids || [])
    .order('sort_order');

  if (!platforms || platforms.length === 0) throw new Error('No platforms selected');

  // Update brief status
  await db
    .from('content_studio_briefs')
    .update({ status: 'generating' })
    .eq('id', briefId);

  const brand = brief.brands;
  const dna = brand?.brand_dna?.[0];

  // Fetch brand stage data for context
  const { data: stageData } = await db
    .from('brand_stage_data')
    .select('stage_key, field_key, value')
    .eq('brand_id', brand.id);

  const capturedContext = (stageData || [])
    .map(d => `${d.field_key}: ${d.value}`)
    .join('\n');

  // Fetch recent mentor messages for context
  const { data: conversation } = await db
    .from('mentor_conversations')
    .select('id')
    .eq('brand_id', brand.id)
    .single();

  let mentorContext = '';
  if (conversation?.id) {
    const { data: messages } = await db
      .from('mentor_messages')
      .select('content')
      .eq('conversation_id', conversation.id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(5);
    mentorContext = (messages || []).reverse().map(m => m.content.slice(0, 150)).join('\n');
  }

  // Generate session ID
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const sessionId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;

  // Generate copy for all platforms in one AI call
  const platformList = platforms.map(p =>
    `"${p.slug}": { "headline": "", "copy_text": "", "subject_line": "", "hashtags": [] }` 
  ).join(',\n');

  const copyPrompt = `
You are an expert brand copywriter. Generate platform-specific content for all platforms listed.

BRAND: ${brand.name}
BRAND VOICE: ${dna?.brand_voice || 'Not defined'}
CORE PROMISE: ${dna?.core_promise || 'Not defined'}
TARGET AUDIENCE: ${dna?.target_audience || 'Not defined'}
POSITIONING: ${dna?.positioning_statement || 'Not defined'}
CAMPAIGN GOAL: ${brief.campaign_goal || 'Build awareness'}
TONE: ${brief.tone || dna?.brand_voice || 'Confident'}
BRIEF: ${brief.brief || 'Create engaging brand content'}

BRAND CONTEXT FROM MENTOR:
${mentorContext || 'No mentor context yet'}

CAPTURED STAGE DATA:
${capturedContext || 'No stage data yet'}

PLATFORM GUIDELINES:
${platforms.map(p => `${p.slug}: max ${p.character_limit || 'unlimited'} chars. ${p.copy_guidelines || ''}`).join('\n')}

Return ONLY valid JSON with exactly these platform keys:
{
${platformList}
}

For each platform: write copy that matches that platform's style and character limit. Include relevant hashtags array for social platforms. Subject line only for email.
`;

  const copyResult = await callAI({
    taskType: 'campaign_copy',
    messages: [{ role: 'user', content: copyPrompt }],
    maxTokens: 4000
  });

  if (!copyResult.success || !copyResult.text) throw new Error('Copy generation failed');

  let copyData: Record<string, any> = {};
  try {
    const clean = copyResult.text.replace(/```json|```/g, '').trim();
    copyData = JSON.parse(clean);
  } catch {
    throw new Error('Failed to parse copy response as JSON');
  }

  // Now generate visuals for each platform in parallel
  const creatives: any[] = [];

  await Promise.all(platforms.map(async (platform) => {
    const platformCopy = copyData[platform.slug] || {};

    // Find suitable ProStudio template for this platform
    const { data: templates } = await db
      .from('prostudio_templates')
      .select('id, name, generation_prompt, template_type')
      .eq('status', 'published')
      .limit(20);

    // Ask AI to select best template or generate from scratch
    let visualHtml = null;
    let selectedTemplateId = null;

    const templateOptions = (templates || [])
      .map(t => `ID: ${t.id} | Name: ${t.name} | Prompt: ${t.generation_prompt?.slice(0, 100)}`)
      .join('\n');

    const visualSystemPrompt = await getSystemPrompt('template_generation') || `
You are a professional graphic designer. Generate a complete self-contained HTML/CSS design.
Return ONLY raw HTML. No markdown, no explanation, no code fences.
Root element must be a single div sized to ${platform.image_width || 600}x${platform.image_height || 600}px.
Every editable element must have a data-element attribute.
`;

    const visualPrompt = injectPromptVariables(visualSystemPrompt, {
      generation_prompt: `Create a ${platform.name} visual (${platform.aspect_ratio || '1:1'}) for: ${brief.brief || brief.campaign_goal || brand.name}. Headline: "${platformCopy.headline || ''}". Copy: "${(platformCopy.copy_text || '').slice(0, 100)}"`,
      aspectRatio: platform.aspect_ratio || '1:1',
      styleIntensity: brief.tone === 'Bold and direct' ? 'bold' : 'balanced',
      variant_index: '1',
      variant_count: '1',
      brand_voice: dna?.brand_voice || '',
      core_promise: dna?.core_promise || '',
      target_audience: dna?.target_audience || '',
      positioning_statement: dna?.positioning_statement || '',
      primary_color: brand.primary_color || '#000000',
      secondary_color: brand.secondary_color || '#ffffff',
      product_image_url: '',
      design_brief: `${platform.name} content for: ${brief.brief || brief.name}`,
      mentor_memory: mentorContext,
      journey_stage: brand.journey_stage || 'spark',
      captured_stage_data: capturedContext
    });

    const visualResult = await callAI({
      taskType: 'template_generation',
      messages: [{ role: 'user', content: visualPrompt }],
      maxTokens: 8000
    });

    if (visualResult.success && visualResult.text) {
      visualHtml = visualResult.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    }

    // Insert creative row
    const { data: creative, error } = await db
      .from('content_studio_creatives')
      .insert({
        brief_id: briefId,
        platform_id: platform.id,
        generation_session_id: sessionId,
        headline: platformCopy.headline || null,
        copy_text: platformCopy.copy_text || null,
        subject_line: platformCopy.subject_line || null,
        hashtags: platformCopy.hashtags || [],
        visual_html: visualHtml,
        template_id: selectedTemplateId,
        status: visualHtml ? 'ready' : 'failed'
      })
      .select('*, content_platforms(*)')
      .single();

    if (error) {
      await logError({
        errorMessage: error.message,
        errorType: 'ai_call',
        module: 'prostudio',
        componentName: 'contentStudioService'
      });
    } else {
      creatives.push(creative);
      onPlatformComplete?.(platform.id, creative);
    }
  }));

  // Update brief status and last generated time
  await db
    .from('content_studio_briefs')
    .update({
      status: 'ready',
      last_generated_at: new Date().toISOString(),
      next_generation_at: brief.is_series
        ? calculateNextGenerationTime(brief.series_interval || 'weekly')
        : null
    })
    .eq('id', briefId);

  // Create notification
  await createNotification(
    brief.user_id,
    brief.brand_id,
    'campaign_generated',
    'Content ready for review',
    `Your ${platforms.length} platform creatives for "${brief.name}" are ready to review and approve.`,
    `/content-studio/${briefId}` 
  );

  return creatives;
}

// ─── Notifications ────────────────────────────────────────

export async function createNotification(
  userId: string,
  brandId: string,
  type: string,
  title: string,
  body: string,
  actionUrl?: string,
  relatedId?: string
) {
  const { error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      brand_id: brandId,
      type,
      title,
      body,
      action_url: actionUrl || null,
      related_id: relatedId || null
    });
  if (error) console.error('Failed to create notification:', error);
}

export async function getNotifications(userId: string, unreadOnly = false) {
  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId: string) {
  await db
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

// ─── Approve and schedule ─────────────────────────────────

export async function approveCreativeToCalendar(
  creativeId: string,
  scheduledAt: string
) {
  // Get creative with platform and brief info
  const { data: creative } = await db
    .from('content_studio_creatives')
    .select('*, content_studio_briefs(brand_id, user_id, name), content_platforms(*)')
    .eq('id', creativeId)
    .single();

  if (!creative) throw new Error('Creative not found');

  // Insert into calendar_posts
  const { data: calendarPost, error } = await db
    .from('calendar_posts')
    .insert({
      brand_id: creative.content_studio_briefs.brand_id,
      platform: creative.content_platforms.slug,
      content: creative.copy_text,
      scheduled_date: scheduledAt,
      status: 'scheduled',
      visual_html: creative.visual_html
    })
    .select('id')
    .single();

  if (error) throw error;

  // Update creative with approval and calendar link
  await db
    .from('content_studio_creatives')
    .update({
      is_approved: true,
      scheduled_at: scheduledAt,
      calendar_post_id: calendarPost.id,
      status: 'scheduled'
    })
    .eq('id', creativeId);

  return calendarPost.id;
}

export async function regenerateCreative(
  creativeId: string,
  brandId: string
) {
  const { data: creative } = await db
    .from('content_studio_creatives')
    .select('*, content_platforms(*), content_studio_briefs(*, brands(*, brand_dna(*)))')
    .eq('id', creativeId)
    .single();

  if (!creative) throw new Error('Creative not found');

  const platform = creative.content_platforms;
  const brief = creative.content_studio_briefs;
  const brand = brief.brands;
  const dna = brand?.brand_dna?.[0];

  // Mark as generating
  await db
    .from('content_studio_creatives')
    .update({ status: 'generating' })
    .eq('id', creativeId);

  // Regenerate visual
  const visualSystemPrompt = await getSystemPrompt('template_generation') || '';
  const visualResult = await callAI({
    taskType: 'template_generation',
    messages: [{
      role: 'user',
      content: `Generate a fresh ${platform.name} visual (${platform.aspect_ratio}) for brand: ${brand.name}. Brief: ${brief.brief || brief.name}. Primary color: ${brand.primary_color}. Brand voice: ${dna?.brand_voice || ''}.` 
    }],
    maxTokens: 8000
  });

  const visualHtml = visualResult.success && visualResult.text
    ? visualResult.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    : creative.visual_html;

  await db
    .from('content_studio_creatives')
    .update({
      visual_html: visualHtml,
      status: 'ready'
    })
    .eq('id', creativeId);

  return visualHtml;
}

// ─── Series scheduling helpers ────────────────────────────

export function calculateNextGenerationTime(interval: string): string {
  const now = new Date();
  switch (interval) {
    case 'daily': now.setDate(now.getDate() + 1); break;
    case 'every_48h': now.setDate(now.getDate() + 2); break;
    case 'weekly': now.setDate(now.getDate() + 7); break;
    case 'biweekly': now.setDate(now.getDate() + 14); break;
    case 'monthly': now.setMonth(now.getMonth() + 1); break;
    default: now.setDate(now.getDate() + 7);
  }
  return now.toISOString();
}

export async function getActiveSeries() {
  const { data } = await db
    .from('content_studio_briefs')
    .select('*, brands(name)')
    .eq('is_series', true)
    .eq('series_active', true)
    .lte('next_generation_at', new Date().toISOString());
  return data || [];
}
