-- Policy helpers are not exposed through PostgREST.
-- PUBLIC's function EXECUTE default is global; revoke globally first.
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;
CREATE FUNCTION app_private.is_member(hid uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=hid AND user_id=auth.uid()) $$;
CREATE FUNCTION app_private.is_admin(hid uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $$ SELECT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=hid AND user_id=auth.uid() AND role='admin') $$;
CREATE FUNCTION app_private.verified_email() RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $$ SELECT lower(btrim(email)) FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL $$;
CREATE FUNCTION app_private.path_household(name text) RETURNS uuid
 LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
 BEGIN RETURN (storage.foldername(name))[1]::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_member(uuid), app_private.is_admin(uuid), app_private.path_household(text) TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.health_records TO authenticated;
CREATE POLICY household_access ON public.health_records FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.medicines TO authenticated;
CREATE POLICY household_access ON public.medicines FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.medicine_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.medicine_logs TO authenticated;
CREATE POLICY household_access ON public.medicine_logs FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.appointments TO authenticated;
CREATE POLICY household_access ON public.appointments FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.hospital_stays ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.hospital_stays TO authenticated;
CREATE POLICY household_access ON public.hospital_stays FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.custom_actions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.custom_actions TO authenticated;
CREATE POLICY household_access ON public.custom_actions FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.custom_action_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.custom_action_logs TO authenticated;
CREATE POLICY household_access ON public.custom_action_logs FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.bp_readings ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bp_readings TO authenticated;
CREATE POLICY household_access ON public.bp_readings FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.written_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.written_notes TO authenticated;
CREATE POLICY household_access ON public.written_notes FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.audio_transcripts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audio_transcripts TO authenticated;
CREATE POLICY household_access ON public.audio_transcripts FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.households TO authenticated;
CREATE POLICY household_read ON public.households FOR SELECT TO authenticated USING(app_private.is_member(id));
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.household_members TO authenticated;
CREATE POLICY household_read ON public.household_members FOR SELECT TO authenticated USING(app_private.is_member(household_id));
ALTER TABLE public.caregivers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.caregivers TO authenticated;
CREATE POLICY household_read ON public.caregivers FOR SELECT TO authenticated USING(app_private.is_member(household_id));
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.household_invites TO authenticated;
CREATE POLICY household_read ON public.household_invites FOR SELECT TO authenticated USING(app_private.is_admin(household_id));
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.audit_log TO authenticated;
CREATE POLICY household_read ON public.audit_log FOR SELECT TO authenticated USING(app_private.is_member(household_id));
ALTER TABLE public.household_sync ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.household_sync TO authenticated;
CREATE POLICY household_read ON public.household_sync FOR SELECT TO authenticated USING(app_private.is_member(household_id));
GRANT UPDATE ON public.households TO authenticated;
CREATE POLICY household_edit ON public.households FOR UPDATE TO authenticated USING(app_private.is_admin(id)) WITH CHECK(app_private.is_admin(id));
GRANT INSERT(household_id,display_name),UPDATE(display_name,is_active) ON public.caregivers TO authenticated;
CREATE POLICY caregiver_add ON public.caregivers FOR INSERT TO authenticated WITH CHECK(app_private.is_admin(household_id));
CREATE POLICY caregiver_edit ON public.caregivers FOR UPDATE TO authenticated USING(app_private.is_admin(household_id)) WITH CHECK(app_private.is_admin(household_id));
INSERT INTO storage.buckets(id,name,public) VALUES('audio-files','audio-files',false)
ON CONFLICT (id) DO UPDATE SET public = false;
DROP POLICY IF EXISTS audio_read ON storage.objects;
DROP POLICY IF EXISTS audio_add ON storage.objects;
DROP POLICY IF EXISTS audio_delete ON storage.objects;
CREATE POLICY audio_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='audio-files' AND app_private.is_member(app_private.path_household(name)));
CREATE POLICY audio_add ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='audio-files' AND app_private.is_member(app_private.path_household(name)));
CREATE POLICY audio_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='audio-files' AND app_private.is_member(app_private.path_household(name)));

