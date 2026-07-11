-- Enable Supabase Realtime for the shared care tables so that a change made on
-- one caregiver's device is pushed to every other open device automatically.
-- Guarded so re-running (or running where the publication is absent) is safe.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'health_records',
    'bp_readings',
    'medicines',
    'medicine_logs',
    'appointments',
    'custom_actions',
    'custom_action_logs',
    'hospital_stays',
    'written_notes',
    'audio_transcripts'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found; skipping realtime setup.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Ensure UPDATE/DELETE events carry full row data for the client.
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

      -- Add to the realtime publication only if not already a member.
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;
