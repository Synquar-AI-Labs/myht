-- Existing hour-only dose logs retain their original time.
ALTER TABLE public.medicine_logs
  ADD COLUMN minute smallint NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59);
