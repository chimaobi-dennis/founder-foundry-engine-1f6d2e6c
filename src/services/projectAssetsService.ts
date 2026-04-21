import { supabase } from '@/integrations/supabase/client';

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
  userId: string,
  brandId: string,
  file: File,
  stageKey?: string,
  description?: string
): Promise<{ success: boolean; asset?: ProjectAsset; error?: string }> => {
  const filename = `${userId}/${brandId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;

  const { error: uploadError } = await supabase.storage
    .from('project-files')
    .upload(filename, file);

  if (uploadError) return { success: false, error: uploadError.message };

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

  if (error) return { success: false, error: error.message };
  return { success: true, asset: data };
};

export const saveAIGeneratedAsset = async (
  userId: string,
  brandId: string,
  name: string,
  contentText: string,
  stageKey?: string,
  messageId?: string
): Promise<{ success: boolean; asset?: ProjectAsset; error?: string }> => {
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

  if (error) return { success: false, error: error.message };
  return { success: true, asset: data };
};

export const togglePinAsset = async (
  assetId: string,
  isPinned: boolean
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('project_assets')
    .update({ is_pinned: isPinned })
    .eq('id', assetId);
  return { success: !error, error: error?.message };
};

export const deleteProjectAsset = async (
  assetId: string,
  storagePath?: string
): Promise<{ success: boolean; error?: string }> => {
  if (storagePath) {
    await supabase.storage
      .from('project-files')
      .remove([storagePath]);
  }

  const { error } = await (supabase as any)
    .from('project_assets')
    .delete()
    .eq('id', assetId);

  return { success: !error, error: error?.message };
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
