import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt, injectPromptVariables } from './aiService';
import { getBrandProductImages, setPrimaryProductImage, uploadBrandProductImage } from './projectAssetsService';
import { logError } from './errorService';

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
export async function incrementTemplateUsage(templateId: string) {
  const { data } = await db
    .from('prostudio_templates')
    .select('uses_count')
    .eq('id', templateId)
    .single();

  await db
    .from('prostudio_templates')
    .update({ uses_count: (data?.uses_count || 0) + 1 })
    .eq('id', templateId);
}

// Fetch product images available for template generation
export const getProjectImagesForTemplate = async (
  brandId: string
): Promise<{ images: any[]; activeImageId: string | null; error?: string }> => {
  try {
    // Fetch product images from project_assets using the new function
    const images = await getBrandProductImages(brandId);

    // Find the primary image (is_primary = true)
    const primaryImage = images.find(img => img.is_primary === true);

    return {
      images,
      activeImageId: primaryImage?.id || null
    };
  } catch (error: any) {
    return { images: [], activeImageId: null, error: error.message };
  }
};

// Upload a product image for ProStudio template generation
export const uploadProductImage = async (
  brandId: string,
  file: File
): Promise<{ success: boolean; asset?: any; error?: string }> => {
  return await uploadBrandProductImage(brandId, file);
};

// Set the active product image for a brand
export const setActiveProductImage = async (
  brandId: string,
  assetId: string
): Promise<{ success: boolean; error?: string }> => {
  return await setPrimaryProductImage(brandId, assetId);
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
  const { data: profile } = await db
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single();

  const current = profile?.credits_remaining || 0;
  if (current < amount) return { success: false, error: 'Insufficient credits' };

  const { error } = await db
    .from('profiles')
    .update({ credits_remaining: current - amount })
    .eq('id', userId);

  if (error) throw error;
  return { success: true };
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
    // Get userId from auth session to ensure RLS compliance
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return { variants: [], outputIds: [], error: 'Not authenticated' };
    }
    const userId = user.id;
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

    // Fetch the system prompt for template_generation with fallback
    const systemPrompt = await getSystemPrompt('template_generation') || `
You are a professional graphic designer and frontend developer.
Generate a complete self-contained HTML/CSS design for the following brief.
TEMPLATE STYLE: {{generation_prompt}}
ASPECT RATIO: {{aspectRatio}}
STYLE INTENSITY: {{styleIntensity}}
VARIANT: {{variant_index}} of {{variant_count}}
Brand name context: use {{brand_voice}}, {{core_promise}}, {{target_audience}}, {{positioning_statement}}
Primary colour: {{primary_color}}, Secondary colour: {{secondary_color}}
Product image URL: {{product_image_url}} — use in an img tag
Return ONLY raw HTML. No markdown, no code fences.
Root element must be a single div 600x600px with position:relative;overflow:hidden.
Every editable element must have a data-element attribute.
`;

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
            user_id: userId,
            brand_id: brandId,
            output_type: 'html_css',
            output_html: htmlContent,
            aspect_ratio: aspectRatio,
            style_intensity: styleIntensity === 'subtle' ? 1 : styleIntensity === 'balanced' ? 2 : 3,
            product_image_used: !!productImageUrl,
            variation_index: variantIndex,
            is_saved_to_library: false,
            is_downloaded: false,
            generation_params: { aspectRatio, styleIntensity, variantIndex }
          })
          .select('id')
          .single();

        if (outputError) throw outputError;

        variants[i] = htmlContent;
        outputIds[i] = outputData.id;
        onVariant?.({ index: i, html: htmlContent, outputId: outputData.id });

        // Parse and save elements to studio_elements (fire and forget - don't block on errors)
        saveElementsFromHtml(htmlContent, userId, brandId).catch(err => {
          console.error('Failed to save elements:', err);
        });
      })
    );

    return { variants, outputIds };
  } catch (error: any) {
    return { variants: [], outputIds: [], error: error.message };
  }
}

// ─── Element parsing and saving ────────────────────────────

const PRIVATE_ELEMENT_TYPES = ['headline', 'tagline', 'brand-mark', 'product-image'];

function getElementPrivacy(elementDataAttribute: string): boolean {
  return !PRIVATE_ELEMENT_TYPES.some(type =>
    elementDataAttribute === type || elementDataAttribute.startsWith(type)
  );
}

function getElementType(elementDataAttribute: string): string {
  if (elementDataAttribute === 'background') return 'background';
  if (['headline', 'tagline', 'brand-mark'].includes(elementDataAttribute)) return 'text';
  if (elementDataAttribute === 'product-image') return 'image';
  if (elementDataAttribute.startsWith('accent-')) return 'decoration';
  return 'other';
}

function getElementName(elementDataAttribute: string): string {
  if (elementDataAttribute === 'background') return 'Background';
  if (elementDataAttribute === 'headline') return 'Headline';
  if (elementDataAttribute === 'tagline') return 'Tagline';
  if (elementDataAttribute === 'brand-mark') return 'Brand Mark';
  if (elementDataAttribute === 'product-image') return 'Product Image';
  if (elementDataAttribute.startsWith('accent-')) {
    const num = elementDataAttribute.replace('accent-', '');
    return `Accent Shape ${num}`;
  }
  return elementDataAttribute
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

async function saveElementsFromHtml(html: string, userId: string, brandId: string): Promise<void> {
  if (typeof window === 'undefined') return; // Only run on client side

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('[data-element]');

  for (const el of elements) {
    const dataElement = el.getAttribute('data-element');
    if (!dataElement) continue;

    const isPublic = getElementPrivacy(dataElement);
    const elementType = getElementType(dataElement);
    const elementName = getElementName(dataElement);

    // For product-image, save generic placeholder instead of actual URL
    let htmlSnippet = el.outerHTML;
    if (dataElement === 'product-image') {
      htmlSnippet = '<img data-element="product-image" src="" />';
    }

    const snippetHash = hashString(htmlSnippet);

    // Check if element already exists
    const { data: existing } = await (supabase as any)
      .from('studio_elements')
      .select('id, uses_count')
      .eq('snippet_hash', snippetHash)
      .single();

    if (existing) {
      // Increment uses_count
      await (supabase as any)
        .from('studio_elements')
        .update({ uses_count: (existing.uses_count || 0) + 1 })
        .eq('id', existing.id);
    } else {
      // Insert new element
      await (supabase as any)
        .from('studio_elements')
        .insert({
          html_snippet: htmlSnippet,
          snippet_hash: snippetHash,
          element_type: elementType,
          name: elementName,
          is_public: isPublic,
          source: 'ai_generated',
          created_by: userId,
          brand_id: brandId,
          uses_count: 1
        });
    }
  }
}

// Get studio elements with privacy rules
export const getStudioElements = async (
  userId: string,
  filters?: { element_type?: string; search?: string }
): Promise<any[]> => {
  let query = (supabase as any)
    .from('studio_elements')
    .select('*')
    .or(`is_public.eq.true,created_by.eq.${userId}`)
    .order('uses_count', { ascending: false });

  if (filters?.element_type) {
    query = query.eq('element_type', filters.element_type);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,element_type.ilike.%${filters.search}%`);
  }

  const { data } = await query;
  return data ?? [];
};
