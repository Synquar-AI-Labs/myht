ALTER TABLE public.medicine_logs
 ADD COLUMN for_date date,
 ADD COLUMN for_minute smallint CHECK (for_minute BETWEEN 0 AND 1439),
 ADD COLUMN is_extra boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT dose_link_pair CHECK ((for_date IS NULL) = (for_minute IS NULL)),
 ADD CONSTRAINT extra_has_no_link CHECK (NOT is_extra OR for_date IS NULL);
CREATE INDEX medicine_logs_scheduled_day ON public.medicine_logs(household_id,for_date) WHERE for_date IS NOT NULL;

CREATE TABLE public.dose_skips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 medicine_id uuid NOT NULL,
 for_date date NOT NULL,
 for_minute smallint NOT NULL CHECK (for_minute BETWEEN 0 AND 1439),
 reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 80),
 caregiver_id uuid,
 recorded_by text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (household_id,medicine_id) REFERENCES public.medicines(household_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 UNIQUE (household_id,medicine_id,for_date,for_minute)
);
ALTER TABLE public.dose_skips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dose_skips FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.dose_skips TO authenticated;
CREATE POLICY household_access ON public.dose_skips FOR ALL TO authenticated
 USING (app_private.is_member(household_id)) WITH CHECK (app_private.is_member(household_id));
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.dose_skips
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
