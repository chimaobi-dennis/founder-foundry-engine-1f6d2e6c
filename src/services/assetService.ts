import { supabase } from '@/integrations/supabase/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { logError } from './errorService';

const db = supabase as any;

const STORAGE_BUCKET = 'template-outputs';

// ─── Types and interfaces ─────────────────────────────────────

export type SaveFormat = 'png' | 'jpeg' | 'pdf';

export type AssetFilter = 'all' | 'images' | 'templates' | 'documents' | 'scripts' | 'product_images';

export interface SaveToLibraryParams {
  brandId: string;
  userId: string;
  name: string;
  sourceModule: 'prostudio' | 'contentstudio';
  visualHtml: string;
  format: SaveFormat;
  platformWidth: number;
  platformHeight: number;
  platformSlug?: string;
  templateId?: string;
  briefId?: string;
  creativeId?: string;
  templateOutputId?: string;
  generationParams?: Record<string, unknown>;
}

export interface Asset {
  id: string;
  name: string;
  brand_id: string;
  user_id: string;
  source_module: string;
  type: string;
  file_url: string;
  file_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  platform: string | null;
  template_id: string | null;
  is_trashed: boolean;
  created_at: string;
  has_studio_session?: boolean;
}

export interface StudioSession {
  id: string;
  asset_id: string;
  brand_id: string;
  user_id: string;
  source_module: string;
  visual_html: string;
  platform_slug: string | null;
  platform_width: number | null;
  platform_height: number | null;
  template_id: string | null;
  brief_id: string | null;
  creative_id: string | null;
  template_output_id: string | null;
  generation_params: Record<string, unknown> | null;
  created_at: string;
}

export interface AssetCounts {
  total: number;
  productImages: number;
  images: number;
  documents: number;
  scripts: number;
}

// ─── Helper functions ─────────────────────────────────────

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ─── Save to Library ─────────────────────────────────────

