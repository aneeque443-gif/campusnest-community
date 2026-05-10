
CREATE TABLE IF NOT EXISTS public.admin_setup (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  used boolean NOT NULL DEFAULT false,
  used_by uuid,
  used_at timestamptz
);

INSERT INTO public.admin_setup (id, used) VALUES (true, false)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.admin_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no direct access" ON public.admin_setup FOR SELECT USING (false);

CREATE OR REPLACE FUNCTION public.claim_admin_setup(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.admin_setup%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO s FROM public.admin_setup WHERE id = true FOR UPDATE;

  IF s.used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;

  IF _code IS DISTINCT FROM 'CAMPUSNEST2024' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
    ON CONFLICT DO NOTHING;

  UPDATE public.admin_setup
    SET used = true, used_by = uid, used_at = now()
    WHERE id = true;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_setup(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_admin_setup(text) TO authenticated;
