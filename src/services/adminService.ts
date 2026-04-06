import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

// ─── Dashboard Stats ───

export const getDashboardStats = async () => {
  const [users, brands, templates, pendingTemplates, pendingApps] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('brands').select('id', { count: 'exact', head: true }),
    db.from('prostudio_templates').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('prostudio_templates').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db.from('creator_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const pendingActions = (pendingTemplates.count ?? 0) + (pendingApps.count ?? 0);

  return {
    totalUsers: users.count ?? 0,
    totalBrands: brands.count ?? 0,
    totalTemplates: templates.count ?? 0,
    pendingTemplates: pendingTemplates.count ?? 0,
    pendingApplications: pendingApps.count ?? 0,
    pendingActions,
  };
};

export const getUserSignupsByDay = async (days: number) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await db
    .from('profiles')
    .select('created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (!data) return [];

  const map: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    map[d.toISOString().slice(0, 10)] = 0;
  }
  data.forEach((row: any) => {
    const key = row.created_at.slice(0, 10);
    if (map[key] !== undefined) map[key]++;
  });

  return Object.entries(map).map(([date, count]) => ({ date, count }));
};

export const getTemplateUsageByCategory = async () => {
  const { data } = await db
    .from('prostudio_templates')
    .select('category')
    .eq('status', 'published');

  if (!data) return [];
  const map: Record<string, number> = {};
  data.forEach((t: any) => {
    const cat = t.category || 'Uncategorized';
    map[cat] = (map[cat] || 0) + 1;
  });
  return Object.entries(map).map(([category, count]) => ({ category, count }));
};

export const getUserRoleBreakdown = async () => {
  const { data } = await db.from('profiles').select('role');
  if (!data) return { founders: 0, creators: 0, admins: 0, total: 0 };

  let founders = 0, creators = 0, admins = 0;
  data.forEach((p: any) => {
    const role = p.role || 'founder';
    if (role === 'admin') admins++;
    else if (role === 'creator') creators++;
    else founders++;
  });
  return { founders, creators, admins, total: data.length };
};

export const getRecentActivity = async (limit = 20) => {
  const [signups, apps, brandsData] = await Promise.all([
    db.from('profiles').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(limit),
    db.from('creator_applications').select('id, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(limit),
    db.from('brands').select('id, name, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(limit),
  ]);

  const activities: any[] = [];

  (signups.data || []).forEach((s: any) => {
    activities.push({ type: 'signup', label: `${s.full_name || 'Someone'} signed up`, timestamp: s.created_at });
  });
  (apps.data || []).forEach((a: any) => {
    activities.push({ type: 'application', label: `${a.profiles?.full_name || 'Someone'} applied as creator`, timestamp: a.created_at });
  });
  (brandsData.data || []).forEach((b: any) => {
    activities.push({ type: 'brand', label: `${b.profiles?.full_name || 'Someone'} created brand "${b.name}"`, timestamp: b.created_at });
  });

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, limit);
};

// ─── Users ───

export const getAllUsers = async (roleFilter?: string) => {
  let query = db.from('profiles').select('*').order('created_at', { ascending: false });
  if (roleFilter && roleFilter !== 'all') {
    query = query.eq('role', roleFilter);
  }
  const { data, error } = await query;
  return { data, error };
};

export const updateUserRole = async (userId: string, role: string) => {
  const { error } = await db.from('profiles').update({ role }).eq('id', userId);
  return { success: !error, error: error?.message };
};

// ─── Templates ───

export const getAllTemplates = async (statusFilter?: string, typeFilter?: string) => {
  let query = db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images ( id, image_url, is_cover, sort_order ),
      profiles!prostudio_templates_creator_id_fkey ( full_name )
    `)
    .order('updated_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('template_type', typeFilter);
  }

  const { data, error } = await query;
  return { data, error };
};

export const getTemplateDetail = async (templateId: string) => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images ( id, image_url, is_cover, sort_order ),
      profiles!prostudio_templates_creator_id_fkey ( full_name )
    `)
    .eq('id', templateId)
    .single();

  return { data, error };
};

// ─── Applications ───

export const getAllApplications = async (statusFilter?: string) => {
  let query = db
    .from('creator_applications')
    .select(`
      *,
      profiles!creator_applications_user_id_fkey ( full_name )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  return { data, error };
};

export const approveCreator = async (applicationId: string, notes: string) => {
  try {
    const { data: app, error: fetchErr } = await db
      .from('creator_applications')
      .select('user_id')
      .eq('id', applicationId)
      .single();

    if (fetchErr) throw fetchErr;

    const { error: appErr } = await db
      .from('creator_applications')
      .update({ status: 'approved', admin_notes: notes, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (appErr) throw appErr;

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
