import { supabase } from '@/integrations/supabase/client';
import { logError } from './errorService';
import jsPDF from 'jspdf';

const db = supabase as any;

// ─── Types ─────────────────────────────────────────────────────

export interface BrandDNA {
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

export interface Brand {
  id: string;
  name: string;
  primary_color?: string;
  secondary_color?: string;
  journey_stage?: string;
  completeness_score?: number;
  product_type?: string;
}

export interface StageField {
  field_key: string;
  label: string;
  value: string | null;
  description?: string | null;
  maps_to_dna_field?: string | null;
}

export interface StageMeta {
  stage_key: string;
  name: string;
  emoji: string;
  description: string;
  mentor_focus?: string | null;
}

export interface StageData {
  stageKey: string;
  fields: StageField[];
  completion: number;
  stageMeta: StageMeta;
}

export interface FullBrandProfile {
  brand: Brand;
  dna: BrandDNA | null;
  stageData: Record<string, StageData>;
  milestoneCountByStage: Record<string, number>;
}

// ─── Get Full Brand Profile ────────────────────────────────────

export async function getFullBrandProfile(brandId: string): Promise<FullBrandProfile> {
  try {
    console.log('[getFullBrandProfile] Fetching profile for brand:', brandId);

    // 1. Fetch brand data
    const { data: brand, error: brandError } = await db
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    if (brandError) {
      console.error('[getFullBrandProfile] Failed to fetch brand:', brandError);
      throw brandError;
    }

    // 2. Fetch brand DNA
    const { data: dna, error: dnaError } = await db
      .from('brand_dna')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle();

    if (dnaError) {
      console.error('[getFullBrandProfile] Failed to fetch brand DNA:', dnaError);
      throw dnaError;
    }

    // 3. Fetch all active journey stages ordered by sort_order
    const { data: stages, error: stagesError } = await db
      .from('journey_stages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (stagesError) {
      console.error('[getFullBrandProfile] Failed to fetch journey stages:', stagesError);
      throw stagesError;
    }

    // 4. Fetch all field definitions for active stages
    const activeStageKeys = stages?.map(s => s.stage_key) || [];
    const { data: stageFields, error: stageFieldsError } = await db
      .from('journey_stage_fields')
      .select('*')
      .in('stage_key', activeStageKeys)
      .order('stage_key', { ascending: true })
      .order('sort_order', { ascending: true });

    if (stageFieldsError) {
      console.error('[getFullBrandProfile] Failed to fetch stage fields:', stageFieldsError);
      throw stageFieldsError;
    }

    // 5. Fetch all captured values for this brand
    const { data: stageDataRows, error: stageDataError } = await db
      .from('brand_stage_data')
      .select('*')
      .eq('brand_id', brandId);

    if (stageDataError) {
      console.error('[getFullBrandProfile] Failed to fetch stage data:', stageDataError);
      throw stageDataError;
    }

    // 6. Fetch stage completion
    const { data: stageProgress, error: progressError } = await db
      .from('brand_stage_progress')
      .select('*')
      .eq('brand_id', brandId);

    if (progressError) {
      console.error('[getFullBrandProfile] Failed to fetch stage progress:', progressError);
      throw progressError;
    }

    // 7. Fetch milestones
    const { data: milestones, error: milestonesError } = await db
      .from('milestones')
      .select('*')
      .eq('brand_id', brandId);

    if (milestonesError) {
      console.error('[getFullBrandProfile] Failed to fetch milestones:', milestonesError);
      throw milestonesError;
    }

    // 8. Assemble stage data dynamically based on database configuration
    const stageDataMap: Record<string, StageData> = {};

    stages?.forEach(stage => {
      const stageKey = stage.stage_key;
      
      // Get field definitions for this stage
      const fieldsForStage = stageFields
        ?.filter(f => f.stage_key === stageKey)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) || [];
      
      // Map fields with their values
      const fields: StageField[] = fieldsForStage.map(field => {
        const capturedValue = stageDataRows?.find(
          d => d.stage_key === stageKey && d.field_key === field.field_key
        );
        return {
          field_key: field.field_key,
          label: field.field_label,
          value: capturedValue?.value ?? null,
          description: field.field_description,
          maps_to_dna_field: field.maps_to_dna_field,
        };
      });

      // Get completion percentage from progress table
      const stageProgressRow = stageProgress?.find(p => p.stage_key === stageKey);
      const completion = stageProgressRow?.is_completed ? 100 : 0;

      stageDataMap[stageKey] = {
        stageKey,
        fields,
        completion,
        stageMeta: {
          stage_key: stage.stage_key,
          name: stage.name,
          emoji: stage.emoji,
          description: stage.description,
          mentor_focus: stage.mentor_focus,
        },
      };
    });

    // 9. Count milestones by stage
    const milestoneCountByStage: Record<string, number> = {};
    stages?.forEach(stage => {
      milestoneCountByStage[stage.stage_key] = milestones?.filter(m => m.stage_key === stage.stage_key).length || 0;
    });

    const profile: FullBrandProfile = {
      brand,
      dna,
      stageData: stageDataMap,
      milestoneCountByStage,
    };

    console.log('[getFullBrandProfile] Profile fetched successfully');
    return profile;
  } catch (error: any) {
    console.error('[getFullBrandProfile] Error:', error);
    await logError({
      errorMessage: error.message || 'Failed to fetch full brand profile',
      errorType: 'database',
      module: 'brand_dna',
      componentName: 'brandDNAService',
      callLocation: 'getFullBrandProfile',
      userAction: 'view_brand_profile',
      pipelineStep: 'fetch_database',
      context: { brandId }
    });
    throw error;
  }
}

