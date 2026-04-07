import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface TemplateData {
  name: string;
  description?: string;
  templateType: 'physical' | 'digital';
  category: string;
  digitalOutputType?: string;
  bestFor?: string[];
  generationPrompt?: string;
  previewBackground?: string;
  priceCredits?: number;
  isFree?: boolean;
}

export const createTemplate = async (
  creatorId: string,
  data: TemplateData
): Promise<{ success: boolean; templateId?: string; error?: string }> => {
  try {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data: template, error } = await db
      .from('prostudio_templates')
      .insert({
        creator_id: creatorId,
        name: data.name,
        slug,
        description: data.description,
        template_type: data.templateType,
        category: data.category,
        digital_output_type: data.digitalOutputType,
        best_for: data.bestFor || [],
        generation_prompt: data.generationPrompt,
        preview_background: data.previewBackground || '#1A2A3A',
        price_credits: data.priceCredits || 1,
        is_free: data.isFree !== false,
        status: 'draft'
      })
      .select('id')
      .single();

    if (error) throw error;
    return { success: true, templateId: template.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateTemplate = async (
  templateId: string,
  data: Partial<TemplateData> & { status?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db
      .from('prostudio_templates')
      .update({
        ...data.name && { name: data.name },
        ...data.description && { description: data.description },
        ...data.category && { category: data.category },
        ...data.bestFor && { best_for: data.bestFor },
        ...data.generationPrompt && { generation_prompt: data.generationPrompt },
        ...data.status && { status: data.status },
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const uploadTemplatePreviewImage = async (
  templateId: string,
  file: File,
  sortOrder: number
): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
  try {
    const filename = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;
    const storagePath = `${templateId}/${filename}`;

    // Try to upload to template-previews bucket first
    let uploadError;
    try {
      const result = await supabase.storage
        .from('template-previews')
        .upload(storagePath, file, { upsert: false });
      uploadError = result.error;
    } catch (err) {
      uploadError = err;
    }

    // If bucket doesn't exist, try using a default bucket or create a placeholder
    if (uploadError?.message?.includes('bucket') || uploadError?.message?.includes('not found')) {
      console.warn('template-previews bucket not found, using placeholder approach');
      
      // For now, create a data URL placeholder until the bucket is set up
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const publicUrl = dataUrl; // Use data URL as placeholder

      const isFirstImage = sortOrder === 0;

      const { error: dbError } = await db
        .from('template_preview_images')
        .insert({
          template_id: templateId,
          image_url: publicUrl,
          storage_path: storagePath,
          is_cover: isFirstImage,
          sort_order: sortOrder
        });

      if (dbError) throw dbError;

      if (isFirstImage) {
        await db
          .from('prostudio_templates')
          .update({ cover_image_url: publicUrl })
          .eq('id', templateId);
      }

      return { success: true, imageUrl: publicUrl };
    }

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('template-previews')
      .getPublicUrl(storagePath);

    const isFirstImage = sortOrder === 0;

    const { error: dbError } = await db
      .from('template_preview_images')
      .insert({
        template_id: templateId,
        image_url: publicUrl,
        storage_path: storagePath,
        is_cover: isFirstImage,
        sort_order: sortOrder
      });

    if (dbError) throw dbError;

    if (isFirstImage) {
      await db
        .from('prostudio_templates')
        .update({ cover_image_url: publicUrl })
        .eq('id', templateId);
    }

    return { success: true, imageUrl: publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const getPublishedTemplates = async (
  templateType: 'physical' | 'digital'
) => {
  // Fetch templates without the problematic join
  const { data: templatesData, error: templatesError } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (
        id, image_url, is_cover, sort_order
      )
    `)
    .eq('status', 'published')
    .eq('template_type', templateType)
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (templatesError) {
    return { data: null, error: templatesError };
  }

  // Fetch creator profiles separately for each template
  const templatesWithCreators = await Promise.all(
    (templatesData || []).map(async (template: any) => {
      let creatorProfile = null;
      
      if (template.creator_id) {
        // Try to get from creator_profiles first
        const { data: creatorData } = await db
          .from('creator_profiles')
          .select('display_name, avatar_url')
          .eq('id', template.creator_id)
          .single();
        
        if (creatorData) {
          creatorProfile = creatorData;
        } else {
          // Fallback to profiles table
          const { data: profileData } = await db
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', template.creator_id)
            .single();
          
          if (profileData) {
            creatorProfile = {
              display_name: profileData.full_name,
              avatar_url: profileData.avatar_url
            };
          }
        }
      }

      return {
        ...template,
        creator_profiles: creatorProfile
      };
    })
  );

  return { data: templatesWithCreators, error: null };
};

export const getCreatorTemplates = async (creatorId: string) => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (
        id, image_url, is_cover, sort_order
      )
    `)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  return { data, error };
};

// Get template by ID with full details
export const getTemplateById = async (templateId: string) => {
  // Fetch template without the problematic join
  const { data: templateData, error: templateError } = await db
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (
        id, image_url, is_cover, sort_order, caption
      )
    `)
    .eq('id', templateId)
    .single();

  if (templateError) {
    return { data: null, error: templateError };
  }

  // Fetch creator profile separately
  let creatorProfile = null;
  if (templateData.creator_id) {
    // Try to get from creator_profiles first
    const { data: creatorData } = await db
      .from('creator_profiles')
      .select('display_name, avatar_url')
      .eq('id', templateData.creator_id)
      .single();
    
    if (creatorData) {
      creatorProfile = creatorData;
    } else {
      // Fallback to profiles table
      const { data: profileData } = await db
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', templateData.creator_id)
        .single();
      
      if (profileData) {
        creatorProfile = {
          display_name: profileData.full_name,
          avatar_url: profileData.avatar_url
        };
      }
    }
  }

  const templateWithCreator = {
    ...templateData,
    creator_profiles: creatorProfile
  };

  return { data: templateWithCreator, error: null };
};

// Get all unique categories for a template type
export const getTemplateCategories = async (templateType: 'physical' | 'digital' = 'physical'): Promise<string[]> => {
  const { data, error } = await db
    .from('prostudio_templates')
    .select('category')
    .eq('template_type', templateType)
    .eq('status', 'published');

  if (error) return ['All'];
  
  // Type the data structure properly
  const templateData = data as Array<{ category: string }> | null;
  const categories = [...new Set((templateData || []).map((item) => item.category))];
  return ['All', ...categories.sort()];
};

// Increment template usage count
export const incrementTemplateUsage = async (templateId: string) => {
  const { error } = await db
    .from('prostudio_templates')
    .update({ uses_count: db.raw('uses_count + 1') })
    .eq('id', templateId);

  return { error };
};
