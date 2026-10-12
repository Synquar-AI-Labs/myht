-- Independent paid-attempt allowances; existing usage remains transcription.
ALTER TABLE public.transcription_usage
  ADD COLUMN kind text NOT NULL DEFAULT 'transcription'
  CHECK (kind IN ('transcription', 'prescription_read'));
ALTER TABLE public.medicines
  ADD COLUMN source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'prescription_photo'));

CREATE OR REPLACE FUNCTION public.claim_transcription(p_household_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  daily_limit CONSTANT integer := 20;
BEGIN
  IF NOT app_private.is_member(p_household_id) THEN
    RAISE EXCEPTION 'household_access_denied';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text, 0));
  IF (SELECT count(*) FROM public.transcription_usage
      WHERE household_id = p_household_id AND kind = 'transcription'
      AND at >= now() - interval '24 hours') >= daily_limit THEN
    RAISE EXCEPTION 'transcription_limit_reached';
  END IF;
  INSERT INTO public.transcription_usage(household_id, user_id, kind)
    VALUES (p_household_id, auth.uid(), 'transcription');
END;
$$;
REVOKE ALL ON FUNCTION public.claim_transcription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_transcription(uuid) TO authenticated;

CREATE FUNCTION public.claim_prescription_read(p_household_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  daily_limit CONSTANT integer := 10;
BEGIN
  IF NOT app_private.is_member(p_household_id) THEN
    RAISE EXCEPTION 'household_access_denied';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text, 0));
  IF (SELECT count(*) FROM public.transcription_usage
      WHERE household_id = p_household_id AND kind = 'prescription_read'
      AND at >= now() - interval '24 hours') >= daily_limit THEN
    RAISE EXCEPTION 'prescription_limit_reached';
  END IF;
  INSERT INTO public.transcription_usage(household_id, user_id, kind)
    VALUES (p_household_id, auth.uid(), 'prescription_read');
END;
$$;
REVOKE ALL ON FUNCTION public.claim_prescription_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_prescription_read(uuid) TO authenticated;
