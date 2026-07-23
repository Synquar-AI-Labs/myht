-- ============================================================================
-- Explicit table privileges — portability for fresh databases
-- ============================================================================
-- The production project (Feb 2026) has Supabase's old permissive default
-- grants, so the app works there. Newer Supabase environments (including the
-- local CLI stack) no longer grant data privileges to authenticated /
-- service_role by default, which silently breaks every query ("permission
-- denied") on a fresh deployment. Make the grants explicit.
--
-- Security model is unchanged: RLS (allowlist policies) is the boundary.
-- Grants without a passing policy still return zero rows / refuse writes.
-- Deliberately: NOTHING is granted to anon, and app_allowlist gets no client
-- grants at all (readable only via the SECURITY DEFINER helper).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'health_records','bp_readings','appointments','reminder_settings',
    'medicines','medicine_logs','audio_transcripts','hospital_stays',
    'custom_actions','custom_action_logs','written_notes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
