import { supabase } from '@/integrations/supabase/client';
import { callAI, getSystemPrompt, injectPromptVariables } from './aiService';
import { saveMultipleStageFields } from './journeyDataService';
import { updateProjectName, updateJourneyStage, getAllJourneyStages } from './brandService';
import { uploadProjectFile } from './projectAssetsService';
import { logError } from './errorService';

const db = supabase as any;

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
  extractedFields?: Array<{ stage_key: string; field_key: string; value: string; is_ai_discovered: boolean }>;
  stageCount?: number;
  fieldCount?: number;
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
  try {
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

    // Fetch the system prompt for context_extraction
    const systemPrompt = await getSystemPrompt('context_extraction') || `
You are extracting structured product and brand data from a founder's existing work.

The founder says they are in the "{{declared_stage}}" stage of their journey.

Analyze the content provided and extract as much structured data as possible. Return ONLY a valid JSON object with this exact structure:

{
  "suggested_name": "3 word project title or null",
  "detected_stage": "stage_key",
  "confidence": "high|medium|low",
  "summary": "2 sentence summary of what this founder is building",
  "fields": [
    {
      "stage_key": "spark",
      "field_key": "problem_statement",
      "value": "extracted value or null",
      "is_ai_discovered": true
    }
  ]
}

{{field_guide}}

Only include fields where you found clear, specific information. Use null for anything not mentioned or unclear. Do not invent or assume information that is not in the content. Return only the JSON object, no explanation.
`;

    // Fetch all active journey stage fields from DB
    const { data: stageFields } = await db
      .from('journey_stage_fields')
      .select('stage_key, field_key, field_label, field_description')
      .order('stage_key, sort_order', { ascending: true });

    if (!stageFields || stageFields.length === 0) {
      await logError({
        userId,
        errorType: 'database',
        module: 'mentor',
        errorMessage: 'No journey stage fields found in database',
        context: { function: 'extractProjectContext' }
      });
      return null;
    }

    // Build the field guide string dynamically grouped by stage_key
    const fieldGuideMap = new Map<string, Array<{ key: string; label: string }>>();
    
    for (const field of stageFields) {
      if (!fieldGuideMap.has(field.stage_key)) {
        fieldGuideMap.set(field.stage_key, []);
      }
      fieldGuideMap.get(field.stage_key)!.push({
        key: field.field_key,
        label: field.field_label || field.field_description || field.field_key
      });
    }

    // Format field guide string
    const fieldGuideParts: string[] = [];
    for (const [stageKey, fields] of fieldGuideMap.entries()) {
      const fieldsText = fields
        .map(f => `- ${f.key}: ${f.label}`)
        .join('\n      ');
      fieldGuideParts.push(`[${stageKey.toUpperCase()}] STAGE (stage_key: ${stageKey}):\n      ${fieldsText}`);
    }
    
    const fieldGuideString = `FIELD GUIDE:\n${fieldGuideParts.join('\n\n')}`;

    // Inject field guide and other variables into the prompt
    const finalPrompt = injectPromptVariables(systemPrompt, {
      field_guide: fieldGuideString,
      declared_stage: context.declaredStage
    });
    console.log('Final prompt:', finalPrompt);
    const result = await callAI({
      taskType: 'system_ai',
      userId,
      systemPrompt: finalPrompt,
      messages: [
        {
          role: 'user',
          content: contentToProcess
        }
      ],
      maxTokens: 4000
    });
    console.log('AI result:', result);
    if (!result.success || !result.text) {
      await logError({
        userId,
        errorType: 'ai_call',
        module: 'mentor',
        errorMessage: 'AI extraction call failed',
        context: { error: result.error }
      });
      return null;
    }

    try {
      console.log('[extractProjectContext] Raw AI text:', result.text);
      
      // Strip any markdown fences if present
      let cleanText = result.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
      }
      
      console.log('[extractProjectContext] Cleaned text:', cleanText);
      
      // Parse the JSON
      const parsed = JSON.parse(cleanText);
      console.log('[extractProjectContext] Parsed result:', parsed);
      
      // Handle both array response and object with fields property
      let fieldsArray = [];
      let suggestedName = null;
      let detectedStage = null;
      let confidence = 'medium';
      let summary = '';
      
      if (Array.isArray(parsed)) {
        // AI returned array directly
        fieldsArray = parsed;
      } else if (parsed && typeof parsed === 'object') {
        // AI returned object with fields property
        fieldsArray = parsed.fields || [];
        suggestedName = parsed.suggested_name || null;
        detectedStage = parsed.detected_stage || null;
        confidence = parsed.confidence || 'medium';
        summary = parsed.summary || '';
      }
      
      console.log('[extractProjectContext] Fields array length:', fieldsArray.length);
      
      // Validate it is an array
      if (!Array.isArray(fieldsArray)) {
        throw new Error('AI extraction result is not an array');
      }
      
      // Filter out any items missing required fields
      const filteredFields = fieldsArray.filter(
        item => item.stage_key && item.field_key && item.value
      );
      
      console.log('[extractProjectContext] Filtered fields length:', filteredFields.length);
      
      // Build the cleaned fields object and extracted fields array
      const cleanedFields: Record<string, Record<string, string>> = {};
      const extractedFields: Array<{ stage_key: string; field_key: string; value: string; is_ai_discovered: boolean }> = [];
      
      for (const item of filteredFields) {
        if (!cleanedFields[item.stage_key]) {
          cleanedFields[item.stage_key] = {};
        }
        
        if (item.value && item.value.trim()) {
          cleanedFields[item.stage_key][item.field_key] = item.value;
          extractedFields.push({
            stage_key: item.stage_key,
            field_key: item.field_key,
            value: item.value,
            is_ai_discovered: item.is_ai_discovered ?? true
          });
        }
      }

      console.log('[extractProjectContext] Extracted fields count:', extractedFields.length);
      
      // Determine the most common stage from extracted fields
      const stageCounts = new Map<string, number>();
      for (const field of extractedFields) {
        stageCounts.set(field.stage_key, (stageCounts.get(field.stage_key) || 0) + 1);
      }
      
      let mostCommonStage = context.declaredStage;
      let maxCount = 0;
      for (const [stage, count] of stageCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonStage = stage;
        }
      }

      const stageCount = new Set(extractedFields.map(f => f.stage_key)).size;
      console.log('[extractProjectContext] Stage count:', stageCount, 'Field count:', extractedFields.length);

      return {
        suggestedName: suggestedName,
        detectedStage: detectedStage ?? mostCommonStage,
        fields: cleanedFields,
        confidence: confidence as 'high' | 'medium' | 'low',
        summary: summary,
        extractedFields,
        stageCount,
        fieldCount: extractedFields.length
      };
    } catch (e) {
      console.error('[extractProjectContext] Failed to parse extraction response:', e);
      await logError({
        userId,
        errorType: 'ai_call',
        module: 'mentor',
        errorMessage: 'Failed to parse project context extraction',
        context: { rawResponse: result.text?.slice(0, 200), error: e }
      });
      return null;
    }
  } catch (error: any) {
    await logError({
      userId,
      errorType: 'unknown',
      module: 'mentor',
      errorMessage: error.message || 'Unexpected error in extractProjectContext',
      context: { context }
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
  try {
    console.log('[saveContext] Called with brandId:', brandId);
    console.log('[saveContext] Extracted data:', extracted);
    console.log('[saveContext] Fields to save:', extracted.extractedFields?.length || 0);
    
    if (!brandId) {
      throw new Error('brandId is required but was undefined');
    }

    // Save name if extracted
    if (extracted.suggestedName) {
      console.log('[saveContext] Updating project name to:', extracted.suggestedName);
      await updateProjectName(brandId, extracted.suggestedName);
    }

    // Update stage if detected
    if (extracted.detectedStage) {
      console.log('[saveContext] Updating journey stage to:', extracted.detectedStage);
      await updateJourneyStage(brandId, extracted.detectedStage, 'auto_detected');
    }

    // Save extracted fields directly to brand_stage_data with is_ai_discovered
    if (extracted.extractedFields && extracted.extractedFields.length > 0) {
      console.log('[saveContext] Starting upsert of', extracted.extractedFields.length, 'fields');
      
      const upsertPromises = extracted.extractedFields.map(async (field) => {
        console.log('[saveContext] Upserting field:', field.stage_key, field.field_key, 'value:', field.value);
        
        const { error } = await db
          .from('brand_stage_data')
          .upsert({
            brand_id: brandId,
            stage_key: field.stage_key,
            field_key: field.field_key,
            value: field.value,
            is_ai_discovered: field.is_ai_discovered ?? false,
            status: 'captured',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'brand_id,stage_key,field_key',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error('[saveContext] Upsert error for field:', field.stage_key, field.field_key, error);
          throw error;
        }
      });
      
      await Promise.all(upsertPromises);
      console.log('[saveContext] All upserts completed successfully');
    } else {
      console.log('[saveContext] No extracted fields to save');
    }

    // Determine context source
    let contextSource: 'url' | 'text' | 'document' | 'fresh_start' = 'text';
    if (extracted.extractedFields && extracted.extractedFields.length > 0) {
      contextSource = file ? 'document' : 'text';
    } else {
      contextSource = 'fresh_start';
    }

    console.log('[saveContext] Context source:', contextSource);

    // Mark onboarding as complete and update brands table
    const { error: brandUpdateError } = await db
      .from('brands')
      .update({
        onboarding_completed: true,
        context_source: contextSource,
        journey_stage: extracted.detectedStage || 'spark',
        updated_at: new Date().toISOString()
      })
      .eq('id', brandId);
    
    if (brandUpdateError) {
      console.error('[saveContext] Brand update error:', brandUpdateError);
      throw brandUpdateError;
    }
    
    console.log('[saveContext] Brand updated successfully');

    return { fieldsCount: extracted.extractedFields?.length || 0 };
  } catch (error: any) {
    console.error('[saveContext] FAILED:', error);
    console.error('[saveContext] Full error:', JSON.stringify(error));
    await logError({
      userId,
      errorType: 'database',
      module: 'mentor',
      errorMessage: error.message || 'Failed to save extracted context',
      context: { brandId, error: error.message, fullError: JSON.stringify(error) }
    });
    return { fieldsCount: 0, error: error.message };
  }
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
