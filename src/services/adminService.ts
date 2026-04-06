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

// Dashboard stats
export const getDashboardStats = async () => {
  const [
    { count: totalUsers },
    { count: totalBrands },
    { count: totalTemplates },
    { count: pendingApplications },
    { count: pendingTemplates }
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('brands').select('*', { count: 'exact', head: true }),
    supabase.from('prostudio_templates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase.from('creator_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('prostudio_templates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review')
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    totalBrands: totalBrands ?? 0,
    totalTemplates: totalTemplates ?? 0,
    pendingActions: (pendingApplications ?? 0) + (pendingTemplates ?? 0)
  };
};

// User signups over time
export const getUserSignupsByDay = async (days: number = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at');

  // Group by day
  const grouped: Record<string, number> = {};
  data?.forEach(row => {
    const day = new Date(row.created_at).toISOString().split('T')[0];
    grouped[day] = (grouped[day] ?? 0) + 1;
  });

  // Fill missing days with 0
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = date.toISOString().split('T')[0];
    result.push({ date: day, count: grouped[day] ?? 0 });
  }

  return result;
};

// Role breakdown
export const getUserRoleBreakdown = async () => {
  const { data } = await supabase
    .from('profiles')
    .select('role');

  const breakdown = { founder: 0, creator: 0, admin: 0 };
  data?.forEach(row => {
    const role = row.role as keyof typeof breakdown;
    if (role in breakdown) breakdown[role]++;
  });

  return breakdown;
};

// Template usage by category
export const getTemplateUsageByCategory = async () => {
  const { data } = await supabase
    .from('prostudio_templates')
    .select('category, uses_count')
    .eq('status', 'published');

  const grouped: Record<string, number> = {};
  data?.forEach(row => {
    grouped[row.category] = (grouped[row.category] ?? 0) + (row.uses_count ?? 0);
  });

  return Object.entries(grouped)
    .map(([category, uses]) => ({ category, uses }))
    .sort((a, b) => b.uses - a.uses);
};

// Recent activity
export const getRecentActivity = async (limit: number = 20) => {
  const [users, brands, applications] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, created_at, role')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('brands')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('creator_applications')
      .select('created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit)
  ]);

  const events: { type: string; label: string; time: string; icon: string }[] = [];

  users.data?.forEach(u => events.push({
    type: 'signup',
    label: `${u.full_name} signed up`,
    time: u.created_at,
    icon: 'user'
  }));

  brands.data?.forEach(b => events.push({
    type: 'brand',
    label: `Brand "${b.name}" created`,
    time: b.created_at,
    icon: 'brand'
  }));

  applications.data?.forEach((a: any) => events.push({
    type: 'application',
    label: `Creator application from ${a.profiles?.full_name}`,
    time: a.created_at,
    icon: 'creator'
  }));

  return events
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);
};

// All users for Users section
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
};

// Pending creator applications
export const getPendingApplications = async () => {
  const { data, error } = await supabase
    .from('creator_applications')
    .select(`
      *,
      profiles (full_name, email, avatar_url, created_at)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return { data, error };
};

// All creator applications
export const getAllApplications = async () => {
  const { data, error } = await supabase
    .from('creator_applications')
    .select(`
      *,
      profiles (full_name, email, avatar_url)
    `)
    .order('created_at', { ascending: false });
  return { data, error };
};

// Pending template reviews
export const getPendingTemplates = async () => {
  const { data, error } = await supabase
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

// All templates for admin
export const getAllTemplates = async () => {
  const { data, error } = await supabase
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover),
      creator_profiles (display_name)
    `)
    .order('created_at', { ascending: false });
  return { data, error };
};

// Approve creator application
export const approveCreatorApplication = async (
  applicationId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('approve_creator', {
    application_id: applicationId,
    admin_notes: notes
  });
  return { success: !error, error: error?.message };
};

// Reject creator application
export const rejectCreatorApplication = async (
  applicationId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('reject_creator', {
    application_id: applicationId,
    admin_notes: notes
  });
  return { success: !error, error: error?.message };
};

// Publish template
export const publishTemplate = async (
  templateId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('prostudio_templates')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', templateId);
  return { success: !error, error: error?.message };
};

// Unpublish template
export const unpublishTemplate = async (
  templateId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('prostudio_templates')
    .update({ status: 'unpublished', updated_at: new Date().toISOString() })
    .eq('id', templateId);
  return { success: !error, error: error?.message };
};

// Request template changes (send back to draft)
export const requestTemplateChanges = async (
  templateId: string,
  feedback: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('prostudio_templates')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString()
    })
    .eq('id', templateId);
  return { success: !error, error: error?.message };
};