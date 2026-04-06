import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const getAdminStats = async () => {
  const [templates, pendingTemplates, creators, pendingApps] = await Promise.all([
    db.from('prostudio_templates').select('id', { count: 'exact', head: true }),
    db.from('prostudio_templates').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'creator'),
    db.from('creator_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const pendingActions = (pendingTemplates.count ?? 0) + (pendingApps.count ?? 0);

  return {
    totalTemplates: templates.count ?? 0,
    pendingReview: pendingTemplates.count ?? 0,
    totalCreators: creators.count ?? 0,
    pendingApplications: pendingApps.count ?? 0,
  };
};

export const getPendingTemplates = async () => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images ( id, image_url, is_cover, sort_order ),
      profiles!prostudio_templates_creator_id_fkey ( full_name )
    `)
    .eq('status', 'pending_review')
    .order('updated_at', { ascending: false });

  return { data, error };
};

export const getPendingTemplates = async () => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover),
      creator_profiles (display_name, avatar_url)
    `)
    .eq('status', 'pending_review')
    .order('updated_at', { ascending: true });
  return { data, error };
};

export const getPendingApplications = async () => {
  const { data, error } = await db
    .from('creator_applications')
    .select(`
      *,
      template_preview_images (image_url, is_cover),
      creator_profiles (display_name)
    `)
    .order('created_at', { ascending: false });

  return { data, error };
};

export const approveCreator = async (applicationId: string, notes: string) => {
  try {
    // Get application to find user_id
    const { data: app, error: fetchErr } = await db
      .from('creator_applications')
      .select('user_id')
      .eq('id', applicationId)
      .single();

    if (fetchErr) throw fetchErr;

    // Update application status
    const { error: appErr } = await db
      .from('creator_applications')
      .update({ status: 'approved', admin_notes: notes, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (appErr) throw appErr;

    // Update user role to creator
    const { error: roleErr } = await db
      .from('profiles')
      .update({ role: 'creator' })
      .eq('id', app.user_id);

    if (roleErr) throw roleErr;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const rejectCreator = async (applicationId: string, notes: string) => {
  try {
    const { error } = await db
      .from('creator_applications')
      .update({ status: 'rejected', admin_notes: notes, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
