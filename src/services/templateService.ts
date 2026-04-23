import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt, injectPromptVariables } from './aiService';

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
  data: Partial<TemplateData> & { status?: string; admin_notes?: string; admin_signature?: string; reviewed_at?: string }
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

// Fetch product images available for template generation
export const getProjectImagesForTemplate = async (
  brandId: string
): Promise<{ images: any[]; activeImageId: string | null; error?: string }> => {
  try {
    // Fetch image assets from project_assets (file_type = 'image', not MIME type)
    const { data: assets, error: assetsError } = await db
      .from('project_assets')
      .select('id, name, file_url, file_type')
      .eq('brand_id', brandId)
      .eq('file_type', 'image')
      .order('created_at', { ascending: false });

    if (assetsError) throw assetsError;

    // Fetch active product image ID from brands
    const { data: brand, error: brandError } = await db
      .from('brands')
      .select('active_product_image_id')
      .eq('id', brandId)
      .single();

    if (brandError) throw brandError;

    return {
      images: assets || [],
      activeImageId: brand?.active_product_image_id || null
    };
  } catch (error: any) {
    return { images: [], activeImageId: null, error: error.message };
  }
};

// Upload a product image for ProStudio template generation
export const uploadProductImage = async (
  userId: string,
  brandId: string,
  file: File
): Promise<{ success: boolean; asset?: any; error?: string }> => {
  try {
    const filename = `${userId}/${brandId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;

    // Upload to project-files bucket (same bucket used by projectAssetsService)
    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filename, file);

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('project-files')
      .getPublicUrl(filename);

    // Insert into project_assets table
    const { data, error } = await db
      .from('project_assets')
      .insert({
        brand_id: brandId,
        user_id: userId,
        name: file.name,
        file_type: 'image',
        source: 'upload',
        file_url: publicUrl,
        storage_path: filename,
        mime_type: file.type,
        file_size_bytes: file.size,
        is_pinned: false
      })
      .select()
      .single();

    if (error) {
      // If DB insert fails, clean up the uploaded file
      await supabase.storage.from('project-files').remove([filename]);
      return { success: false, error: error.message };
    }

    return { success: true, asset: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Set the active product image for a brand
export const setActiveProductImage = async (
  brandId: string,
  assetId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db
      .from('brands')
      .update({ active_product_image_id: assetId })
      .eq('id', brandId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Ensure template_generation system prompt exists in ai_system_prompts
export const ensureTemplateGenerationSystemPrompt = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if it already exists
    const { data: existing } = await db
      .from('ai_system_prompts')
      .select('id')
      .eq('task_type', 'template_generation')
      .single();

    if (existing) {
      return { success: true };
    }

    // Insert the default system prompt
    const defaultPrompt = `You are a professional graphic designer and frontend developer.
Generate a complete, self-contained HTML/CSS design for the following brief.

TEMPLATE STYLE: {{generation_prompt}}
ASPECT RATIO: {{aspectRatio}} — canvas size should reflect this
STYLE INTENSITY: {{styleIntensity}} — subtle means minimal and clean, bold means high contrast and dramatic
VARIANT: This is variant {{variant_index}} of {{variant_count}} — make it distinct from other variants while staying on-brand

BRAND CONTEXT:
- Brand voice: {{brand_voice}}
- Core promise: {{core_promise}}
- Target audience: {{target_audience}}
- Positioning: {{positioning_statement}}
- Primary colour: {{primary_color}}
- Secondary colour: {{secondary_color}}

PRODUCT IMAGE: {{product_image_url}} — use this as an <img> src in the design

RULES:
- Return ONLY the HTML. No explanation, no markdown, no code fences.
- The design must be fully self-contained — all CSS inline or in a <style> tag in the same file
- Root element must be a single <div> with width and height set to match the aspect ratio (e.g. 600x600 for square, 600x900 for 9:16)
- Every editable element must have a data-element attribute: data-element="background", data-element="headline", data-element="tagline", data-element="product-image", data-element="brand-mark", data-element="accent-{n}" for decorative elements
- Use the brand's primary and secondary colours throughout
- Typography: use Google Fonts — import Playfair Display for headings, DM Sans for body
- The product image must be visible and prominent
- Do not use external assets other than the product image URL and Google Fonts`;

    const { error } = await db
      .from('ai_system_prompts')
      .insert({
        task_type: 'template_generation',
        system_prompt: defaultPrompt,
        is_active: true,
        version: 1
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Calculate template generation cost
export const calculateTemplateCost = async (
  templateId: string,
  aspectRatio: string,
  styleIntensity: string
): Promise<{ credits: number; breakdown: string[]; error?: string }> => {
  try {
    // Fetch template to get base price
    const { data: template, error: templateError } = await db
      .from('prostudio_templates')
      .select('price_credits, is_free')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    const breakdown: string[] = [];
    let credits = template?.is_free ? 0 : (template?.price_credits || 1);

    if (!template?.is_free) {
      breakdown.push(`Base template: ${template?.price_credits || 1} credit`);
    } else {
      breakdown.push('Base template: Free');
    }

    // Add cost for custom aspect ratio
    if (aspectRatio !== 'auto') {
      credits += 1;
      breakdown.push('Custom aspect ratio: +1 credit');
    }

    // Add cost for bold style intensity
    if (styleIntensity === 'bold') {
      credits += 1;
      breakdown.push('Bold style intensity: +1 credit');
    }

    return { credits, breakdown };
  } catch (error: any) {
    return { credits: 0, breakdown: [], error: error.message };
  }
};

// Fetch user's remaining credits
export const getUserCredits = async (
  userId: string
): Promise<{ credits: number | null; error?: string }> => {
  try {
    const { data: profile, error } = await db
      .from('profiles')
      .select('credits_remaining')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return { credits: profile?.credits_remaining ?? 0 };
  } catch (error: any) {
    return { credits: null, error: error.message };
  }
};

// Deduct credits from user's profile
export const deductCredits = async (
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db
      .from('profiles')
      .update({ credits_remaining: db.raw('credits_remaining - ' + amount) })
      .eq('id', userId)
      .gte('credits_remaining', amount); // Ensure they have enough credits

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Interface for template generation parameters
export interface GenerateTemplateParams {
  templateId: string;
  brandId: string;
  productImageUrl: string;
  aspectRatio: string;
  styleIntensity: string;
  variantCount: number;
  /** Optional base64 + mime of the product image so the model can SEE it (multi-modal). */
  imageBase64?: string;
  imageMimeType?: string;
  /** Optional callback fired as each variant completes (streaming/progressive UI). */
  onVariant?: (info: { index: number; html: string; outputId: string }) => void;
}

// Generate template output using AI.
// Variants are generated in parallel; if `onVariant` is supplied it fires as
// soon as each individual variant resolves so the UI can stream results in
// rather than wait for the whole batch.
export async function generateTemplateOutput({
  templateId,
  brandId,
  productImageUrl,
  aspectRatio,
  styleIntensity,
  variantCount,
  imageBase64,
  imageMimeType,
  onVariant
}: GenerateTemplateParams): Promise<{ variants: string[]; outputIds: string[]; error?: string }> {
  try {
    // Fetch template generation prompt
    const { data: template, error: templateError } = await db
      .from('prostudio_templates')
      .select('generation_prompt')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;
    const generationPrompt = template?.generation_prompt || 'Modern, clean design';

    // Fetch brand DNA
    const { data: brandDNA, error: dnaError } = await db
      .from('brand_dna')
      .select('brand_voice, core_promise, target_audience, positioning_statement')
      .eq('brand_id', brandId)
      .single();

    if (dnaError && dnaError.code !== 'PGRST116') throw dnaError;

    // Fetch brand colors
    const { data: brand, error: brandError } = await db
      .from('brands')
      .select('primary_color, secondary_color')
      .eq('id', brandId)
      .single();

    if (brandError) throw brandError;

    // Fetch the system prompt for template_generation
    let systemPrompt = await getSystemPrompt('template_generation');

    // If system prompt doesn't exist, create it with default content
    if (!systemPrompt) {
      const { success: ensureSuccess, error: ensureError } = await ensureTemplateGenerationSystemPrompt();
      if (!ensureSuccess) {
        return { variants: [], outputIds: [], error: `Failed to create system prompt: ${ensureError}` };
      }
      systemPrompt = await getSystemPrompt('template_generation');
    }

    if (!systemPrompt) {
      return { variants: [], outputIds: [], error: 'System prompt for template_generation not found and could not be created.' };
    }

    // Generate all variants in parallel and stream completions via onVariant.
    const variants: string[] = new Array(variantCount).fill('');
    const outputIds: string[] = new Array(variantCount).fill('');

    await Promise.all(
      Array.from({ length: variantCount }).map(async (_, i) => {
        const variantIndex = i + 1;

        // Inject template variables into the system prompt
        const filledPrompt = injectPromptVariables(systemPrompt, {
          generation_prompt: generationPrompt,
          aspectRatio,
          styleIntensity,
          variant_index: String(variantIndex),
          variant_count: String(variantCount),
          brand_voice: brandDNA?.brand_voice || 'Not yet defined',
          core_promise: brandDNA?.core_promise || 'Not yet defined',
          target_audience: brandDNA?.target_audience || 'Not yet defined',
          positioning_statement: brandDNA?.positioning_statement || 'Not yet defined',
          primary_color: brand?.primary_color || '#000000',
          secondary_color: brand?.secondary_color || '#ffffff',
          product_image_url: productImageUrl
        });

        const result = await callAI({
          taskType: 'template_generation',
          messages: [{ role: 'user', content: filledPrompt }],
          maxTokens: 8000,
          imageBase64,
          imageMimeType
        });

        if (!result.success || !result.text) {
          throw result.error || 'Failed to generate template variant';
        }

        // Strip any code fences the model adds despite instructions.
        let htmlContent = result.text.trim();
        htmlContent = htmlContent.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        // Save to template_outputs
        const { data: outputData, error: outputError } = await db
          .from('template_outputs')
          .insert({
            template_id: templateId,
            brand_id: brandId,
            output_type: 'html',
            output_data: htmlContent,
            generation_params: {
              aspectRatio,
              styleIntensity,
              variantIndex
            }
          })
          .select('id')
          .single();

        if (outputError) throw outputError;

        variants[i] = htmlContent;
        outputIds[i] = outputData.id;
        onVariant?.({ index: i, html: htmlContent, outputId: outputData.id });
      })
    );

    return { variants, outputIds };
  } catch (error: any) {
    return { variants: [], outputIds: [], error: error.message };
  }
}
