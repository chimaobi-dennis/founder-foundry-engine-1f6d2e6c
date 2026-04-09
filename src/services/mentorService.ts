import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────

export interface MentorConversation {
  id: string;
  brand_id: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface MentorMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  ai_response_failed?: boolean;
  created_at: string;
}

export interface Milestone {
  id: string;
  brand_id: string;
  conversation_id: string;
  name: string;
  category: string;
  message_id: string | null;
  created_at: string;
}

// ─── Conversation ─────────────────────────────────────────

export const getOrCreateConversation = async (
  brandId: string
): Promise<MentorConversation | null> => {
  const { data: existing } = await (supabase as any)
    .from('mentor_conversations')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  if (existing) return existing;

  const { data, error } = await (supabase as any)
    .from('mentor_conversations')
    .insert({ brand_id: brandId, message_count: 0 })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return data;
};

// ─── Messages ─────────────────────────────────────────────

export const getMessages = async (
  conversationId: string
): Promise<MentorMessage[]> => {
  const { data, error } = await (supabase as any)
    .from('mentor_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data ?? [];
};

export const saveMessage = async (
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<MentorMessage | null> => {
  const { data, error } = await (supabase as any)
    .from('mentor_messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();

  if (error) {
    console.error('Error saving message:', error);
    return null;
  }

  // Update last_message_at on the conversation
  await (supabase as any)
    .from('mentor_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
};

// ─── Milestones ───────────────────────────────────────────

export const getMilestones = async (
  brandId: string
): Promise<Milestone[]> => {
  const { data, error } = await (supabase as any)
    .from('milestones')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }

  return data ?? [];
};

export const createMilestone = async (
  brandId: string,
  conversationId: string,
  name: string,
  category: string,
  messageId?: string
): Promise<Milestone | null> => {
  const { data, error } = await (supabase as any)
    .from('milestones')
    .insert({
      brand_id: brandId,
      conversation_id: conversationId,
      name,
      category,
      message_id: messageId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating milestone:', error);
    return null;
  }

  return data;
};

export const deleteMilestone = async (
  milestoneId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await (supabase as any)
    .from('milestones')
    .delete()
    .eq('id', milestoneId);

  return { success: !error, error: error?.message };
};

export const updateMilestoneName = async (
  milestoneId: string,
  name: string
): Promise<void> => {
  await (supabase as any)
    .from('milestones')
    .update({ name })
    .eq('id', milestoneId);
};

export const updateMilestoneCategoryDB = async (
  milestoneId: string,
  category: string
): Promise<void> => {
  await (supabase as any)
    .from('milestones')
    .update({ category })
    .eq('id', milestoneId);
};

// ─── Get messages for AI context (last N messages) ───────

export const getMessagesForAIContext = async (
  conversationId: string,
  limit: number = 10
): Promise<{ role: string; content: string }[]> => {
  const { data } = await (supabase as any)
    .from('mentor_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).reverse();
};

// ─── Unanswered message handling ─────────────────────

// Check if the last message in a conversation is unanswered
// Returns the unanswered user message or null
export const getUnansweredMessage = async (
  conversationId: string
): Promise<MentorMessage | null> => {
  const { data } = await (supabase as any)
    .from('mentor_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(2);

  if (!data || data.length === 0) return null;

  // Most recent message
  const lastMessage = data[0];

  // If the most recent message is from the user it is unanswered
  if (lastMessage.role === 'user') {
    return lastMessage;
  }

  return null;
};

// Mark a message as having failed AI response
// We track this by adding a failed_at timestamp
export const markMessageAsFailed = async (
  messageId: string
): Promise<void> => {
  await (supabase as any)
    .from('mentor_messages')
    .update({ ai_response_failed: true })
    .eq('id', messageId);
};

// Clear failed flag when retrying
export const clearMessageFailedFlag = async (
  messageId: string
): Promise<void> => {
  await (supabase as any)
    .from('mentor_messages')
    .update({ ai_response_failed: false })
    .eq('id', messageId);
};
