import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Create admin client with service role key for full access (bypasses RLS)
// Falls back to regular client if service key not available
export const adminSupabase = supabaseServiceKey 
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
  
  // First try without joins to see if basic table works
  let query = adminSupabase
    .from('creator_applications')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (statusFilter) query = query.eq('status', statusFilter);
  
  const { data, error } = await query;
  
  console.log('Creator applications result (basic):', { data: data?.length, error });
  
  // If basic query works, try with joins or manual profile fetching
  if (!error && data && data.length > 0) {
    console.log('Basic query worked, trying to get profile data...');
    
    // Try different join syntaxes
    let joinData = null;
    let joinError = null;
    
    // Try syntax 1: explicit foreign key
    try {
      let joinQuery = adminSupabase
        .from('creator_applications')
        .select(`
          *,
          profiles!creator_applications_user_id_fkey (full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false });
      
      if (statusFilter) joinQuery = joinQuery.eq('status', statusFilter);
      
      const result = await joinQuery;
      joinData = result.data;
      joinError = result.error;
      
      if (!joinError) {
        console.log('Creator applications result (join syntax 1):', { data: joinData?.length, error: joinError });
        return { data: joinData, error: joinError };
      }
    } catch (err) {
      console.log('Join syntax 1 failed:', err);
    }
    
    // Try syntax 2: implicit relationship
    try {
      let joinQuery = adminSupabase
        .from('creator_applications')
        .select(`
          *,
          profiles (full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false });
      
      if (statusFilter) joinQuery = joinQuery.eq('status', statusFilter);
      
      const result = await joinQuery;
      joinData = result.data;
      joinError = result.error;
      
      if (!joinError) {
        console.log('Creator applications result (join syntax 2):', { data: joinData?.length, error: joinError });
        return { data: joinData, error: joinError };
      }
    } catch (err) {
      console.log('Join syntax 2 failed:', err);
    }
    
    // Manual fallback: fetch profiles separately and merge
    console.log('All joins failed, trying manual profile merge...');
    try {
      const userIds = [...new Set(data.map(app => app.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await adminSupabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);
        
        if (!profilesError && profiles) {
          const profileMap = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {});
          
          const mergedData = data.map(app => ({
            ...app,
            profiles: profileMap[app.user_id] || null
          }));
          
          console.log('Creator applications result (manual merge):', { data: mergedData?.length });
          return { data: mergedData, error: null };
        }
      }
    } catch (mergeErr) {
      console.log('Manual merge failed:', mergeErr);
    }
    
    console.log('All join attempts failed, using basic result');
  }
  
  return { data, error };
};

