-- A business can have several plans; one is current. Each plan carries the goal it was written for.
alter table brand_plans drop constraint if exists brand_plans_brand_id_key;
alter table brand_plans
  add column if not exists goal text,
  add column if not exists goal_horizon text,
  add column if not exists is_current boolean not null default true,
  add column if not exists status text not null default 'active';
alter table brand_plans drop constraint if exists brand_plans_status_check;
alter table brand_plans add constraint brand_plans_status_check check (status = any (array['active','done','archived']));
create unique index if not exists brand_plans_one_current on brand_plans(brand_id) where is_current;

-- Automatic revisions and check-ins follow the current plan only.
create or replace function public.plan_request_revision(p_brand_id uuid, p_reason text)
 returns void language sql security definer set search_path to 'public' as $$
  update public.brand_plans set
    revise_note = case
      when revise_note is null or revise_note = '' then left(p_reason, 1500)
      when position(p_reason in revise_note) > 0 then revise_note
      else left(revise_note || ' ' || p_reason, 1500) end,
    revise_requested_at = coalesce(revise_requested_at, now())
  where brand_id = p_brand_id and auto_revise and is_current;
$$;
