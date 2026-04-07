import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Create admin client with service role key for full access (bypasses RLS)
// Falls back to regular client if service key not available
const adminSupabase = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// All users for admin section - bypasses RLS
export const getAllUsersAdmin = async (roleFilter?: string) => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  let query = adminSupabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (roleFilter) query = query.eq('role', roleFilter);
  
  const { data, error } = await query;
  return { data, error };
};

// All creator applications - bypasses RLS
export const getAllApplicationsAdmin = async (statusFilter?: string) => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  let query = adminSupabase
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

// All templates for admin - bypasses RLS
export const getAllTemplatesAdmin = async (statusFilter?: string, typeFilter?: string) => {
  let query = adminSupabase
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

// Update user role - bypasses RLS
export const updateUserRoleAdmin = async (
  userId: string,
  newRole: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await adminSupabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Get dashboard stats - bypasses RLS
export const getDashboardStatsAdmin = async () => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  const [
    { count: totalUsers },
    { count: totalBrands },
    { count: totalTemplates },
    { count: pendingApplications },
    { count: pendingTemplates }
  ] = await Promise.all([
    adminSupabase.from('profiles').select('*', { count: 'exact', head: true }),
    adminSupabase.from('brands').select('*', { count: 'exact', head: true }),
    adminSupabase.from('prostudio_templates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    adminSupabase.from('creator_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    adminSupabase.from('prostudio_templates')
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
