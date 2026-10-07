-- Admins (and approved creators who predate creator_profiles) have no
-- creator_profiles row, so agents.creator_id cannot reference them. Create it
-- on demand for anyone whose profile role allows the Creator program.
CREATE OR REPLACE FUNCTION public.ensure_creator_profile()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_row public.creator_profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not signed in'); END IF;
  SELECT role, COALESCE(NULLIF(full_name, ''), split_part(email, '@', 1), 'Creator') INTO v_role, v_name FROM public.profiles WHERE id = v_uid;
  IF v_role NOT IN ('creator', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved creators can publish agents. Apply from the Creator page first.');
  END IF;
  SELECT * INTO v_row FROM public.creator_profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    INSERT INTO public.creator_profiles (id, display_name, is_approved, approved_at, approved_by)
    VALUES (v_uid, v_name, true, now(), CASE WHEN v_role = 'admin' THEN 'self (admin)' ELSE 'system' END)
    RETURNING * INTO v_row;
  ELSIF NOT v_row.is_approved AND v_role = 'admin' THEN
    UPDATE public.creator_profiles SET is_approved = true, approved_at = now() WHERE id = v_uid RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('success', v_row.is_approved, 'id', v_row.id, 'display_name', v_row.display_name,
    'error', CASE WHEN v_row.is_approved THEN NULL ELSE 'Your creator application is not approved yet.' END);
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_creator_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_creator_profile() TO authenticated;
