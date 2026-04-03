import { supabase } from '@/integrations/supabase/client';

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

    const { data: template, error } = await supabase
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
    const { error } = await supabase
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

    const { error: uploadError } = await supabase.storage
      .from('template-previews')
      .upload(storagePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('template-previews')
      .getPublicUrl(storagePath);

    const isFirstImage = sortOrder === 0;

    const { error: dbError } = await supabase
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
      await supabase
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
  const { data, error } = await supabase
    .from('prostudio_templates')
    .select(`
      *,
      template_preview_images (
        id, image_url, is_cover, sort_order
      ),
      creator_profiles (
        display_name, avatar_url
      )
    `)
    .eq('status', 'published')
    .eq('template_type', templateType)
    .order('sort_order');

  return { data, error };
};

export const getCreatorTemplates = async (creatorId: string) => {
  const { data, error } = await supabase
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
