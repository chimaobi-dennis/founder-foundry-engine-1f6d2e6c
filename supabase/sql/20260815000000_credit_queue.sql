-- Queue when out of credits: a run that cannot reserve its credits waits
-- (status waiting_credits) instead of pausing; the minute tick continues the
-- oldest waiting run as soon as the wallet covers it.
alter table public.automation_runs drop constraint if exists automation_runs_status_check;
alter table public.automation_runs add constraint automation_runs_status_check
  check (status in ('queued', 'running', 'waiting_approval', 'waiting_credits', 'paused', 'completed', 'failed', 'cancelled'));
alter table public.automation_runs add column if not exists credits_needed integer;
alter table public.automation_runs add column if not exists waiting_since timestamptz;
create index if not exists automation_runs_waiting_credits_idx on public.automation_runs (waiting_since) where status = 'waiting_credits';
