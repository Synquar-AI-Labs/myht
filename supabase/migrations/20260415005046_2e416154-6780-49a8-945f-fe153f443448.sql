
CREATE TABLE public.bp_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  systolic integer NOT NULL,
  diastolic integer NOT NULL,
  recorded_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bp_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bp_readings" ON public.bp_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert bp_readings" ON public.bp_readings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete bp_readings" ON public.bp_readings FOR DELETE TO authenticated USING (true);
