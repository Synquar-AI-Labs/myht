
-- Create medicines master list
CREATE TABLE public.medicines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read medicines" ON public.medicines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert medicines" ON public.medicines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update medicines" ON public.medicines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete medicines" ON public.medicines FOR DELETE TO authenticated USING (true);

-- Create medicine_logs table
CREATE TABLE public.medicine_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  hour INTEGER NOT NULL DEFAULT 12,
  am_pm TEXT NOT NULL DEFAULT 'AM',
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medicine_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read medicine_logs" ON public.medicine_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert medicine_logs" ON public.medicine_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update medicine_logs" ON public.medicine_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete medicine_logs" ON public.medicine_logs FOR DELETE TO authenticated USING (true);

-- Seed medicines
INSERT INTO public.medicines (name, schedule_note) VALUES
  ('Acetaminophen 325mg', 'Pain as needed'),
  ('Apixaban 5mg (Blood thinner)', 'Day and Night'),
  ('Apo-Levothyroxine 75mcg (Thyroid)', 'Day'),
  ('Cotazym 85000U', 'As needed'),
  ('Hydromorphone 1mg', 'As needed'),
  ('Hydromorphone 3mg', 'As needed'),
  ('Jamp-Senna 8.6mg Sennosides', 'Day + Night'),
  ('Jardiance 10mg', 'Night'),
  ('Metoclopramide', 'As needed (6hr, max 4/day)'),
  ('Olanzapine 2.5mg', 'As needed (6hr, max 4/day)'),
  ('Ondansetron 8mg', 'As needed'),
  ('Pregabalin 25mg', 'Night'),
  ('Pregabalin 50mg', 'Day'),
  ('Pregabalin 75mg', 'Night'),
  ('Ramipril 10mg (Blood Pressure)', 'Day'),
  ('Taro-Docusate 100mg', 'Day + Night'),
  ('Teva-Loperamide 2mg', 'Diarrhea as needed'),
  ('Trajenta 5mg', 'Night');
