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

// Update user role
export const updateUserRole = async (
  userId: string,
  newRole: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const approveCreator = async (applicationId: string, notes: string) => {
  try {
    // Get current admin user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Admin user not authenticated');
    }
    const adminId = user.id;

    // Get application to find user_id and other details
    console.log('Fetching application data for approval...');
    
    // Fetch application data
    const appResult = await db
      .from('creator_applications')
      .select('user_id, portfolio_url')
      .eq('id', applicationId)
      .single();
    
    if (appResult.error) {
      console.error('Failed to fetch application:', appResult.error);
      throw appResult.error;
    }
    
    // Fetch user profile data (should exist since user submitted application)
    console.log('Fetching user profile for:', appResult.data.user_id);
    
    // Admins can read any profile through RLS ("Admins read all profiles").
    const profileResult = await db
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', appResult.data.user_id)
      .single();

    if (profileResult.error) {
      console.error('Profile fetch failed:', profileResult.error);
      throw new Error(`Failed to fetch user profile: ${profileResult.error.message}. User ID: ${appResult.data.user_id}`);
    }

    const profileData: any = profileResult.data;

    const app = {
      ...appResult.data,
      profiles: profileData
    };
    
    console.log('Application data fetched:', { 
      userId: app.user_id, 
      portfolioUrl: app.portfolio_url,
      fullName: app.profiles?.full_name 
    });

    // Update application status
    const { error: appErr } = await db
      .from('creator_applications')
      .update({ status: 'approved', reviewer_notes: notes, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (appErr) throw appErr;

    // Update user profile to creator role and set is_creator flag
    const { error: roleErr } = await db
      .from('profiles')
      .update({
        role: 'creator',
        is_creator: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', app.user_id);

    if (roleErr) {
      console.error('Failed to update user role:', roleErr);
      throw roleErr;
    } else {
      console.log('User role updated to creator successfully');
    }

    // Create creator profile record
    console.log('Creating creator profile...');
    const creatorProfileData = {
      id: app.user_id,
      display_name: app.profiles?.full_name || 'Creator',
      bio: null, // User will update themselves
      website_url: app.portfolio_url, // Use portfolio_url from application
      avatar_url: app.profiles?.avatar_url,
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: adminId,
      updated_at: new Date().toISOString()
    };
    
    console.log('Creator profile data:', creatorProfileData);
    
    const { error: creatorProfileErr } = await db
      .from('creator_profiles')
      .upsert(creatorProfileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (creatorProfileErr) {
      console.error('Failed to create creator profile:', creatorProfileErr);
      throw creatorProfileErr;
    } else {
      console.log('Creator profile created successfully');
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const rejectCreator = async (applicationId: string, notes: string) => {
  try {
    const { error } = await db
      .from('creator_applications')
      .update({ status: 'rejected', reviewer_notes: notes, reviewed_at: new Date().toISOString() })
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
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('brands').select('*', { count: 'exact', head: true }),
    db.from('prostudio_templates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    db.from('creator_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    db.from('prostudio_templates')
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

  const { data } = await db
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
  const { data } = await db
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
  const { data } = await db
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
    db
      .from('profiles')
      .select('full_name, created_at, role')
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('brands')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    db
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
export const getAllUsers = async (roleFilter?: string) => {
  let query = db
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (roleFilter) query = query.eq('role', roleFilter);
  const { data, error } = await query;
  return { data, error };
};

// Pending creator applications
export const getPendingApplications = async () => {
  const { data, error } = await db
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
export const getAllApplications = async (statusFilter?: string) => {
  let query = db
    .from('creator_applications')
    .select(`
      *,
      profiles (full_name, email, avatar_url)
    `)
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  return { data, error };
};

// Pending template reviews
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

// Get template detail by ID
export const getTemplateDetail = async (templateId: string) => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover, sort_order),
      creator_profiles (display_name, avatar_url)
    `)
    .eq('id', templateId)
    .single();

  return { data, error };
};

// All templates for admin
export const getAllTemplates = async (statusFilter?: string, typeFilter?: string) => {
  let query = db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover),
      creator_profiles (display_name)
    `)
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  if (typeFilter) query = query.eq('template_type', typeFilter);
  const { data, error } = await query;
  return { data, error };
};

// Approve creator application
export const approveCreatorApplication = async (
  applicationId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> => {
  console.log('Using manual approval approach (RPC functions need database update)');
  // Use manual approach directly until database RPC functions are updated
  return await approveCreator(applicationId, notes);
};

// Reject creator application
export const rejectCreatorApplication = async (
  applicationId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> => {
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

// Publish template
export const publishTemplate = async (
  templateId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await db
    .from('prostudio_templates')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', templateId);
  return { success: !error, error: error?.message };
};

// Unpublish template
export const unpublishTemplate = async (
  templateId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await db
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
  const { error } = await db
    .from('prostudio_templates')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString()
    })
    .eq('id', templateId);
  return { success: !error, error: error?.message };
};
// ═══════════════════════════════════════════════════════════════
// ADMIN PAGE QUERIES
//
// These used to run through a second client built from the service-role
// key (which was inlined into the browser bundle). They now run with the
// normal client; the "Admins ..." RLS policies added in
// 20260702000000_remove_frontend_service_role.sql grant the access.
// ═══════════════════════════════════════════════════════════════

type ProfileLite = { id: string; [key: string]: any };

const indexById = (rows: ProfileLite[] | null | undefined) =>
  (rows ?? []).reduce<Record<string, ProfileLite>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});

// All users for the Users section (admin).
export const getAllUsersAdmin = getAllUsers;

// Update a user's role (admin).
export const updateUserRoleAdmin = updateUserRole;

// Dashboard stats (admin).
export const getDashboardStatsAdmin = getDashboardStats;

// All creator applications with the applicant's profile (admin).
// Tries the embedded join first; if the FK relationship is not exposed,
// fetches profiles separately and merges them.
export const getAllApplicationsAdmin = async (statusFilter?: string) => {
  const joined = await getAllApplications(statusFilter);
  if (!joined.error) return joined;

  let query = db
    .from('creator_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error || !data?.length) return { data, error };

  const userIds = [...new Set(data.map((app: any) => app.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', userIds);

  if (profilesError) return { data, error: null };

  const profileMap = indexById(profiles);
  return {
    data: data.map((app: any) => ({ ...app, profiles: profileMap[app.user_id] ?? null })),
    error: null,
  };
};

// All templates with preview images and creator name (admin).
// Same join-then-merge strategy as getAllApplicationsAdmin.
export const getAllTemplatesAdmin = async (statusFilter?: string, typeFilter?: string) => {
  const joined = await getAllTemplates(statusFilter, typeFilter);
  if (!joined.error) return joined;

  let query = db
    .from('prostudio_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  if (typeFilter) query = query.eq('template_type', typeFilter);

  const { data, error } = await query;
  if (error || !data?.length) return { data, error };

  const creatorIds = [...new Set(data.map((t: any) => t.creator_id).filter(Boolean))];
  const { data: creatorProfiles, error: profilesError } = await db
    .from('profiles')
    .select('id, display_name, full_name')
    .in('id', creatorIds);

  if (profilesError) return { data, error: null };

  const profileMap = indexById(creatorProfiles);
  return {
    data: data.map((t: any) => ({ ...t, creator_profiles: profileMap[t.creator_id] ?? null })),
    error: null,
  };
};

// Template detail with preview images, the creator's profile and the
// creator's extended creator_profiles row (admin).
export const getTemplateDetailAdmin = async (templateId: string) => {
  const { data: templateData, error: templateError } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover, sort_order)
    `)
    .eq('id', templateId)
    .single();

  if (templateError) {
    return { data: null, error: templateError };
  }

  let creatorProfile: any = null;
  let creatorProfileExtended: any = null;

  if (templateData.creator_id) {
    const [profileResult, extendedResult] = await Promise.all([
      db.from('profiles').select('full_name, avatar_url').eq('id', templateData.creator_id).maybeSingle(),
      db.from('creator_profiles').select('display_name, avatar_url').eq('id', templateData.creator_id).maybeSingle(),
    ]);
    if (!profileResult.error) creatorProfile = profileResult.data;
    if (!extendedResult.error) creatorProfileExtended = extendedResult.data;
  }

  return {
    data: {
      ...templateData,
      profiles: creatorProfile,
      creator_profiles: creatorProfileExtended,
    },
    error: null,
  };
};

// Update a template's status / review fields (admin).
export const updateTemplateAdmin = async (
  templateId: string,
  data: { status?: string; [key: string]: any }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db
      .from('prostudio_templates')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', templateId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update template:', error);
    return { success: false, error: error.message };
  }
};
