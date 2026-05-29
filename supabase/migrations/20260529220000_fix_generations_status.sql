-- Migration: Fix generations table status constraint
-- Created: 2026-05-29

-- First, drop the existing check constraint if it exists
ALTER TABLE public.generations DROP CONSTRAINT IF EXISTS generations_status_check;

-- Add the correct check constraint with all valid status values
ALTER TABLE public.generations
ADD CONSTRAINT generations_status_check
CHECK (status IN ('initiated', 'queued', 'processing', 'ai_called', 'completed', 'failed', 'failed_pre_cost', 'failed_post_cost', 'partially_completed', 'refunded', 'partial_refund', 'reserved', 'captured', 'released'));

-- Also update the billing_events table if it has a similar constraint
ALTER TABLE public.billing_events DROP CONSTRAINT IF EXISTS billing_events_status_check;

ALTER TABLE public.billing_events
ADD CONSTRAINT billing_events_status_check
CHECK (status IN ('initiated', 'queued', 'processing', 'ai_called', 'completed', 'failed_pre_cost', 'failed_post_cost', 'partially_completed', 'refunded', 'partial_refund', 'reserved', 'captured', 'released'));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
