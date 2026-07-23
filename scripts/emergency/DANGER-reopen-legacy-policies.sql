-- ============================================================================
-- ⛔ DANGER — LAST RESORT ONLY. READ BEFORE RUNNING. ⛔
-- ============================================================================
-- Running this REOPENS THE MEDICAL-DATA EXPOSURE the Phase 0 lockdown closed:
-- every table becomes readable and writable by ANY authenticated account
-- again. Use it ONLY if ALL caregivers are locked out during a care emergency
-- and allowlist-repair.sql could not fix it.
--
-- It deliberately does NOT restore the old anonymous access to written_notes —
-- there is no emergency that requires anonymous access.
--
-- MANDATORY FOLLOW-UP, SAME DAY: fix the underlying problem, then re-apply
-- supabase/migrations/20260722153000_phase0_security_lockdown.sql to
-- re-contain. Do not leave the app in this state overnight.
--
-- This file lives outside supabase/migrations/ so it can never auto-apply.
-- ============================================================================

DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'health_records','bp_readings','appointments','reminder_settings',
    'medicines','medicine_logs','audio_transcripts','hospital_stays',
    'custom_actions','custom_action_logs','written_notes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      FOR pol IN SELECT policyname FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                     'EMERGENCY broad access - recontain today', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allowlisted caregivers upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Allowlisted caregivers read audio"   ON storage.objects;
DROP POLICY IF EXISTS "Allowlisted caregivers delete audio" ON storage.objects;

CREATE POLICY "EMERGENCY audio upload - recontain today" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio-files');
CREATE POLICY "EMERGENCY audio read - recontain today" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'audio-files');
CREATE POLICY "EMERGENCY audio delete - recontain today" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'audio-files');
