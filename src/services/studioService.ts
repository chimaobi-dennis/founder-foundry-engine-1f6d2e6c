import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface RecentItem {
  id: string;
  name: string;
  createdAt: string;
}

export interface RecentCreations {
  socialContent: RecentItem[];
  logo: RecentItem[];
  documents: RecentItem[];
  reels: RecentItem[];
}

const toItems = (data: any[] | null): RecentItem[] =>
  (data || []).map((row) => ({
    id: row.id,
    name: row.name || 'Untitled',
    createdAt: row.created_at,
  }));

export async function getRecentCreations(userId: string): Promise<RecentCreations> {
  const [socialResult, logoResult, docsResult, reelsResult] = await Promise.all([
    db
      .from('content_studio_briefs')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2),

    db
      .from('studio_sessions')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .eq('source_module', 'logo_studio')
      .order('created_at', { ascending: false })
      .limit(2),

    db
      .from('documents')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2),

    db
      .from('reels')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2),
  ]);

  return {
    socialContent: toItems(socialResult.data),
    logo: toItems(logoResult.data),
    documents: toItems(docsResult.data),
    reels: toItems(reelsResult.data),
  };
}
