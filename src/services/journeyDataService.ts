import { supabase } from '@/integrations/supabase/client';
import { createMilestone } from './mentorService';

export interface SubstageWithData {
  index: number;
  label: string;           // from journey_stages.substages array
  fieldKey: string;        // from journey_stage_fields.field_key
  fieldLabel: string;      // from journey_stage_fields.field_label
  fieldDescription: string | null;
  value: string | null;    // from brand_stage_data
  isComplete: boolean;     // true only if value exists and is non-empty
}

export interface StageField {
  id: string;
  stage_key: string;
  field_key: string;
  field_label: string;
  field_description: string | null;
  field_type: 'text' | 'textarea' | 'tags' | 'choice';
  is_required: boolean;
  sort_order: number;
  maps_to_dna_field: string | null;
}

export interface StageFieldValue {
  brand_id: string;
  stage_key: string;
  field_key: string;
  value: string | null;
  captured_from_message_id: string | null;
}

// Get all field definitions for a stage
export const getStageFields = async (
  stageKey: string
): Promise<StageField[]> => {
  const { data } = await (supabase as any)
    .from('journey_stage_fields')
    .select('*')
    .eq('stage_key', stageKey)
    .order('sort_order');
  return data ?? [];
};

// Get substages with their actual data for a brand and stage
export const getSubstagesWithData = async (
  brandId: string,
  stageKey: string,
  substageLabels: string[]
): Promise<SubstageWithData[]> => {
  // Get field definitions ordered by substage_index
  const { data: fields } = await (supabase as any)
    .from('journey_stage_fields')
    .select('*')
    .eq('stage_key', stageKey)
    .order('substage_index');

  if (!fields || fields.length === 0) return [];

  // Get captured data for this brand and stage
  const { data: captured } = await (supabase as any)
    .from('brand_stage_data')
    .select('field_key, value')
    .eq('brand_id', brandId)
    .eq('stage_key', stageKey);

  const capturedMap: Record<string, string> = {};
  (captured ?? []).forEach((row: any) => {
    if (row.value) capturedMap[row.field_key] = row.value;
  });

  // Combine field definitions with captured data
  return fields.map((field: any, index: number) => ({
    index: field.substage_index ?? index,
    label: substageLabels[field.substage_index ?? index] ?? field.field_label,
    fieldKey: field.field_key,
    fieldLabel: field.field_label,
    fieldDescription: field.field_description,
    value: capturedMap[field.field_key] ?? null,
    isComplete: !!(capturedMap[field.field_key]?.trim())
  }));
};

// Get all field definitions for all stages at once
export const getAllStageFields = async (): Promise<Record<string, StageField[]>> => {
  const { data } = await (supabase as any)
    .from('journey_stage_fields')
    .select('*')
    .order('sort_order');

  const grouped: Record<string, StageField[]> = {};
  (data ?? []).forEach((field: StageField) => {
    if (!grouped[field.stage_key]) grouped[field.stage_key] = [];
    grouped[field.stage_key].push(field);
  });

  return grouped;
};

// Get all captured data for a brand
export const getBrandStageData = async (
  brandId: string
): Promise<Record<string, Record<string, string>>> => {
  const { data } = await (supabase as any)
    .from('brand_stage_data')
    .select('*')
    .eq('brand_id', brandId);

  // Structure as { stage_key: { field_key: value } }
  const structured: Record<string, Record<string, string>> = {};
  (data ?? []).forEach((row: StageFieldValue) => {
    if (!structured[row.stage_key]) structured[row.stage_key] = {};
    if (row.value) structured[row.stage_key][row.field_key] = row.value;
  });

  return structured;
};

// Save a single field value
export const saveStageField = async (
  brandId: string,
  stageKey: string,
  fieldKey: string,
  value: string,
  messageId?: string,
  // Pass these for auto milestone creation
  conversationId?: string,
  fieldLabel?: string,
  category?: string
): Promise<{ success: boolean; isNewField: boolean; error?: string }> => {
  // Check if field already had a value
  const { data: existing } = await (supabase as any)
    .from('brand_stage_data')
    .select('value')
    .eq('brand_id', brandId)
    .eq('stage_key', stageKey)
    .eq('field_key', fieldKey)
    .single();

  const isNewField = !existing?.value;

  const { error } = await (supabase as any)
    .from('brand_stage_data')
    .upsert({
      brand_id: brandId,
      stage_key: stageKey,
      field_key: fieldKey,
      value,
      captured_from_message_id: messageId ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'brand_id,stage_key,field_key' });

  if (error) return { success: false, isNewField: false, error: error.message };

  // Auto-create milestone when field is saved for the first time
  if (isNewField && conversationId && fieldLabel && category) {
    try {
      await createMilestone(
        brandId,
        conversationId,
        fieldLabel,
        category,
        messageId,
        stageKey // passed as context = stage_key
      );
    } catch (milestoneError) {
      // Don't fail the save if milestone creation fails
      console.error('Failed to create milestone:', milestoneError);
    }
  }

  return { success: true, isNewField };
};

