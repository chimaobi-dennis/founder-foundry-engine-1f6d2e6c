/**
 * Free-trial credits. The database decides who is eligible (a wallet that has
 * never earned a credit, on no paid plan) and gives them exactly once; this
 * only asks, once per user per page load.
 */

import { supabase } from '@/integrations/supabase/client';

const asked = new Set<string>();

export async function claimTrialCredits(userId: string): Promise<number> {
  if (asked.has(userId)) return 0;
  asked.add(userId);
  const { data, error } = await (supabase as any).rpc('claim_trial_credits');
  if (error) {
    // Not deployed yet or a transient failure: try again next load.
    asked.delete(userId);
    return 0;
  }
  return data?.success ? Number(data.granted) || 0 : 0;
}
