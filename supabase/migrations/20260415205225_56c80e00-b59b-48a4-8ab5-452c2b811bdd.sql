
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS potency text NOT NULL DEFAULT '';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS amount text NOT NULL DEFAULT '';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS med_type text NOT NULL DEFAULT '';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'medicine';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS schedule_time text NOT NULL DEFAULT '';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily';
