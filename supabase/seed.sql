-- Local-development seed — SYNTHETIC data only. This file is applied by the
-- Supabase CLI to the LOCAL stack (supabase start / db reset); it is never
-- pushed to a remote project. Nothing here may resemble real family data.

-- Synthetic allowlist entry only; an unbound email grants nothing.
-- Create the local test user first, then bind it using the repair statement
-- in scripts/emergency/allowlist-repair.sql with smoke-test@example.local.
INSERT INTO public.app_allowlist (email, note)
VALUES ('smoke-test@example.local', 'local smoke testing only')
ON CONFLICT (email) DO NOTHING;

-- Fictional medicines exercising the three schedule shapes the app handles:
-- twice-daily, once-daily, and as-needed.
INSERT INTO public.medicines (name, potency, amount, med_type, category, schedule_time, frequency, schedule_note, show_in_quick_log)
VALUES
  ('Testophen',   '500mg', '2 pills', 'Pain Relief', 'medicine', '9:00 AM / 9:00 PM', 'daily',     'synthetic', true),
  ('Examprazole', '20mg',  '1 pill',  'Digestive',   'medicine', '8:00 AM',           'daily',     'synthetic', true),
  ('Placebonol',  '10mg',  '1 pill',  'Other',       'medicine', '',                  'as needed', 'synthetic', true);
