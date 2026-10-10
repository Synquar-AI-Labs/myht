-- ============================================================================
-- Phase 0 — security containment (TEMPORARY, until household-scoped RLS lands)
-- ============================================================================
-- Closes the live exposure of the family's medical data:
--   1. `written_notes` was readable/writable by ANONYMOUS callers (a policy of
--      FOR ALL USING(true) with no role restriction).
--   2. Every table trusted "any authenticated account" — so any sign-up (or a
--      leftover test account) could read everything.
-- This restricts ALL access to an explicit allowlist of caregiver accounts.
--
-- DISABLE public sign-ups FIRST and confirm a sign-up attempt is refused.
-- Verify the seeded emails against existing Auth login accounts before deploy.
-- A listed email without an existing, bound account grants nothing.
-- If users exist but none match the list, the migration stops before changing
-- policies rather than locking everyone out. A missing individual still needs
-- repair: confirm every caregiver can log in and see data after deploy.
-- To add a caregiver later: create their account in the dashboard FIRST, then
-- run scripts/emergency/allowlist-repair.sql to bind that account to the list.
-- Review unrecognised accounts separately. Service-role access bypasses RLS;
-- edge functions must enforce their own allowlist checks.
-- ============================================================================

-- 1) Allowlist of caregiver accounts.
--    RLS enabled with NO policies → not readable by any client; only the
--    SECURITY DEFINER helper below (and the service role) can see it.
CREATE TABLE IF NOT EXISTS public.app_allowlist (
  email       text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_allowlist_user_id_key
  ON public.app_allowlist (user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.app_allowlist ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_allowlist (email, note) VALUES
  ('fahadakbar@gmail.com', 'family — VERIFY this is the real login email'),
  ('umairakbar@gmail.com', 'family — VERIFY this is the real login email'),
  ('shahwar@gmail.com',    'family — VERIFY this is the real login email'),
  ('affantiger@gmail.com', 'family — VERIFY this is the real login email')
ON CONFLICT (email) DO NOTHING;

UPDATE public.app_allowlist AS allowed
SET user_id = account.id
FROM auth.users AS account
WHERE lower(btrim(allowed.email)) = lower(btrim(account.email));

-- Abort before any policy changes if the list matches no existing account.
DO $$
DECLARE
  missing_email text;
BEGIN
  FOR missing_email IN
    SELECT email FROM public.app_allowlist WHERE user_id IS NULL ORDER BY email
  LOOP
    RAISE NOTICE 'Listed email has no account: %', missing_email;
  END LOOP;
  IF EXISTS (SELECT 1 FROM auth.users)
     AND NOT EXISTS (SELECT 1 FROM public.app_allowlist WHERE user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'No listed email matches an existing account. Nothing was changed. Run select email from auth.users; to see the real login emails and correct the list.';
  END IF;
END $$;

-- 2) Is the current caller an allowed caregiver?
--    STABLE + SECURITY DEFINER + fixed search_path (so it can read the
--    allowlist regardless of the caller, and can't be hijacked via search_path).
CREATE OR REPLACE FUNCTION public.is_allowed_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_allowlist
    WHERE user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_allowed_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_allowed_user() TO authenticated;

-- 3) Replace every permissive policy on the data tables with allowlist-gated
--    access. `TO authenticated` also removes all anonymous access.
DO $$
DECLARE
  t   text;
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
      -- drop every existing policy on the table
      FOR pol IN SELECT policyname FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_allowed_user()) WITH CHECK (public.is_allowed_user())', 'Allowlisted caregivers only', t);
    END IF;
  END LOOP;
END $$;

-- 4) Same lockdown for the private audio-files storage bucket.
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read audio"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete audio" ON storage.objects;

CREATE POLICY "Allowlisted caregivers upload audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-files' AND public.is_allowed_user());
CREATE POLICY "Allowlisted caregivers read audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio-files' AND public.is_allowed_user());
CREATE POLICY "Allowlisted caregivers delete audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio-files' AND public.is_allowed_user());
