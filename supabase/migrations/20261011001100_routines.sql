-- Family-owned plans and immutable-at-recording copies; only the ticker is published.
CREATE TABLE public.routine_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('meal','exercise')),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
 schedule_time text NOT NULL CHECK (char_length(schedule_time) BETWEEN 1 AND 1000),
 previous_schedule_time text CHECK (char_length(previous_schedule_time) <= 1000),
 schedule_from date,
 details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
 drink text NOT NULL DEFAULT '' CHECK (char_length(drink) <= 500),
 target_minutes integer,
 area text NOT NULL DEFAULT '' CHECK (char_length(area) <= 80),
 move_type text NOT NULL DEFAULT '' CHECK (char_length(move_type) <= 80),
 start_date date NOT NULL,
 end_date date,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,id),
 CHECK ((previous_schedule_time IS NULL) = (schedule_from IS NULL)),
 CHECK (end_date IS NULL OR end_date >= start_date),
 CHECK ((kind='meal' AND target_minutes IS NULL AND area='' AND move_type='') OR
        (kind='exercise' AND drink='' AND target_minutes BETWEEN 1 AND 1440 AND target_minutes IS NOT NULL))
);
CREATE INDEX routine_items_household ON public.routine_items(household_id,id);
CREATE TABLE public.routine_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 item_id uuid NOT NULL,
 caregiver_id uuid NOT NULL,
 for_date date NOT NULL,
 for_minute integer NOT NULL CHECK (for_minute BETWEEN 0 AND 1439),
 done_at timestamptz NOT NULL,
 recorded_by text NOT NULL CHECK (char_length(btrim(recorded_by)) BETWEEN 1 AND 80),
 amount text,
 minutes numeric,
 note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
 kind text NOT NULL CHECK (kind IN ('meal','exercise')),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
 details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
 drink text NOT NULL DEFAULT '' CHECK (char_length(drink) <= 500),
 target_minutes integer,
 FOREIGN KEY(household_id,item_id) REFERENCES public.routine_items(household_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 UNIQUE(household_id,item_id,for_date,for_minute),
 CHECK ((kind='meal' AND amount IN ('all','most','half','little','none') AND amount IS NOT NULL AND minutes IS NULL AND target_minutes IS NULL) OR
        (kind='exercise' AND amount IS NULL AND minutes IS NOT NULL AND minutes BETWEEN 0 AND 1440 AND drink='' AND target_minutes IS NOT NULL AND target_minutes BETWEEN 1 AND 1440))
);
CREATE INDEX routine_logs_household ON public.routine_logs(household_id,for_date,id);
ALTER TABLE public.routine_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.routine_items,public.routine_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.routine_items,public.routine_logs TO authenticated;
CREATE POLICY household_access ON public.routine_items FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
CREATE POLICY household_access ON public.routine_logs FOR ALL TO authenticated USING(app_private.is_member(household_id)) WITH CHECK(app_private.is_member(household_id));
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.routine_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.routine_logs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