// ─── Export Brand DNA as PDF ───────────────────────────────────

export async function exportBrandDNAAsPDF(brandId: string): Promise<Blob> {
  try {
    console.log('[exportBrandDNAAsPDF] Generating PDF for brand:', brandId);

    const profile = await getFullBrandProfile(brandId);
    const doc = new jsPDF();
    
    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;
    const leftMargin = 20;
    const contentWidth = doc.internal.pageSize.width - (leftMargin * 2);

    // Helper function to add section header
    const addSectionHeader = (title: string) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, leftMargin, yPos);
      yPos += 10;
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);
      yPos += 8;
    };

    // Helper function to add field
    const addField = (label: string, value: string | null | undefined) => {
      if (!value) return;
      
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, leftMargin, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Handle long text wrapping
      const lines = doc.splitTextToSize(String(value), contentWidth - 10);
      doc.text(lines, leftMargin + 10, yPos);
      yPos += (lines.length * 5) + 4;
    };

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Brand DNA Profile', leftMargin, yPos);
    yPos += 15;

    // Brand Identity Section
    addSectionHeader('Brand Identity');
    addField('Brand Name', profile.brand.name);
    addField('Product Type', profile.brand.product_type);
    addField('Journey Stage', profile.brand.journey_stage);
    addField('Completeness Score', profile.brand.completeness_score?.toString());

    if (profile.dna) {
      addSectionHeader('Brand DNA');
      addField('Brand Voice', profile.dna.brand_voice);
      addField('Tone Descriptors', profile.dna.tone_descriptors?.join(', '));
      addField('Positioning Statement', profile.dna.positioning_statement);
      addField('Core Promise', profile.dna.core_promise);
      addField('Target Audience', profile.dna.target_audience);
      addField('Customer Profile', profile.dna.customer_profile);
      addField('Pain Points', profile.dna.pain_points);
      addField('Why Choose Us', profile.dna.why_choose_us);
      addField('Brand Feel', profile.dna.brand_feel?.join(', '));
      addField('Campaign Strategy', profile.dna.campaign_strategy);
      addField('Customer Insight', profile.dna.customer_insight);
      addField('Product Positioning', profile.dna.product_positioning);
      addField('Brand References', profile.dna.brand_references);
    }

    // Stage sections - dynamic based on database configuration
    Object.keys(profile.stageData).forEach(stageKey => {
      const stage = profile.stageData[stageKey];
      if (!stage || stage.fields.length === 0) return;

      addSectionHeader(stage.stageMeta.name);
      
      stage.fields.forEach(field => {
        if (field.value) {
          addField(field.label, field.value);
        }
      });
    });

    console.log('[exportBrandDNAAsPDF] PDF generated successfully');
    return doc.output('blob');
  } catch (error: any) {
    console.error('[exportBrandDNAAsPDF] Error:', error);
    await logError({
      errorMessage: error.message || 'Failed to export brand DNA as PDF',
      errorType: 'unknown',
      module: 'brand_dna',
      componentName: 'brandDNAService',
      callLocation: 'exportBrandDNAAsPDF',
      userAction: 'export_pdf',
      pipelineStep: 'generate_pdf',
      context: { brandId }
    });
    throw error;
  }
}
