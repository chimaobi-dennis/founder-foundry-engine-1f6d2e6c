import { supabase } from '@/integrations/supabase/client';
import { callAI } from './aiService';
import { saveMultipleStageFields } from './journeyDataService';
import { updateProjectName, updateJourneyStage, getAllJourneyStages } from './brandService';
import { uploadProjectFile } from './projectAssetsService';
import { logError } from './errorService';

export interface OnboardingContext {
  text?: string;
  websiteUrl?: string;
  file?: File;
  declaredStage: string;
}

export interface ExtractedProjectData {
  suggestedName?: string;
  detectedStage?: string;
  fields: Record<string, Record<string, string>>;
  // { stage_key: { field_key: value } }
  confidence: 'high' | 'medium' | 'low';
  summary: string;
}

// Fetch website content for extraction
export const fetchWebsiteContent = async (
  url: string
): Promise<string | null> => {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const response = await fetch(
      `https://r.jina.ai/${fullUrl}`,
      { headers: { Accept: 'text/plain' } }
    );
    
    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, 8000); // limit to 8k chars
  } catch {
    return null;
  }
};

// Extract and read file content
export const readFileContent = async (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content?.slice(0, 8000) ?? null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
};

// Main extraction function
export const extractProjectContext = async (
  userId: string,
  context: OnboardingContext
): Promise<ExtractedProjectData | null> => {
  let contentToProcess = '';

  // Gather content from all sources
  if (context.text) {
    contentToProcess += `\n\nFOUNDER PROVIDED TEXT:\n${context.text}`;
  }

  if (context.websiteUrl) {
    const webContent = await fetchWebsiteContent(context.websiteUrl);
    if (webContent) {
      contentToProcess += `\n\nWEBSITE CONTENT (${context.websiteUrl}):\n${webContent}`;
    }
  }

  if (context.file) {
    const fileContent = await readFileContent(context.file);
    if (fileContent) {
      contentToProcess += `\n\nUPLOADED DOCUMENT (${context.file.name}):\n${fileContent}`;
    }
  }

  if (!contentToProcess.trim()) return null;

  // Fetch stages dynamically from database
  const stages = await getAllJourneyStages();
  const stageKeys = stages.map(s => s.stage_key).join('|');
  
  // Build dynamic prompt structure based on actual stages
  const fieldsStructure = stages.map(stage => 
    `    "${stage.stage_key}": {
      // Field keys for ${stage.name} stage
      // Include any extracted values as "field_key": "value or null"
    }`
  ).join(',\n');

  const extractionPrompt = `You are extracting structured product and brand data from a founder's existing work. 

The founder says they are in the "${context.declaredStage}" stage of their journey.

Analyze the content provided and extract as much structured data as possible. Return ONLY a valid JSON object with this exact structure:

{
  "suggested_name": "3 word project title or null",
  "detected_stage": "${stageKeys}",
  "confidence": "high|medium|low",
  "summary": "2 sentence summary of what this founder is building",
  "fields": {
${fieldsStructure}
  }
}

Only include fields where you found clear, specific information. Use null for anything not mentioned or unclear. Do not invent or assume information that is not in the content. Return only the JSON object, no explanation.`;

  const result = await callAI({
    taskType: 'mentor_chat',
    userId,
    systemPrompt: extractionPrompt,
    messages: [
      {
        role: 'user',
        content: contentToProcess
      }
    ],
    maxTokens: 2000
  });

  if (!result.success || !result.text) return null;

  try {
    const clean = result.text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    const parsed = JSON.parse(clean);
    
    // Filter out null values from fields
    const cleanedFields: Record<string, Record<string, string>> = {};
    Object.entries(parsed.fields ?? {}).forEach(([stageKey, stageFields]) => {
      const nonNull: Record<string, string> = {};
      Object.entries(stageFields as Record<string, string | null>).forEach(
        ([fieldKey, value]) => {
          if (value && value.trim()) nonNull[fieldKey] = value;
        }
      );
      if (Object.keys(nonNull).length > 0) {
        cleanedFields[stageKey] = nonNull;
      }
    });

    return {
      suggestedName: parsed.suggested_name ?? null,
      detectedStage: parsed.detected_stage ?? context.declaredStage,
      fields: cleanedFields,
      confidence: parsed.confidence ?? 'medium',
      summary: parsed.summary ?? ''
    };
  } catch (e) {
    console.error('Failed to parse extraction response:', e);
    await logError({
      userId,
      errorType: 'ai_call',
      module: 'mentor',
      errorMessage: 'Failed to parse project context extraction',
      context: { rawResponse: result.text?.slice(0, 200) }
    });
    return null;
  }
};

// Save extracted data to the database
export const saveExtractedContext = async (
  userId: string,
  brandId: string,
  extracted: ExtractedProjectData,
  file?: File
): Promise<{ fieldsCount: number; error?: string }> => {
  // Fetch stages dynamically for brand DNA mapping
  const stages = await getAllJourneyStages();
  let totalSaved = 0;

  // Save name if extracted
  if (extracted.suggestedName) {
    await updateProjectName(brandId, extracted.suggestedName);
  }

  // Update stage if detected
  if (extracted.detectedStage) {
    await updateJourneyStage(brandId, extracted.detectedStage, 'auto_detected');
  }

  // Save all extracted fields
  for (const [stageKey, fields] of Object.entries(extracted.fields)) {
    if (Object.keys(fields).length === 0) continue;

    const { success } = await saveMultipleStageFields(
      brandId,
      stageKey,
      fields
    );

    if (success) {
      totalSaved += Object.keys(fields).length;
    }
  }

  // Save brand DNA fields that map from stage data
  // Find a stage that has brand-related fields (typically has brand in the name or key)
  const brandStageKey = stages.find(s => 
    s.stage_key.toLowerCase().includes('brand') || 
    s.name.toLowerCase().includes('brand')
  )?.stage_key;
  
  if (brandStageKey) {
    const brandFields = extracted.fields[brandStageKey] ?? {};
    if (brandFields.brand_name) {
      await (supabase as any)
        .from('brand_dna')
        .upsert({ brand_id: brandId, brand_voice: brandFields.brand_voice }, { onConflict: 'brand_id' });
    }
  }

  // Note: project asset saving (file/URL/text) is handled by the caller
  // in ProjectOnboarding.handleConfirmSave so the per-source metadata
  // (source="upload", content_text, file_url) can be applied correctly.

  // Mark onboarding as complete
  await (supabase as any)
    .from('brands')
    .update({
      onboarding_completed: true,
      context_source: file ? 'document_upload' : 'text_paste',
      updated_at: new Date().toISOString()
    })
    .eq('id', brandId);

  return { fieldsCount: totalSaved };
};

// Mark fresh start (no prior context)
export const markFreshStart = async (brandId: string): Promise<void> => {
  await (supabase as any)
    .from('brands')
    .update({
      onboarding_completed: true,
      context_source: 'fresh_start',
      updated_at: new Date().toISOString()
    })
    .eq('id', brandId);
};