// Save multiple fields at once
export const saveMultipleStageFields = async (
  brandId: string,
  stageKey: string,
  fields: Record<string, string>,
  messageId?: string
): Promise<{ success: boolean; error?: string }> => {
  const rows = Object.entries(fields).map(([fieldKey, value]) => ({
    brand_id: brandId,
    stage_key: stageKey,
    field_key: fieldKey,
    value,
    captured_from_message_id: messageId ?? null,
    updated_at: new Date().toISOString()
  }));

  const { error } = await (supabase as any)
    .from('brand_stage_data')
    .upsert(rows, { onConflict: 'brand_id,stage_key,field_key' });

  return { success: !error, error: error?.message };
};

// Get completion percentage for a stage
export const getStageCompletion = (
  stageKey: string,
  stageFields: StageField[],
  capturedData: Record<string, Record<string, string>>
): number => {
  const fields = stageFields.filter(f => f.stage_key === stageKey);
  if (fields.length === 0) return 0;

  const captured = capturedData[stageKey] ?? {};
  const filledCount = fields.filter(
    f => captured[f.field_key] && captured[f.field_key].trim().length > 0
  ).length;

  return Math.round((filledCount / fields.length) * 100);
};

// ─── Substages with captured data ────────────────────────────────────────
// A substage is the read-only display label for a stage step. Each substage
// is paired (by index/sort_order) with a journey_stage_field. When that
// field has a value in brand_stage_data, the substage is considered complete.
// Substages are NEVER manually checkable — completion is derived from data.

export interface SubstageWithData {
  /** Substage label as defined on journey_stages.substages */
  label: string;
  /** Index in the substages array */
  index: number;
  /** The matched journey_stage_field key (if any) */
  fieldKey: string | null;
  /** The matched field's prompt/description text */
  fieldDescription: string | null;
  /** The captured value from brand_stage_data, or null when not yet captured */
  value: string | null;
  /** True when value is a non-empty string */
  isComplete: boolean;
}

export const getSubstagesWithData = async (
  brandId: string,
  stageKey: string,
  substages: string[]
): Promise<SubstageWithData[]> => {
  if (!substages || substages.length === 0) return [];

  // Fetch field definitions and captured values in parallel
  const [fieldsRes, dataRes] = await Promise.all([
    (supabase as any)
      .from('journey_stage_fields')
      .select('*')
      .eq('stage_key', stageKey)
      .order('sort_order'),
    (supabase as any)
      .from('brand_stage_data')
      .select('field_key, value')
      .eq('brand_id', brandId)
      .eq('stage_key', stageKey)
  ]);

  const fields: StageField[] = fieldsRes.data ?? [];
  const captured: Record<string, string> = {};
  (dataRes.data ?? []).forEach((row: { field_key: string; value: string | null }) => {
    if (row.value) captured[row.field_key] = row.value;
  });

  // Pair each substage with its field by positional index (sort_order)
  return substages.map((label, index) => {
    const field = fields[index] ?? null;
    const value = field ? (captured[field.field_key] ?? null) : null;
    return {
      label,
      index,
      fieldKey: field?.field_key ?? null,
      fieldDescription: field?.field_description ?? null,
      value: value && value.trim().length > 0 ? value : null,
      isComplete: !!(value && value.trim().length > 0)
    };
  });
};

// Sync brand_dna fields from stage data
// When a stage field maps to a DNA field keep them in sync
export const syncToBrandDNA = async (
  brandId: string,
  stageKey: string,
  fieldKey: string,
  value: string,
  dnaMappings: Record<string, string>
): Promise<void> => {
  const dnaField = dnaMappings[`${stageKey}.${fieldKey}`];
  if (!dnaField) return;

  await (supabase as any)
    .from('brand_dna')
    .upsert({
      brand_id: brandId,
      [dnaField]: value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'brand_id' });
};
