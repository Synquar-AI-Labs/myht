
ALTER TABLE public.health_records
  ADD COLUMN vomit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN recorded_by text NOT NULL DEFAULT '';
