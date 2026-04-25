import { supabase } from '@/integrations/supabase/client';
import { logError } from './errorService';

export interface ProjectAsset {
  id: string;
  brand_id: string;
  user_id: string;
  name: string;
  file_type: string;
  source: string;
  file_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  content_text: string | null;
  stage_key: string | null;
  message_id: string | null;
  description: string | null;
  is_pinned: boolean;
  is_primary: boolean;
  created_at: string;
}

export const getProjectAssets = async (
  brandId: string
): Promise<ProjectAsset[]> => {
  const { data } = await (supabase as any)
    .from('project_assets')
    .select('*')
    .eq('brand_id', brandId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  return data ?? [];
};

export const uploadProjectFile = async (
  brandId: string,
  file: File,
  stageKey?: string,
  description?: string
): Promise<{ success: boolean; asset?: ProjectAsset; error?: string }> => {
  // Get userId from auth session to ensure RLS compliance
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return { success: false, error: 'Not authenticated' };
  }
  const userId = user.id;

  try {
    const filename = `${userId}/${brandId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filename, file);

    if (uploadError) {
      await logError({
        userId,
        errorType: 'storage',
        module: 'other',
        errorMessage: uploadError.message || 'Storage upload failed',
        callLocation: 'uploadProjectFile — projectAssetsService',
        userAction: 'upload_project_file',
        pipelineStep: 'storage_upload',
        componentName: 'projectAssetsService',
        context: { filename, brandId, userId }
      });
      return { success: false, error: uploadError.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('project-files')
      .getPublicUrl(filename);

    const fileType = getFileType(file.type);

    const { data, error } = await (supabase as any)
      .from('project_assets')
      .insert({
        brand_id: brandId,
        user_id: userId,
        name: file.name,
        file_type: fileType,
        source: 'uploaded',
        file_url: publicUrl,
        storage_path: filename,
        mime_type: file.type,
        file_size_bytes: file.size,
        stage_key: stageKey ?? null,
        description: description ?? null
      })
      .select()
      .single();

    if (error) {
      await logError({
        userId,
        errorType: 'database',
        module: 'other',
        errorMessage: error.message || 'Database insert failed',
        callLocation: 'uploadProjectFile — projectAssetsService',
        userAction: 'upload_project_file',
        pipelineStep: 'db_insert',
        componentName: 'projectAssetsService',
        context: { filename, brandId, userId }
      });
      return { success: false, error: error.message };
    }
    return { success: true, asset: data };
  } catch (error: any) {
    await logError({
      userId,
      errorType: 'unknown',
      module: 'other',
      errorMessage: error?.message || 'Unknown error in uploadProjectFile',
      callLocation: 'uploadProjectFile — projectAssetsService',
      userAction: 'upload_project_file',
      pipelineStep: 'upload_project_file',
      componentName: 'projectAssetsService',
      context: { brandId, userId, fileName: file.name },
      errorStack: error?.stack
    });
    return { success: false, error: error?.message || 'Upload failed' };
  }
};

export const saveAIGeneratedAsset = async (
  brandId: string,
  name: string,
  contentText: string,
  stageKey?: string,
  messageId?: string
): Promise<{ success: boolean; asset?: ProjectAsset; error?: string }> => {
  // Get userId from auth session to ensure RLS compliance
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return { success: false, error: 'Not authenticated' };
  }
  const userId = user.id;

  try {
    const { data, error } = await (supabase as any)
      .from('project_assets')
      .insert({
        brand_id: brandId,
        user_id: userId,
        name,
        file_type: 'document',
        source: 'ai_generated',
        content_text: contentText,
        stage_key: stageKey ?? null,
        message_id: messageId ?? null
      })
      .select()
      .single();

    if (error) {
      await logError({
        userId,
        errorType: 'database',
        module: 'other',
        errorMessage: error.message || 'Database insert failed',
        callLocation: 'saveAIGeneratedAsset — projectAssetsService',
        userAction: 'save_ai_generated_asset',
        pipelineStep: 'db_insert',
        componentName: 'projectAssetsService',
        context: { brandId, userId, name }
      });
      return { success: false, error: error.message };
    }
    return { success: true, asset: data };
  } catch (error: any) {
    await logError({
      userId,
      errorType: 'unknown',
      module: 'other',
      errorMessage: error?.message || 'Unknown error in saveAIGeneratedAsset',
      callLocation: 'saveAIGeneratedAsset — projectAssetsService',
      userAction: 'save_ai_generated_asset',
      pipelineStep: 'save_ai_generated_asset',
      componentName: 'projectAssetsService',
      context: { brandId, userId, name },
      errorStack: error?.stack
    });
    return { success: false, error: error?.message || 'Save failed' };
  }
};

export const togglePinAsset = async (
  assetId: string,
  isPinned: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await (supabase as any)
      .from('project_assets')
      .update({ is_pinned: isPinned })
      .eq('id', assetId);

    if (error) {
      await logError({
        errorType: 'database',
        module: 'other',
        errorMessage: error.message || 'Database update failed',
        callLocation: 'togglePinAsset — projectAssetsService',
        userAction: 'toggle_pin_asset',
        pipelineStep: 'db_update',
        componentName: 'projectAssetsService',
        context: { assetId, isPinned }
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    await logError({
      errorType: 'unknown',
      module: 'other',
      errorMessage: error?.message || 'Unknown error in togglePinAsset',
      callLocation: 'togglePinAsset — projectAssetsService',
      userAction: 'toggle_pin_asset',
      pipelineStep: 'toggle_pin_asset',
      componentName: 'projectAssetsService',
      context: { assetId, isPinned },
      errorStack: error?.stack
    });
    return { success: false, error: error?.message || 'Toggle failed' };
  }
};

export const deleteProjectAsset = async (
  assetId: string,
  storagePath?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (storagePath) {
      await supabase.storage
        .from('project-files')
        .remove([storagePath]);
    }

    const { error } = await (supabase as any)
      .from('project_assets')
      .delete()
      .eq('id', assetId);

    if (error) {
      await logError({
        errorType: 'storage',
        module: 'other',
        errorMessage: error.message || 'Failed to delete asset',
        callLocation: 'deleteProjectAsset — projectAssetsService',
        userAction: 'delete_project_asset',
        pipelineStep: 'storage_delete',
        componentName: 'projectAssetsService',
        context: { assetId, storagePath }
      });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: any) {
    await logError({
      errorType: 'unknown',
      module: 'other',
      errorMessage: error?.message || 'Unknown error in deleteProjectAsset',
      callLocation: 'deleteProjectAsset — projectAssetsService',
      userAction: 'delete_project_asset',
      pipelineStep: 'delete_project_asset',
      componentName: 'projectAssetsService',
      context: { assetId, storagePath },
      errorStack: error?.stack
    });
    return { success: false, error: error?.message || 'Delete failed' };
  }
};

// Get assets formatted for AI context injection
export const getAssetsForAIContext = async (
  brandId: string
): Promise<string> => {
  const assets = await getProjectAssets(brandId);
  if (assets.length === 0) return '';

  const contextParts = assets
    .filter(a => a.content_text || a.name)
    .map(a => {
      if (a.content_text) {
        return `[${a.name}]: ${a.content_text.slice(0, 500)}`;
      }
      return `[${a.name}]: ${a.file_type} file uploaded by founder`;
    });

  return contextParts.length > 0
    ? `\n\nPROJECT FILES:\n${contextParts.join('\n\n')}` 
    : '';
};

const getFileType = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  return 'other';
};

// Get all product images for a brand
export async function getBrandProductImages(brandId: string) {
  const { data } = await (supabase as any)
    .from('project_assets')
    .select('*')
    .eq('brand_id', brandId)
    .eq('source', 'product_image')
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Upload and save a product image
export async function uploadBrandProductImage(
  brandId: string,
  file: File
): Promise<{ success: boolean; asset?: ProjectAsset; error?: string }> {
  // Get userId from auth session to ensure RLS compliance
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return { success: false, error: 'Not authenticated' };
  }
  const userId = user.id;
  const storagePath = `${userId}/${brandId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;

  try {
    // Upload to product-images bucket
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(storagePath, file, { upsert: false });

    if (error) {
      await logError({
        userId,
        errorType: 'storage',
        module: 'prostudio',
        errorMessage: error.message || 'Storage upload failed',
        callLocation: 'uploadBrandProductImage — projectAssetsService',
        userAction: 'upload_product_image',
        pipelineStep: 'storage_upload',
        componentName: 'projectAssetsService',
        context: { storagePath, brandId, userId }
      });
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    // Check if this brand has any existing product images
    const { data: existingImages } = await (supabase as any)
      .from('project_assets')
      .select('id')
      .eq('brand_id', brandId)
      .eq('source', 'product_image')
      .limit(1);

    const isFirstProductImage = !existingImages || existingImages.length === 0;

    // Build insert object with only columns that exist on project_assets
    const insertObject = {
      brand_id: brandId,
      user_id: userId,
      name: file.name,
      file_type: 'image',
      source: 'product_image',
      file_url: publicUrl,
      storage_path: storagePath,
      is_primary: isFirstProductImage
    };

    // Insert into project_assets
    const { data: assetData, error: insertError } = await (supabase as any)
      .from('project_assets')
      .insert(insertObject)
      .select()
      .single();

    if (insertError) {
      await logError({
        userId,
        errorType: 'database',
        module: 'prostudio',
        errorMessage: insertError.message || 'Database insert failed',
        callLocation: 'uploadBrandProductImage — projectAssetsService',
        userAction: 'upload_product_image',
        pipelineStep: 'db_insert',
        componentName: 'projectAssetsService',
        context: { insertObject, brandId, userId, storagePath }
      });
      // If DB insert fails, clean up the uploaded file
      await supabase.storage.from('product-images').remove([storagePath]);
      return { success: false, error: insertError.message };
    }

    return { success: true, asset: assetData };
  } catch (error: any) {
    await logError({
      userId,
      errorType: 'unknown',
      module: 'prostudio',
      errorMessage: error?.message || 'Unknown error in uploadBrandProductImage',
      callLocation: 'uploadBrandProductImage — projectAssetsService',
      userAction: 'upload_product_image',
      pipelineStep: 'upload_product_image',
      componentName: 'projectAssetsService',
      context: { storagePath, brandId, userId, fileName: file.name },
      errorStack: error?.stack
    });
    return { success: false, error: error?.message || 'Upload failed' };
  }
}

// Set a product image as primary
export async function setPrimaryProductImage(brandId: string, imageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Set is_primary = false on all product images for this brand
    const { error: updateError1 } = await (supabase as any)
      .from('project_assets')
      .update({ is_primary: false })
      .eq('brand_id', brandId)
      .eq('source', 'product_image');

    if (updateError1) throw updateError1;

    // Set is_primary = true on the selected image
    const { error: updateError2 } = await (supabase as any)
      .from('project_assets')
      .update({ is_primary: true })
      .eq('id', imageId);

    if (updateError2) throw updateError2;

    return { success: true };
  } catch (error: any) {
    await logError({
      errorType: 'database',
      module: 'prostudio',
      errorMessage: error?.message || 'Failed to set primary product image',
      callLocation: 'setPrimaryProductImage — projectAssetsService',
      userAction: 'set_primary_product_image',
      pipelineStep: 'db_update',
      componentName: 'projectAssetsService',
      context: { brandId, imageId }
    });
    return { success: false, error: error?.message };
  }
}

// Delete a product image
export async function deleteBrandProductImage(imageId: string, storagePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from storage
    if (storagePath) {
      await supabase.storage.from('product-images').remove([storagePath]);
    }

    // Delete from database
    const { error } = await (supabase as any)
      .from('project_assets')
      .delete()
      .eq('id', imageId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    await logError({
      errorType: 'storage',
      module: 'prostudio',
      errorMessage: error?.message || 'Failed to delete product image',
      callLocation: 'deleteBrandProductImage — projectAssetsService',
      userAction: 'delete_product_image',
      pipelineStep: 'storage_delete',
      componentName: 'projectAssetsService',
      context: { imageId, storagePath }
    });
    return { success: false, error: error?.message };
  }
}
