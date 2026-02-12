
ALTER TABLE public.health_records ADD COLUMN flush_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.health_records ADD COLUMN misc_notes text NOT NULL DEFAULT '';
