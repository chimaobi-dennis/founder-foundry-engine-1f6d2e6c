// Supabase client. Connection settings come from the dedicated
// non-managed config module (src/config/supabaseConfig.ts), which falls
// back to VITE_SUPABASE_* env vars. Do not hardcode URL/keys here.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_CONFIG } from '@/config/supabaseConfig';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
