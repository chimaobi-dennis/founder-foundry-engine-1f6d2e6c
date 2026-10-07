/**
 * Team Members Service — who is in a brand's workspace and with what role.
 *
 * The owner (brands.user_id) pays and holds the credit pool. Members join by
 * invite link; the accept RPC checks the signed-in email matches the invite.
 * Roles are enforced by row-level security; this service only reads them so
 * the UI can hide what a role cannot do.
 */

import { supabase } from '@/integrations/supabase/client';
import { roleAtLeast, ROLE_LABEL, type BrandRole } from '@shared/plans';

export { roleAtLeast, ROLE_LABEL };
export type { BrandRole };

const db = supabase as any;

export interface BrandMember {
  id: string;
  brand_id: string;
  user_id: string | null;
  email: string;
  role: 'editor' | 'viewer';
  status: 'invited' | 'active';
  invite_token: string;
  invited_at: string;
  accepted_at: string | null;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

const roleCache = new Map<string, { at: number; role: BrandRole | null }>();

/** The signed-in user's role for a brand, cached briefly. */
export async function getMyRole(brandId: string, force = false): Promise<BrandRole | null> {
  const c = roleCache.get(brandId);
  if (!force && c && Date.now() - c.at < 60_000) return c.role;
  const { data, error } = await db.rpc('brand_role', { p_brand_id: brandId });
  const role = error ? null : ((data as BrandRole | null) ?? null);
  roleCache.set(brandId, { at: Date.now(), role });
  return role;
}

export function clearRoleCache(): void {
  roleCache.clear();
}

/** The account that pays for this brand; billing rows carry this user_id. */
export async function getBrandOwnerId(brandId: string): Promise<string | null> {
  const { data, error } = await db.rpc('brand_owner', { p_brand_id: brandId });
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function listMembers(brandId: string): Promise<BrandMember[]> {
  const { data, error } = await db
    .from('brand_members')
    .select('*, profile:profiles!brand_members_user_id_fkey(full_name, avatar_url)')
    .eq('brand_id', brandId)
    .order('created_at');
  if (error) {
    console.error('[Team] listMembers error:', error.message);
    return [];
  }
  return data ?? [];
}

export function inviteLink(member: Pick<BrandMember, 'invite_token'>): string {
  return `${window.location.origin}/invite/${member.invite_token}`;
}

export async function inviteMember(brandId: string, email: string, role: 'editor' | 'viewer', invitedBy: string): Promise<{ success: boolean; error?: string; member?: BrandMember; link?: string }> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { success: false, error: 'That does not look like an email address.' };
  const { data, error } = await db
    .from('brand_members')
    .insert({ brand_id: brandId, email: clean, role, invited_by: invitedBy })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') return { success: false, error: 'That person is already invited to this workspace.' };
    const m = String(error.message ?? '').match(/PLAN_LIMIT:\s*(.+?)(?:\n|$)/);
    return { success: false, error: m ? `${m[1].trim()}.` : error.message };
  }
  return { success: true, member: data, link: inviteLink(data) };
}

export async function setMemberRole(memberId: string, role: 'editor' | 'viewer'): Promise<boolean> {
  const { error } = await db.from('brand_members').update({ role }).eq('id', memberId);
  return !error;
}

export async function removeMember(memberId: string): Promise<boolean> {
  const { error } = await db.from('brand_members').delete().eq('id', memberId);
  return !error;
}

export interface AcceptResult {
  success: boolean;
  error?: string;
  already?: boolean;
  brand_id?: string;
  brand_name?: string;
  role?: BrandRole;
  invited_email?: string;
}

export async function acceptInvite(token: string): Promise<AcceptResult> {
  const { data, error } = await db.rpc('accept_brand_invite', { p_token: token });
  if (error) return { success: false, error: error.message };
  clearRoleCache();
  return (data ?? { success: false, error: 'No response' }) as AcceptResult;
}

/** Credit balance of the brand's shared pool (the owner's wallet). */
export async function getBrandWalletBalance(brandId: string): Promise<{ balance: number; available: number; reserved: number } | null> {
  const { data, error } = await db.rpc('get_wallet_balance_for_brand', { p_brand_id: brandId });
  if (error || !data) return null;
  return { balance: Number(data.balance) || 0, available: Number(data.available_balance) || 0, reserved: Number(data.reserved_balance) || 0 };
}
