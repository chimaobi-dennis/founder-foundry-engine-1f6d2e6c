import { supabase } from '@/integrations/supabase/client';

export type ErrorType = 
  | 'ai_call'
  | 'database'
  | 'storage'
  | 'auth'
  | 'api'
  | 'unknown';

export type ErrorModule =
  | 'mentor'
  | 'prostudio'
  | 'campaignkit'
  | 'contentcalendar'
  | 'docstudio'
  | 'reelbuilder'
  | 'library'
  | 'brand_dna'
  | 'auth'
  | 'admin'
  | 'other';

export interface LogErrorOptions {
  userId?: string;
  errorType: ErrorType;
  module: ErrorModule;
  errorMessage: string;
  errorCode?: string;
  errorStack?: string;
  context?: Record<string, any>;
  taskType?: string;
  modelId?: string;
  providerSlug?: string;
  // New tracing fields
  callLocation?: string;
  userAction?: string;
  pipelineStep?: string;
  breadcrumbs?: BreadcrumbEntry[];
  componentName?: string;
}

export interface BreadcrumbEntry {
  timestamp: string;
  action: string;
  module: string;
  data?: Record<string, any>;
}

// ─── Breadcrumb tracker ────────────────────────────────

// In-memory breadcrumb trail — max 10 entries
const breadcrumbTrail: BreadcrumbEntry[] = [];

export const addBreadcrumb = (
  action: string,
  module: ErrorModule,
  data?: Record<string, any>
): void => {
  breadcrumbTrail.push({
    timestamp: new Date().toISOString(),
    action,
    module,
    data
  });

  // Keep only last 10
  if (breadcrumbTrail.length > 10) {
    breadcrumbTrail.shift();
  }
};

export const getBreadcrumbs = (): BreadcrumbEntry[] => {
  return [...breadcrumbTrail];
};

export const clearBreadcrumbs = (): void => {
  breadcrumbTrail.length = 0;
};

// ─── Log an error to the database ────────────────────────

export const logError = async (
  options: LogErrorOptions
): Promise<void> => {
  // Auto-capture call location from stack trace
  let callLocation = options.callLocation;
  if (!callLocation) {
    try {
      const stack = new Error().stack ?? '';
      // Extract the calling function from the stack
      // Skip the first 3 lines (Error, logError, logAIError wrappers)
      const lines = stack.split('\n');
      const callerLine = lines[3] ?? lines[2] ?? '';
      // Extract file and line number
      const match = callerLine.match(/at (.+?) \((.+?):(\d+)/);
      if (match) {
        callLocation = `${match[1]} — ${match[2].split('/').slice(-2).join('/')}:${match[3]}`;
      } else {
        callLocation = callerLine.trim().replace('at ', '');
      }
    } catch {
      callLocation = 'unknown';
    }
  }

  // Auto-capture current URL path
  const urlPath = typeof window !== 'undefined' 
    ? window.location.pathname 
    : undefined;

  // Always log to console with full trace
  console.error(`[${options.module}] ${options.errorType} ERROR`, {
    message: options.errorMessage,
    code: options.errorCode,
    location: callLocation,
    action: options.userAction,
    pipeline: options.pipelineStep,
    url: urlPath,
    component: options.componentName,
    breadcrumbs: options.breadcrumbs ?? getBreadcrumbs(),
    context: options.context,
    stack: options.errorStack
  });

  if (!options.userId) return;

  try {
    await (supabase as any)
      .from('app_errors')
      .insert({
        user_id: options.userId,
        error_type: options.errorType,
        module: options.module,
        error_message: options.errorMessage,
        error_code: options.errorCode ?? null,
        error_stack: options.errorStack ?? null,
        context: options.context ?? {},
        task_type: options.taskType ?? null,
        model_id: options.modelId ?? null,
        provider_slug: options.providerSlug ?? null,
        call_location: callLocation ?? null,
        user_action: options.userAction ?? null,
        pipeline_step: options.pipelineStep ?? null,
        breadcrumbs: options.breadcrumbs ?? getBreadcrumbs(),
        url_path: urlPath ?? null,
        component_name: options.componentName ?? null,
        is_resolved: false
      });
  } catch (dbError) {
    console.error('Failed to log error to DB:', dbError);
  }
};

// ─── Convenience wrappers ─────────────────────────────────

export const logAIError = async (
  userId: string,
  module: ErrorModule,
  errorMessage: string,
  context?: Record<string, any>,
  taskType?: string,
  modelId?: string,
  providerSlug?: string,
  pipelineStep?: string,
  userAction?: string
): Promise<void> => {
  await logError({
    userId,
    errorType: 'ai_call',
    module,
    errorMessage,
    context,
    taskType,
    modelId,
    providerSlug,
    pipelineStep,
    userAction
  });
};

export const logDatabaseError = async (
  userId: string,
  module: ErrorModule,
  errorMessage: string,
  errorCode?: string,
  context?: Record<string, any>
): Promise<void> => {
  await logError({
    userId,
    errorType: 'database',
    module,
    errorMessage,
    errorCode,
    context
  });
};

// ─── Admin functions ──────────────────────────────────────

export const getErrors = async (filters?: {
  module?: ErrorModule;
  errorType?: ErrorType;
  isResolved?: boolean;
  userId?: string;
  limit?: number;
  search?: string;
}) => {
  let query = (supabase as any)
    .from('app_errors')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.module) {
    query = query.eq('module', filters.module);
  }
  if (filters?.errorType) {
    query = query.eq('error_type', filters.errorType);
  }
  if (filters?.isResolved !== undefined) {
    query = query.eq('is_resolved', filters.isResolved);
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters?.search) {
    query = query.or(
      `error_message.ilike.%${filters.search}%,` +
      `url_path.ilike.%${filters.search}%,` +
      `call_location.ilike.%${filters.search}%,` +
      `user_action.ilike.%${filters.search}%` 
    );
  }

  query = query.limit(filters?.limit ?? 100);

  const { data, error } = await query;
  return { data, error };
};

export const getErrorStats = async () => {
  const [total, unresolved, aiErrors, last24h] = await Promise.all([
    (supabase as any)
      .from('app_errors')
      .select('*', { count: 'exact', head: true }),
    (supabase as any)
      .from('app_errors')
      .select('*', { count: 'exact', head: true })
      .eq('is_resolved', false),
    (supabase as any)
      .from('app_errors')
      .select('*', { count: 'exact', head: true })
      .eq('error_type', 'ai_call'),
    (supabase as any)
      .from('app_errors')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())
  ]);

  return {
    total: total.count ?? 0,
    unresolved: unresolved.count ?? 0,
    aiErrors: aiErrors.count ?? 0,
    last24h: last24h.count ?? 0
  };
};

export const resolveError = async (
  errorId: string,
  adminId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('app_errors')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      resolution_note: note ?? null
    })
    .eq('id', errorId);

  return { success: !error, error: error?.message };
};

export const resolveAllErrors = async (
  adminId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('app_errors')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId
    })
    .eq('is_resolved', false);

  return { success: !error, error: error?.message };
};

export const deleteResolvedErrors = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  const { error } = await (supabase as any)
    .from('app_errors')
    .delete()
    .eq('is_resolved', true);

  return { success: !error, error: error?.message };
};
