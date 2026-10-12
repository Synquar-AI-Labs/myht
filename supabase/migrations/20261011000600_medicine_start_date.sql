-- Older interval medicines remain unscheduled until a caregiver picks a start day.
ALTER TABLE public.medicines ADD COLUMN start_date date NULL;
