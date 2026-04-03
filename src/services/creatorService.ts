import { supabase } from '@/integrations/supabase/client';

export interface CreatorApplicationData {
  whyApply: string;
  portfolioUrl?: string;
  promptEngineeringExperience: string;
  samplePrompt: string;
}

export const submitCreatorApplication = async (
  userId: string,
  data: CreatorApplicationData
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if application already exists
    const { data: existing } = await supabase
      .from('creator_applications')
      .select('id, status')
      .eq('user_id', userId)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        return { success: false, error: 'You already have a pending application.' };
      }
      if (existing.status === 'approved') {
        return { success: false, error: 'You are already an approved creator.' };
      }
    }

    const { error } = await supabase
      .from('creator_applications')
      .insert({
        user_id: userId,
        why_apply: data.whyApply,
        portfolio_url: data.portfolioUrl || null,
        prompt_engineering_experience: data.promptEngineeringExperience,
        sample_prompt: data.samplePrompt,
        status: 'pending'
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const getApplicationStatus = async (
  userId: string
): Promise<'none' | 'pending' | 'approved' | 'rejected'> => {
  const { data } = await supabase
    .from('creator_applications')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return (data?.status as any) ?? 'none';
};

export const getUserRole = async (
  userId: string
): Promise<'founder' | 'creator' | 'admin'> => {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return (data?.role as any) ?? 'founder';
};
