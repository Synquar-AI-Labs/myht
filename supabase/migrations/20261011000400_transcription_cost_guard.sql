-- A household can claim at most 20 paid attempts in a rolling 24-hour window.
CREATE TABLE public.transcription_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transcription_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.transcription_usage FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.transcription_usage_id_seq FROM PUBLIC, anon, authenticated;
CREATE INDEX transcription_usage_household_at ON public.transcription_usage(household_id, at);

CREATE FUNCTION public.claim_transcription(p_household_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  daily_limit CONSTANT integer := 20;
BEGIN
  IF NOT app_private.is_member(p_household_id) THEN
    RAISE EXCEPTION 'household_access_denied';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text, 0));
  IF (SELECT count(*) FROM public.transcription_usage
      WHERE household_id = p_household_id AND at >= now() - interval '24 hours') >= daily_limit THEN
    RAISE EXCEPTION 'transcription_limit_reached';
  END IF;
  INSERT INTO public.transcription_usage(household_id, user_id) VALUES (p_household_id, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.claim_transcription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_transcription(uuid) TO authenticated;
