ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS urine_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS bile_bags integer NOT NULL DEFAULT 0;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS flush_ml integer NOT NULL DEFAULT 0;