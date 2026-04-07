import { supabase } from '@/integrations/supabase/client';

export interface CreatorApplicationData {
  whyApply: string;
  portfolioUrl?: string;
  promptEngineeringExperience: string;
  samplePrompt: string;
  motivation?: string;
}

const db = supabase as any;

export const submitCreatorApplication = async (
  userId: string,
  data: CreatorApplicationData
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: existing } = await db
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

    const { error } = await db
      .from('creator_applications')
      .insert({
        user_id: userId,
        why_apply: data.whyApply,
        portfolio_url: data.portfolioUrl || null,
        prompt_engineering_experience: data.promptEngineeringExperience,
        sample_prompt: data.samplePrompt,
        motivation: data.motivation || null,
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
  const { data } = await db
    .from('creator_applications')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.status ?? 'none';
};

export const getUserRole = async (
  userId: string
): Promise<'founder' | 'creator' | 'admin'> => {
  const { data } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return data?.role ?? 'founder';
};

export const approveCreator = async (
  applicationId: string,
  notes: string
) => {
  console.log('Using manual approval approach (RPC functions need database update)');
  // Use manual approach directly until database RPC functions are updated
  const { approveCreator: manualApprove } = await import('./adminService');
  return await manualApprove(applicationId, notes);
};

export const rejectCreatorApplication = async (
  applicationId: string,
  notes: string
) => {
  try {
    // Get current admin user ID for RPC call
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Admin user not authenticated');
    }
    const adminId = user.id;

    const { error } = await db.rpc('reject_creator', {
      application_id: applicationId,
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
      approved_by: adminId
    });
    return { success: !error, error: error?.message };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const getPendingApplications = async () => {
  const { data, error } = await db
    .from('creator_applications')
    .select(`
      *,
      profiles (full_name, avatar_url)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return { data, error };
};

export const getPendingTemplates = async () => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover),
      creator_profiles (display_name)
    `)
    .eq('status', 'pending_review')
    .order('updated_at', { ascending: true });
  return { data, error };
};