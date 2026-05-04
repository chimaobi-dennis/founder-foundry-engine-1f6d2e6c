import { supabase } from '@/integrations/supabase/client';
import { logError } from './errorService';

const db = supabase as any;

// ─── Types ─────────────────────────────────────────────────────

export interface CalendarPost {
  id: string;
  brand_id: string;
  user_id: string;
  platform: string;
  scheduled_date: string;
  scheduled_time: string;
  copy_text?: string;
  headline?: string;
  visual_html?: string;
  content_studio_creative_id?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  // Joined fields from content_studio_creatives
  creative_visual_html?: string;
  creative_headline?: string;
  creative_copy_text?: string;
}

// ─── Get Calendar Posts by Month ─────────────────────────────

export async function getCalendarPosts(
  brandId: string,
  year: number,
  month: number
): Promise<CalendarPost[]> {
  try {
    console.log('[getCalendarPosts] Fetching posts for:', { brandId, year, month });

    // Calculate first and last day of the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const startDate = firstDay.toISOString().split('T')[0];
    const endDate = lastDay.toISOString().split('T')[0];

    console.log('[getCalendarPosts] Date range:', { startDate, endDate });

    const { data, error } = await db
      .from('calendar_posts')
      .select(`
        *,
        content_studio_creatives (
          id,
          visual_html,
          headline,
          copy_text
        )
      `)
      .eq('brand_id', brandId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('[getCalendarPosts] Error fetching posts:', error);
      throw error;
    }

    // Flatten the joined creative data into the calendar post object
    const posts = (data || []).map((post: any) => ({
      ...post,
      creative_visual_html: post.content_studio_creatives?.visual_html || post.visual_html,
      creative_headline: post.content_studio_creatives?.headline || post.headline,
      creative_copy_text: post.content_studio_creatives?.copy_text || post.copy_text,
    }));

    console.log('[getCalendarPosts] Fetched posts:', posts.length);
    return posts;
  } catch (error: any) {
    console.error('[getCalendarPosts] Error:', error);
    await logError({
      errorMessage: error.message || 'Failed to fetch calendar posts',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'calendarService',
      callLocation: 'getCalendarPosts',
      userAction: 'view_calendar',
      pipelineStep: 'fetch_database',
      context: { brandId, year, month }
    });
    return [];
  }
}

// ─── Get Calendar Posts for Date Range ───────────────────────

export async function getCalendarPostsForRange(
  brandId: string,
  startDate: string,
  endDate: string
): Promise<CalendarPost[]> {
  try {
    console.log('[getCalendarPostsForRange] Fetching posts for:', { brandId, startDate, endDate });

    const { data, error } = await db
      .from('calendar_posts')
      .select(`
        *,
        content_studio_creatives (
          id,
          visual_html,
          headline,
          copy_text
        )
      `)
      .eq('brand_id', brandId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('[getCalendarPostsForRange] Error fetching posts:', error);
      throw error;
    }

    // Flatten the joined creative data into the calendar post object
    const posts = (data || []).map((post: any) => ({
      ...post,
      creative_visual_html: post.content_studio_creatives?.visual_html || post.visual_html,
      creative_headline: post.content_studio_creatives?.headline || post.headline,
      creative_copy_text: post.content_studio_creatives?.copy_text || post.copy_text,
    }));

    console.log('[getCalendarPostsForRange] Fetched posts:', posts.length);
    return posts;
  } catch (error: any) {
    console.error('[getCalendarPostsForRange] Error:', error);
    await logError({
      errorMessage: error.message || 'Failed to fetch calendar posts for range',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'calendarService',
      callLocation: 'getCalendarPostsForRange',
      userAction: 'view_calendar',
      pipelineStep: 'fetch_database',
      context: { brandId, startDate, endDate }
    });
    return [];
  }
}

// ─── Delete Calendar Post ────────────────────────────────────

export async function deleteCalendarPost(calendarPostId: string): Promise<void> {
  try {
    console.log('[deleteCalendarPost] Deleting calendar post:', calendarPostId);

    // First, reset the linked creative
    const { error: updateError } = await db
      .from('content_studio_creatives')
      .update({
        calendar_post_id: null,
        scheduled_at: null,
        status: 'approved',
        is_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq('calendar_post_id', calendarPostId);

    if (updateError) {
      console.error('[deleteCalendarPost] Failed to reset creative:', updateError);
      throw updateError;
    }

    // Then delete the calendar post
    const { error: deleteError } = await db
      .from('calendar_posts')
      .delete()
      .eq('id', calendarPostId);

    if (deleteError) {
      console.error('[deleteCalendarPost] Failed to delete calendar post:', deleteError);
      throw deleteError;
    }

    console.log('[deleteCalendarPost] Calendar post deleted successfully');
  } catch (error: any) {
    console.error('[deleteCalendarPost] Error:', error);
    await logError({
      errorMessage: error.message || 'Failed to delete calendar post',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'calendarService',
      callLocation: 'deleteCalendarPost',
      userAction: 'delete_post',
      pipelineStep: 'delete_database',
      context: { calendarPostId }
    });
    throw error;
  }
}