// All templates for admin - bypasses RLS
export const getAllTemplatesAdmin = async (statusFilter?: string, typeFilter?: string) => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  console.log('Fetching all templates with admin service...');
  
  // First try without joins to see if basic table works
  let query = adminSupabase
    .from('prostudio_templates')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (statusFilter) query = query.eq('status', statusFilter);
  if (typeFilter) query = query.eq('template_type', typeFilter);
  
  const { data, error } = await query;
  
  console.log('Templates result (basic):', { data: data?.length, error });
  
  // If basic query works, try with joins or manual profile fetching
  if (!error && data && data.length > 0) {
    console.log('Basic template query worked, trying to get related data...');
    
    // Try different join syntaxes
    let joinData = null;
    let joinError = null;
    
    // Try syntax 1: explicit foreign keys
    try {
      let joinQuery = adminSupabase
        .from('prostudio_templates')
        .select(`
          *,
          template_preview_images!prostudio_templates_id_fkey (image_url, is_cover),
          creator_profiles!prostudio_templates_creator_id_fkey (display_name)
        `)
        .order('created_at', { ascending: false });
      
      if (statusFilter) joinQuery = joinQuery.eq('status', statusFilter);
      if (typeFilter) joinQuery = joinQuery.eq('template_type', typeFilter);
      
      const result = await joinQuery;
      joinData = result.data;
      joinError = result.error;
      
      if (!joinError) {
        console.log('Templates result (join syntax 1):', { data: joinData?.length, error: joinError });
        return { data: joinData, error: joinError };
      }
    } catch (err) {
      console.log('Template join syntax 1 failed:', err);
    }
    
    // Try syntax 2: implicit relationships
    try {
      let joinQuery = adminSupabase
        .from('prostudio_templates')
        .select(`
          *,
          template_preview_images (image_url, is_cover),
          creator_profiles (display_name)
        `)
        .order('created_at', { ascending: false });
      
      if (statusFilter) joinQuery = joinQuery.eq('status', statusFilter);
      if (typeFilter) joinQuery = joinQuery.eq('template_type', typeFilter);
      
      const result = await joinQuery;
      joinData = result.data;
      joinError = result.error;
      
      if (!joinError) {
        console.log('Templates result (join syntax 2):', { data: joinData?.length, error: joinError });
        return { data: joinData, error: joinError };
      }
    } catch (err) {
      console.log('Template join syntax 2 failed:', err);
    }
    
    // Manual fallback: fetch creator profiles separately and merge
    console.log('All template joins failed, trying manual profile merge...');
    try {
      // Debug: Check what creator field exists in template data
      console.log('Template data sample:', data[0]);
      console.log('Template fields:', Object.keys(data[0] || {}));
      
      const creatorIds = [...new Set(data.map(template => {
        // Use the correct field name from debug output
        return template.creator_id;
      }).filter(Boolean))];
      
      console.log('Extracted creator IDs:', creatorIds);
      
      if (creatorIds.length > 0) {
        const { data: creatorProfiles, error: profilesError } = await adminSupabase
          .from('profiles')
          .select('id, display_name, full_name')
          .in('id', creatorIds);
        
        console.log('Fetched creator profiles:', { 
          data: creatorProfiles?.length, 
          error: profilesError,
          profileSample: creatorProfiles?.[0] 
        });
        
        if (!profilesError && creatorProfiles) {
          const profileMap = creatorProfiles.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {});
          
          const mergedData = data.map(template => {
            // Use the correct creator_id field
            const creatorId = template.creator_id;
            const profile = profileMap[creatorId] || null;
            
            // Debug each template merge
            console.log('Merging template:', {
              templateName: template.name,
              creatorId,
              hasProfile: !!profile,
              profileName: profile?.display_name || profile?.full_name
            });
            
            return {
              ...template,
              creator_profiles: profile
            };
          });
          
          console.log('Templates result (manual merge):', { 
            data: mergedData?.length,
            sampleWithCreator: mergedData[0] ? {
              name: mergedData[0].name,
              creator_id: mergedData[0].creator_id,
              user_id: mergedData[0].user_id,
              created_by: mergedData[0].created_by,
              creator: mergedData[0].creator,
              creator_profiles: mergedData[0].creator_profiles
            } : null
          });
          return { data: mergedData, error: null };
        }
      }
    } catch (mergeErr) {
      console.log('Template manual merge failed:', mergeErr);
    }
    
    console.log('All template join attempts failed, using basic result');
  }
  
  return { data, error };
};

// Get template detail by ID - bypasses RLS
export const getTemplateDetailAdmin = async (templateId: string) => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  console.log('Fetching template detail with admin service...');
  
  // Fetch template basic info first
  const { data: templateData, error: templateError } = await adminSupabase
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (image_url, is_cover, sort_order)
    `)
    .eq('id', templateId)
    .single();

  if (templateError) {
    console.log('Template fetch failed:', templateError);
    return { data: null, error: templateError };
  }

  console.log('Template basic data fetched, fetching creator profile...');

  // Fetch creator profile separately since foreign key relationship doesn't exist
  let creatorProfile = null;
  if (templateData.creator_id) {
    const { data: profileData, error: profileError } = await adminSupabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', templateData.creator_id)
      .single();

    if (!profileError && profileData) {
      creatorProfile = profileData;
      console.log('Creator profile fetched successfully');
    } else {
      console.warn('Creator profile fetch failed:', profileError);
    }
  }

  // Also try to get creator_profiles if it exists
  let creatorProfileExtended = null;
  if (templateData.creator_id) {
    const { data: extendedData, error: extendedError } = await adminSupabase
      .from('creator_profiles')
      .select('display_name, avatar_url')
      .eq('id', templateData.creator_id)
      .single();

    if (!extendedError && extendedData) {
      creatorProfileExtended = extendedData;
      console.log('Extended creator profile fetched successfully');
    } else {
      console.warn('Extended creator profile fetch failed:', extendedError);
    }
  }

  // Combine the data
  const combinedData = {
    ...templateData,
    profiles: creatorProfile, // For backward compatibility
    creator_profiles: creatorProfileExtended, // Extended creator info
  };

  console.log('Template detail result:', { data: combinedData ? 'found' : 'not found', error: null });
  
  return { data: combinedData, error: null };
};

// Update template - bypasses RLS
export const updateTemplateAdmin = async (
  templateId: string,
  data: { status?: string; [key: string]: any }
): Promise<{ success: boolean; error?: string }> => {
  if (!adminSupabase) {
    throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
  }
  
  try {
    console.log('Updating template with admin service:', { templateId, data });
    
    const { error } = await adminSupabase
      .from('prostudio_templates')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);

    if (error) throw error;
    
    console.log('Template updated successfully');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update template:', error);
    return { success: false, error: error.message };
  }
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