export async function saveToLibrary(params: SaveToLibraryParams): Promise<Asset | null> {
  try {
    const {
      brandId,
      userId,
      name,
      sourceModule,
      visualHtml,
      format,
      platformWidth,
      platformHeight,
      platformSlug,
      templateId,
      briefId,
      creativeId,
      templateOutputId,
      generationParams,
    } = params;

    console.log('[assetService.saveToLibrary] Starting save with params:', {
      brandId,
      userId,
      name,
      sourceModule,
      format,
      platformWidth,
      platformHeight,
    });

    // Render HTML to canvas
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${platformWidth}px`;
    container.style.height = `${platformHeight}px`;
    container.innerHTML = visualHtml;
    document.body.appendChild(container);

    let blob: Blob;
    let mimeType: string;
    let extension: string;

    try {
      console.log('[assetService.saveToLibrary] Rendering HTML to canvas...');
      if (format === 'pdf') {
        const canvas = await html2canvas(container, {
          width: platformWidth,
          height: platformHeight,
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const pdf = new jsPDF({
          orientation: platformWidth >= platformHeight ? 'l' : 'p',
          unit: 'px',
          format: [platformWidth, platformHeight],
        });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, platformWidth, platformHeight);
        
        const pdfData = pdf.output('arraybuffer');
        blob = new Blob([pdfData], { type: 'application/pdf' });
        mimeType = 'application/pdf';
        extension = 'pdf';
      } else {
        const canvas = await html2canvas(container, {
          width: platformWidth,
          height: platformHeight,
          scale: 2,
          useCORS: true,
          logging: false,
        });

        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to convert canvas to blob'));
          }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
        });
        mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        extension = format === 'jpeg' ? 'jpg' : 'png';
      }
      console.log('[assetService.saveToLibrary] Canvas rendered, blob size:', blob.size);
    } finally {
      document.body.removeChild(container);
    }

    // Upload to storage
    const timestamp = Date.now();
    const storagePath = `${userId}/${brandId}/${sourceModule}/${timestamp}.${extension}`;
    console.log('[assetService.saveToLibrary] Uploading to storage:', storagePath);
    
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, blob, { upsert: true, contentType: mimeType });
    
    if (uploadError) {
      console.error('[assetService.saveToLibrary] Storage upload failed:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    console.log('[assetService.saveToLibrary] Public URL:', publicUrl);

    // Insert into assets table
    console.log('[assetService.saveToLibrary] Inserting into assets table...');
    const { data: asset, error: assetError } = await db
      .from('assets')
      .insert({
        name,
        brand_id: brandId,
        user_id: userId,
        source_module: sourceModule,
        type: 'template_output',
        file_url: publicUrl,
        file_path: storagePath,
        mime_type: mimeType,
        width: platformWidth,
        height: platformHeight,
        platform: platformSlug || null,
        template_id: templateId || null,
        is_trashed: false,
      })
      .select()
      .single();

    if (assetError) {
      console.error('[assetService.saveToLibrary] Assets insert failed:', assetError);
      throw assetError;
    }
    console.log('[assetService.saveToLibrary] Asset created:', asset.id);

    // Insert into studio_sessions table
    console.log('[assetService.saveToLibrary] Inserting into studio_sessions table...');
    const { error: sessionError } = await db
      .from('studio_sessions')
      .insert({
        asset_id: asset.id,
        brand_id: brandId,
        user_id: userId,
        source_module: sourceModule,
        visual_html: visualHtml,
        platform_slug: platformSlug || null,
        platform_width: platformWidth,
        platform_height: platformHeight,
        template_id: templateId || null,
        brief_id: briefId || null,
        creative_id: creativeId || null,
        template_output_id: templateOutputId || null,
        generation_params: generationParams || null,
      });

    if (sessionError) {
      console.error('[assetService.saveToLibrary] Studio session insert failed:', sessionError);
      throw sessionError;
    }
    console.log('[assetService.saveToLibrary] Studio session created');

    return asset;
  } catch (error: any) {
    console.error('[assetService.saveToLibrary] Error:', error);
    await logError({
      errorMessage: error.message || 'Save to library failed',
      errorType: 'storage',
      module: 'prostudio',
      componentName: 'assetService',
      callLocation: 'saveToLibrary',
      userAction: 'save_to_library',
      pipelineStep: 'render_and_upload',
      context: { params }
    });
    return null;
  }
}

// ─── Get Library Assets ─────────────────────────────────────

export async function getLibraryAssets(
  brandId: string,
  filter: AssetFilter = 'all'
): Promise<Asset[]> {
  try {
    let query = db
      .from('assets')
      .select(`
        *,
        studio_sessions (id)
      `)
      .eq('brand_id', brandId)
      .eq('is_trashed', false)
      .order('created_at', { ascending: false });

    // Apply filter
    switch (filter) {
      case 'images':
        query = query.in('type', ['generated_visual', 'template_output']);
        break;
      case 'templates':
        query = query.in('source_module', ['prostudio', 'contentstudio']);
        break;
      case 'documents':
        query = query.eq('type', 'document');
        break;
      case 'scripts':
        query = query.eq('type', 'script');
        break;
      case 'product_images':
        query = query.eq('type', 'product_image');
        break;
      case 'all':
      default:
        // No filter
        break;
    }

    const { data, error } = await query;
    if (error) throw error;

    // Add has_studio_session flag
    return (data || []).map((asset: any) => ({
      ...asset,
      has_studio_session: !!asset.studio_sessions && asset.studio_sessions.length > 0,
    }));
  } catch (error: any) {
    await logError({
      errorMessage: error.message || 'Failed to fetch library assets',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'assetService',
      callLocation: 'getLibraryAssets',
      userAction: 'view_library',
      pipelineStep: 'fetch_assets',
      context: { brandId, filter }
    });
    return [];
  }
}

// ─── Get Studio Session ─────────────────────────────────────

export async function getStudioSession(assetId: string): Promise<StudioSession | null> {
  try {
    const { data, error } = await db
      .from('studio_sessions')
      .select('*')
      .eq('asset_id', assetId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Row not found
      throw error;
    }

    return data;
  } catch (error: any) {
    await logError({
      errorMessage: error.message || 'Failed to fetch studio session',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'assetService',
      callLocation: 'getStudioSession',
      userAction: 'open_in_studio',
      pipelineStep: 'fetch_session',
      context: { assetId }
    });
    return null;
  }
}

// ─── Trash Asset ─────────────────────────────────────────────

export async function trashAsset(assetId: string): Promise<void> {
  try {
    const { error } = await db
      .from('assets')
      .update({
        is_trashed: true,
        trashed_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    if (error) throw error;
  } catch (error: any) {
    await logError({
      errorMessage: error.message || 'Failed to trash asset',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'assetService',
      callLocation: 'trashAsset',
      userAction: 'trash_asset',
      pipelineStep: 'update_asset',
      context: { assetId }
    });
    throw error;
  }
}

// ─── Get Asset Counts ─────────────────────────────────────

export async function getAssetCounts(brandId: string): Promise<AssetCounts> {
  try {
    const { data: allData, error: allError } = await db
      .from('assets')
      .select('type')
      .eq('brand_id', brandId)
      .eq('is_trashed', false);

    if (allError) throw allError;

    const assets = allData || [];
    
    const counts: AssetCounts = {
      total: assets.length,
      productImages: assets.filter(a => a.type === 'product_image').length,
      images: assets.filter(a => a.type === 'generated_visual' || a.type === 'template_output').length,
      documents: assets.filter(a => a.type === 'document').length,
      scripts: assets.filter(a => a.type === 'script').length,
    };

    return counts;
  } catch (error: any) {
    await logError({
      errorMessage: error.message || 'Failed to fetch asset counts',
      errorType: 'database',
      module: 'prostudio',
      componentName: 'assetService',
      callLocation: 'getAssetCounts',
      userAction: 'view_library',
      pipelineStep: 'fetch_counts',
      context: { brandId }
    });
    return {
      total: 0,
      productImages: 0,
      images: 0,
      documents: 0,
      scripts: 0,
    };
  }
}
