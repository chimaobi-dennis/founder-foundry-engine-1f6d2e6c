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
  
  console.log('Fetching all creator applications with admin service...');
  
  let query = adminSupabase
    .from('creator_applications')
    .select(`
      *,
      profiles (full_name, email, avatar_url)
    `)
    .order('created_at', { ascending: false });
  
  if (statusFilter) query = query.eq('status', statusFilter);
  
  const { data, error } = await query;
  
  console.log('Creator applications result:', { data: data?.length, error });
  
  return { data, error };
};

// All templates for admin - bypasses RLS
export const getAllTemplatesAdmin = async (statusFilter?: string, typeFilter?: string) => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  console.log('Fetching all templates with admin service...');
  
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
  
  console.log('Templates result:', { data: data?.length, error });
  
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
  
  console.log('Fetching dashboard stats with admin service...');
  
  const [
    { count: totalUsers, error: usersError },
    { count: totalBrands, error: brandsError },
    { count: totalTemplates, error: templatesError },
    { count: pendingApplications, error: appsError },
    { count: pendingTemplates, error: pendingTemplatesError }
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

  const stats = {
    totalUsers: totalUsers ?? 0,
    totalBrands: totalBrands ?? 0,
    totalTemplates: totalTemplates ?? 0,
    pendingActions: (pendingApplications ?? 0) + (pendingTemplates ?? 0)
  };

  console.log('Dashboard stats result:', stats, { 
    errors: { usersError, brandsError, templatesError, appsError, pendingTemplatesError },
    rawCounts: { totalUsers, totalBrands, totalTemplates, pendingApplications, pendingTemplates }
  });

  return stats;
};

// Test function to verify admin service is working
export const testAdminService = async () => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured');
  }
  
  console.log('Testing admin service connection...');
  
  // Simple test - try to count profiles
  const { count, error } = await adminSupabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  console.log('Admin service test result:', { count, error });
  
  return { count, error };
};
