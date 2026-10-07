-- ─────────────────────────────────────────────────────────────────────────────
-- Retire the old content-series cron
--
-- content-series-cron called a generate-content function that no longer
-- exists, so every scheduled series run failed. Series now run through the
-- agent runner as scheduled automations. This moves the existing series into
-- paused Copywriter automations (paused so the plan limits apply when the
-- founder resumes them), stops them in the old table, tells each owner, and
-- unschedules any pg_cron job that still pointed at the old function.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  b record;
  v_agent uuid;
  v_names jsonb;
  v_interval text;
  v_moved integer := 0;
BEGIN
  SELECT id INTO v_agent FROM public.agents WHERE slug = 'copywriter';
  IF v_agent IS NULL THEN
    RAISE NOTICE 'Copywriter agent not found; series left as they are.';
    RETURN;
  END IF;

  FOR b IN SELECT * FROM public.content_studio_briefs WHERE is_series AND series_active LOOP
    IF EXISTS (SELECT 1 FROM public.automations WHERE task_input->>'migrated_from_brief' = b.id::text) THEN
      CONTINUE;
    END IF;
    -- There is no every-two-days schedule; daily is the nearest.
    v_interval := CASE b.series_interval
      WHEN 'daily' THEN 'daily' WHEN 'every_48h' THEN 'daily'
      WHEN 'weekly' THEN 'weekly' WHEN 'biweekly' THEN 'biweekly' WHEN 'monthly' THEN 'monthly'
      ELSE 'weekly' END;
    SELECT COALESCE(jsonb_agg(lower(COALESCE(slug, name))), '[]'::jsonb) INTO v_names
      FROM public.content_platforms WHERE id = ANY (COALESCE(b.selected_platform_ids, '{}'::uuid[]));

    INSERT INTO public.automations (brand_id, user_id, agent_id, name, trigger_type, schedule_interval, next_run_at, task_input, status)
    VALUES (
      b.brand_id, b.user_id, v_agent, left(b.name || ' (series)', 120), 'schedule', v_interval,
      now() + CASE v_interval WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days'
                              WHEN 'biweekly' THEN interval '14 days' ELSE interval '1 month' END,
      jsonb_build_object(
        'brief', COALESCE(NULLIF(b.brief, ''), NULLIF(b.campaign_goal, ''), b.name),
        'units', GREATEST(1, jsonb_array_length(v_names)),
        'platforms', v_names,
        'migrated_from_brief', b.id
      ),
      'paused'
    );

    UPDATE public.content_studio_briefs SET series_active = false, next_generation_at = NULL WHERE id = b.id;

    INSERT INTO public.notifications (user_id, brand_id, type, title, body, action_url)
    VALUES (b.user_id, b.brand_id, 'system', 'Your content series moved to Your team',
      format('"%s" now runs through your Copywriter on a schedule, quoted before each run and reviewed by you. It is paused; resume it on Your team.', b.name),
      '/team');
    v_moved := v_moved + 1;
  END LOOP;
  RAISE NOTICE 'Moved % series into automations.', v_moved;
END $$;

-- Stop any scheduler job that still calls the retired function.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $q$SELECT cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%content-series-cron%'$q$;
  END IF;
END $$;

-- Clean up the one failed run and notification created when the retired
-- endpoint was probed during the 2026-10-07 audit (it was open to anyone).
DELETE FROM public.content_series_runs
  WHERE status = 'failed' AND trigger_type = 'cron' AND created_at >= TIMESTAMPTZ '2026-10-07 13:45:00+00' AND created_at < TIMESTAMPTZ '2026-10-07 14:30:00+00';
DELETE FROM public.notifications
  WHERE type = 'content_series_failed' AND created_at >= TIMESTAMPTZ '2026-10-07 13:45:00+00' AND created_at < TIMESTAMPTZ '2026-10-07 14:30:00+00';
