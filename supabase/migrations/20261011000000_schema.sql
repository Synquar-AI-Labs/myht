-- Clean product baseline. Never apply to the legacy family database.
CREATE SCHEMA app_private;
CREATE TABLE public.households (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 care_recipient_name text NOT NULL CHECK(length(btrim(care_recipient_name)) BETWEEN 1 AND 80),
 timezone text NOT NULL DEFAULT 'America/Toronto',
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.household_members (
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('admin','member')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(household_id,user_id), UNIQUE(user_id)
);
CREATE TABLE public.caregivers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 40),
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(household_id,id)
);
CREATE UNIQUE INDEX caregivers_account ON public.caregivers(household_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX caregivers_name ON public.caregivers(household_id,lower(display_name)) WHERE is_active;
CREATE TABLE public.household_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(email = lower(btrim(email))),
 role text NOT NULL DEFAULT 'member' CHECK(role='member'),
 caregiver_id uuid,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '14 days',
 accepted_at timestamptz, accepted_by uuid REFERENCES auth.users(id), revoked_at timestamptz,
 FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 CHECK(NOT(accepted_at IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX invites_pending ON public.household_invites(household_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE public.audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 household_id uuid NOT NULL, actor_user_id uuid,
 table_name text NOT NULL, row_key text NOT NULL,
 action text NOT NULL CHECK(action IN ('insert','update','delete')),
 old_row jsonb, new_row jsonb, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_household_at ON public.audit_log(household_id,at DESC);
CREATE TABLE public.household_sync (
 household_id uuid PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
 table_name text NOT NULL, seq bigint NOT NULL DEFAULT 0, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.health_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 date date NOT NULL, feed_bags integer NOT NULL DEFAULT 0, weight numeric(5,1) NOT NULL DEFAULT 0, bp_systolic integer NOT NULL DEFAULT 0, bp_diastolic integer NOT NULL DEFAULT 0, food_taken boolean NOT NULL DEFAULT false, food_description text DEFAULT '', stool_passed boolean NOT NULL DEFAULT false, stool_count integer NOT NULL DEFAULT 0, vomiting boolean NOT NULL DEFAULT false, constipation boolean NOT NULL DEFAULT false, flush_count integer NOT NULL DEFAULT 0, misc_notes text NOT NULL DEFAULT '', vomit_count integer NOT NULL DEFAULT 0, recorded_by text NOT NULL DEFAULT '', urine_count integer NOT NULL DEFAULT 0, bile_bags integer NOT NULL DEFAULT 0, flush_ml integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(household_id,date)
);
CREATE INDEX health_records_household ON public.health_records(household_id,date);
CREATE TABLE public.medicines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL, schedule_note text NOT NULL DEFAULT '', potency text NOT NULL DEFAULT '', amount text NOT NULL DEFAULT '', med_type text NOT NULL DEFAULT '', category text NOT NULL DEFAULT 'medicine', schedule_time text NOT NULL DEFAULT '', frequency text NOT NULL DEFAULT 'daily', show_in_quick_log boolean NOT NULL DEFAULT true, UNIQUE(household_id,id)
);
CREATE INDEX medicines_household ON public.medicines(household_id);
CREATE TABLE public.medicine_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 date date NOT NULL, medicine_id uuid NOT NULL, hour integer NOT NULL DEFAULT 12, am_pm text NOT NULL DEFAULT 'AM', recorded_by text NOT NULL DEFAULT '', FOREIGN KEY(household_id,medicine_id) REFERENCES public.medicines(household_id,id) ON DELETE RESTRICT
);
CREATE INDEX medicine_logs_household ON public.medicine_logs(household_id,date);
CREATE TABLE public.appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 date date NOT NULL, time text NOT NULL DEFAULT '09:00', doctor_name text NOT NULL, address text DEFAULT '', reason text NOT NULL, description text DEFAULT ''
);
CREATE INDEX appointments_household ON public.appointments(household_id,date);
CREATE TABLE public.hospital_stays (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 person_name text NOT NULL, date date NOT NULL, start_hour integer NOT NULL, end_hour integer NOT NULL, is_unavailable boolean NOT NULL DEFAULT false
);
CREATE INDEX hospital_stays_household ON public.hospital_stays(household_id,date);
CREATE TABLE public.custom_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 name text NOT NULL, unit text NOT NULL DEFAULT '', color text NOT NULL DEFAULT 'bg-gray-500', default_value numeric NOT NULL DEFAULT 1, show_graph boolean NOT NULL DEFAULT false, UNIQUE(household_id,id)
);
CREATE INDEX custom_actions_household ON public.custom_actions(household_id);
CREATE TABLE public.custom_action_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 action_id uuid NOT NULL, value numeric NOT NULL DEFAULT 0, date date NOT NULL, recorded_by text NOT NULL DEFAULT '', hour integer NOT NULL DEFAULT 12, am_pm text NOT NULL DEFAULT 'AM', FOREIGN KEY(household_id,action_id) REFERENCES public.custom_actions(household_id,id) ON DELETE RESTRICT
);
CREATE INDEX custom_action_logs_household ON public.custom_action_logs(household_id,date);
CREATE TABLE public.bp_readings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 date date NOT NULL, systolic integer NOT NULL, diastolic integer NOT NULL, recorded_by text NOT NULL DEFAULT ''
);
CREATE INDEX bp_readings_household ON public.bp_readings(household_id,date);
CREATE TABLE public.written_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 date text NOT NULL DEFAULT to_char(now(),'YYYY-MM-DD'), title text, content text NOT NULL, recorded_by text NOT NULL DEFAULT ''
);
CREATE INDEX written_notes_household ON public.written_notes(household_id,date);
CREATE TABLE public.audio_transcripts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 caregiver_id uuid, FOREIGN KEY(household_id,caregiver_id) REFERENCES public.caregivers(household_id,id),
 date text NOT NULL, title text, audio_path text, transcript text NOT NULL, summary text NOT NULL, action_items jsonb NOT NULL DEFAULT '[]', follow_ups jsonb NOT NULL DEFAULT '[]', recorded_by text NOT NULL DEFAULT ''
);
CREATE INDEX audio_transcripts_household ON public.audio_transcripts(household_id,date);

