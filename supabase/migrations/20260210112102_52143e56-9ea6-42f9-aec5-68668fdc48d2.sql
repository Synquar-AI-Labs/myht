
-- Health records table
CREATE TABLE public.health_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  feed_bags INTEGER NOT NULL DEFAULT 0,
  weight NUMERIC(5,1) NOT NULL DEFAULT 0,
  bp_systolic INTEGER NOT NULL DEFAULT 0,
  bp_diastolic INTEGER NOT NULL DEFAULT 0,
  food_taken BOOLEAN NOT NULL DEFAULT false,
  food_description TEXT DEFAULT '',
  stool_passed BOOLEAN NOT NULL DEFAULT false,
  stool_count INTEGER NOT NULL DEFAULT 0,
  vomiting BOOLEAN NOT NULL DEFAULT false,
  constipation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  time TEXT NOT NULL DEFAULT '09:00',
  doctor_name TEXT NOT NULL,
  address TEXT DEFAULT '',
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reminder emails config table (stores the list of emails)
CREATE TABLE public.reminder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  emails TEXT[] NOT NULL DEFAULT '{}',
  daily_reminder_time TEXT NOT NULL DEFAULT '20:00',
  appointment_reminder_days INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required)
CREATE POLICY "Public read health_records" ON public.health_records FOR SELECT USING (true);
CREATE POLICY "Public insert health_records" ON public.health_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update health_records" ON public.health_records FOR UPDATE USING (true);
CREATE POLICY "Public delete health_records" ON public.health_records FOR DELETE USING (true);

CREATE POLICY "Public read appointments" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Public insert appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update appointments" ON public.appointments FOR UPDATE USING (true);
CREATE POLICY "Public delete appointments" ON public.appointments FOR DELETE USING (true);

CREATE POLICY "Public read reminder_settings" ON public.reminder_settings FOR SELECT USING (true);
CREATE POLICY "Public insert reminder_settings" ON public.reminder_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update reminder_settings" ON public.reminder_settings FOR UPDATE USING (true);
CREATE POLICY "Public delete reminder_settings" ON public.reminder_settings FOR DELETE USING (true);

-- Trigger for updated_at on health_records
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_health_records_updated_at
  BEFORE UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminder_settings_updated_at
  BEFORE UPDATE ON public.reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the reminder settings with the family emails
INSERT INTO public.reminder_settings (emails) 
VALUES (ARRAY['umairakbar@gmail.com', 'shahwar@gmail.com', 'affantiger@gmail.com', 'fahadakbar@gmail.com']);
