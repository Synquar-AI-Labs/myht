-- Family-owned profile and contacts. Only household_sync is published.
CREATE TABLE public.care_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL UNIQUE REFERENCES public.households(id) ON DELETE CASCADE,
 date_of_birth date CHECK (date_of_birth <= CURRENT_DATE),
 fall_risk boolean,
 fall_risk_note text NOT NULL DEFAULT '' CHECK (char_length(fall_risk_note) <= 500),
 none_known text[] NOT NULL DEFAULT '{}' CHECK (none_known <@ ARRAY['allergy','contagious','disability','condition','diet']::text[]),
 emergency_notes text NOT NULL DEFAULT '' CHECK (char_length(emergency_notes) <= 4000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.care_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('allergy','contagious','disability','condition','diet')),
 text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 120),
 note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
 sort integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_alerts_household ON public.care_alerts(household_id,sort,id);
CREATE TABLE public.contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('emergency','doctor','caretaker','other')),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
 role text NOT NULL DEFAULT '' CHECK (char_length(role) <= 120),
 phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 50),
 phone2 text NOT NULL DEFAULT '' CHECK (char_length(phone2) <= 50),
 email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 254),
 address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
 notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
 sort integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_household ON public.contacts(household_id,sort,id);
ALTER TABLE public.care_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.care_profiles,public.care_alerts,public.contacts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.care_profiles,public.care_alerts,public.contacts TO authenticated;
CREATE POLICY household_access ON public.care_profiles FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
CREATE POLICY household_access ON public.care_alerts FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
CREATE POLICY household_access ON public.contacts FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
CREATE TRIGGER profile_updated BEFORE UPDATE ON public.care_profiles FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.care_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.care_alerts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.contacts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();

-- An existing alert always wins over "None known", including concurrent edits.
-- Keep this invariant in the database, not in two fallible client requests.
CREATE FUNCTION app_private.profile_known_kinds() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.none_known := ARRAY(SELECT DISTINCT k FROM unnest(NEW.none_known) k
   WHERE NOT EXISTS(SELECT 1 FROM public.care_alerts a WHERE a.household_id=NEW.household_id AND a.kind=k));
 RETURN NEW;
END $$;
CREATE FUNCTION app_private.clear_known_kind() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 INSERT INTO public.care_profiles(household_id) VALUES(NEW.household_id)
 ON CONFLICT(household_id) DO UPDATE SET none_known=array_remove(public.care_profiles.none_known,NEW.kind);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.profile_known_kinds(),app_private.clear_known_kind() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profile_known BEFORE INSERT OR UPDATE ON public.care_profiles FOR EACH ROW EXECUTE FUNCTION app_private.profile_known_kinds();
CREATE TRIGGER alert_known AFTER INSERT OR UPDATE OF kind ON public.care_alerts FOR EACH ROW EXECUTE FUNCTION app_private.clear_known_kind();
