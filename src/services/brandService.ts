import { supabase } from '@/integrations/supabase/client';

// Keep this type for TypeScript but it is no longer the source of truth
export type JourneyStage = string;

export interface JourneyStageData {
  id: string;
  stage_key: string;
  name: string;
  emoji: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  mentor_focus: string | null;
  relevant_modules: string[];
  suggested_next_steps: {
    label: string;
    route: string;
    icon: string;
  }[];
  substages: string[];
}

// Fetch all active journey stages from DB
export const getJourneyStages = async (): Promise<JourneyStageData[]> => {
  const { data, error } = await (supabase as any)
    .from('journey_stages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching journey stages:', error);
    return [];
  }

  return data ?? [];
};

// Get a single stage by key
export const getJourneyStageByKey = async (
  stageKey: string
): Promise<JourneyStageData | null> => {
  const { data } = await (supabase as any)
    .from('journey_stages')
    .select('*')
    .eq('stage_key', stageKey)
    .single();

  return data ?? null;
};

// Update brand journey stage
export const updateJourneyStage = async (
  brandId: string,
  newStageKey: string,
  triggerType: 'mentor_suggestion' | 'user_selected' | 'auto_detected',
  context?: string
): Promise<{ success: boolean; error?: string }> => {
  const { data: brand } = await (supabase as any)
    .from('brands')
    .select('journey_stage')
    .eq('id', brandId)
    .single();

  // Log the stage change
  await (supabase as any)
    .from('brand_journey_events')
    .insert({
      brand_id: brandId,
      from_stage: brand?.journey_stage ?? null,
      to_stage: newStageKey,
      trigger_type: triggerType,
      context: context ?? null
    });

  const { error } = await (supabase as any)
    .from('brands')
    .update({
      journey_stage: newStageKey,
      journey_stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', brandId);

  return { success: !error, error: error?.message };
};

// Get stage progress for a brand
export const getStageProgress = async (
  brandId: string,
  stageKey: string
): Promise<{ substageIndex: number; isCompleted: boolean }[]> => {
  const { data } = await (supabase as any)
    .from('brand_stage_progress')
    .select('*')
    .eq('brand_id', brandId)
    .eq('stage_key', stageKey)
    .order('substage_index');

  return data ?? [];
};

// Mark a substage as complete
export const completeSubstage = async (
  brandId: string,
  stageKey: string,
  substageIndex: number
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('brand_stage_progress')
    .upsert({
      brand_id: brandId,
      stage_key: stageKey,
      substage_index: substageIndex,
      is_completed: true,
      completed_at: new Date().toISOString()
    }, { onConflict: 'brand_id,stage_key,substage_index' });

  return { success: !error, error: error?.message };
};

// Admin functions
export const getAllJourneyStages = async (): Promise<JourneyStageData[]> => {
  const { data } = await (supabase as any)
    .from('journey_stages')
    .select('*')
    .order('sort_order', { ascending: true });
  return data ?? [];
};

export const updateJourneyStageConfig = async (
  stageId: string,
  updates: Partial<JourneyStageData>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('journey_stages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', stageId);
  return { success: !error, error: error?.message };
};

export const createJourneyStage = async (
  stage: Omit<JourneyStageData, 'id'>
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('journey_stages')
    .insert(stage);
  return { success: !error, error: error?.message };
};

export interface Brand {
  id: string;
  user_id: string;
  name: string;
  slug?: string;
  industry?: string;
  tagline?: string;
  location?: string;
  primary_color: string;
  secondary_color: string;
  logo_url?: string;
  is_active: boolean;
  completeness_score: number;
  active_product_image_id?: string;
  journey_stage?: JourneyStage | null;
  journey_stage_updated_at?: string | null;
  created_at: string;
}

export interface BrandDNA {
  id: string;
  brand_id: string;
  brand_voice?: string;
  tone_descriptors?: string[];
  brand_references?: string;
  positioning_statement?: string;
  core_promise?: string;
  target_audience?: string;
  customer_profile?: string;
  pain_points?: string;
  why_choose_us?: string;
  brand_feel?: string[];
  campaign_strategy?: string;
  customer_insight?: string;
  product_positioning?: string;
}

// Get all brands for a user
export const getUserBrands = async (userId: string): Promise<Brand[]> => {
  const { data, error } = await (supabase as any)
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching brands:', error);
    return [];
  }
  return data ?? [];
};

// Get active brand (is_active = true) or first brand
export const getActiveBrand = async (userId: string): Promise<Brand | null> => {
  const { data } = await (supabase as any)
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (data) return data;

  // Fall back to most recent brand
  const { data: fallback } = await (supabase as any)
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return fallback ?? null;
};

// Set active brand
export const setActiveBrand = async (
  userId: string,
  brandId: string
): Promise<{ success: boolean; error?: string }> => {
  // Deactivate all brands for this user
  await (supabase as any)
    .from('brands')
    .update({ is_active: false })
    .eq('user_id', userId);

  // Activate selected brand
  const { error } = await (supabase as any)
    .from('brands')
    .update({ is_active: true })
    .eq('id', brandId)
    .eq('user_id', userId);

  return { success: !error, error: error?.message };
};

// Create a new brand
export const createBrand = async (
  userId: string,
  name: string
): Promise<{ success: boolean; brand?: Brand; error?: string }> => {
  // Deactivate existing brands
  await (supabase as any)
    .from('brands')
    .update({ is_active: false })
    .eq('user_id', userId);

  const { data, error } = await (supabase as any)
    .from('brands')
    .insert({
      user_id: userId,
      name,
      primary_color: '#2D4A3E',
      secondary_color: '#F5F0E8',
      is_active: true,
      completeness_score: 0
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Create empty brand_dna record
  await (supabase as any)
    .from('brand_dna')
    .insert({ brand_id: data.id });

  return { success: true, brand: data };
};

// Get brand DNA
export const getBrandDNA = async (brandId: string): Promise<BrandDNA | null> => {
  const { data } = await (supabase as any)
    .from('brand_dna')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  return data ?? null;
};

// Update brand DNA field
export const updateBrandDNAField = async (
  brandId: string,
  field: keyof BrandDNA,
  value: string | string[]
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('brand_dna')
    .update({
      [field]: value,
      updated_at: new Date().toISOString()
    })
    .eq('brand_id', brandId);

  if (error) {
    // If no row exists create it
    const { error: insertError } = await (supabase as any)
      .from('brand_dna')
      .insert({ brand_id: brandId, [field]: value });

    return { success: !insertError, error: insertError?.message };
  }

  return { success: true };
};

// Update brand name with capitalisation
export const updateBrandName = async (
  brandId: string,
  name: string
): Promise<{ success: boolean; error?: string }> => {
  // Capitalise first letter of each word
  const capitalisedName = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const { error } = await (supabase as any)
    .from('brands')
    .update({ 
      name: capitalisedName, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', brandId);

  return { success: !error, error: error?.message };
};

// Update brand completeness score
export const updateCompletenessScore = async (brandId: string): Promise<void> => {
  const { data: dna } = await (supabase as any)
    .from('brand_dna')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  if (!dna) return;

  const fields = [
    'brand_voice', 'positioning_statement', 'core_promise',
    'target_audience', 'brand_references', 'tone_descriptors'
  ];

  const filled = fields.filter(f => dna[f] && dna[f] !== null).length;
  const score = Math.round((filled / fields.length) * 100);

  await (supabase as any)
    .from('brands')
    .update({ completeness_score: score })
    .eq('id', brandId);
};

// Get product images for a brand
export const getProductImages = async (brandId: string) => {
  const { data, error } = await (supabase as any)
    .from('assets')
    .select('*')
    .eq('brand_id', brandId)
    .eq('type', 'product_image')
    .order('created_at', { ascending: false });

  return { data: data ?? [], error };
};

// Upload product image
export const uploadProductImage = async (
  userId: string,
  brandId: string,
  file: File
): Promise<{ success: boolean; asset?: any; error?: string }> => {
  const filename = `${userId}/${brandId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;

  const { error: uploadError } = await (supabase as any).storage
    .from('product-images')
    .upload(filename, file, { upsert: false });

  if (uploadError) return { success: false, error: uploadError.message };

  const { data: { publicUrl } } = (supabase as any).storage
    .from('product-images')
    .getPublicUrl(filename);

  const { data: asset, error: dbError } = await (supabase as any)
    .from('assets')
    .insert({
      brand_id: brandId,
      user_id: userId,
      name: file.name,
      type: 'product_image',
      source_module: 'upload',
      file_url: publicUrl,
      file_path: filename,
      mime_type: file.type,
      file_size_bytes: file.size
    })
    .select()
    .single();

  if (dbError) return { success: false, error: dbError.message };

  return { success: true, asset };
};
