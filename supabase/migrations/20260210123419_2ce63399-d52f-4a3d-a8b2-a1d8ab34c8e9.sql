
-- Drop all existing overly permissive policies
DROP POLICY IF EXISTS "Public delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public update appointments" ON public.appointments;

DROP POLICY IF EXISTS "Public delete health_records" ON public.health_records;
DROP POLICY IF EXISTS "Public insert health_records" ON public.health_records;
DROP POLICY IF EXISTS "Public read health_records" ON public.health_records;
DROP POLICY IF EXISTS "Public update health_records" ON public.health_records;

DROP POLICY IF EXISTS "Public delete reminder_settings" ON public.reminder_settings;
DROP POLICY IF EXISTS "Public insert reminder_settings" ON public.reminder_settings;
DROP POLICY IF EXISTS "Public read reminder_settings" ON public.reminder_settings;
DROP POLICY IF EXISTS "Public update reminder_settings" ON public.reminder_settings;

-- Create auth-restricted policies for appointments
CREATE POLICY "Authenticated users can read appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete appointments"
  ON public.appointments FOR DELETE
  TO authenticated
  USING (true);

-- Create auth-restricted policies for health_records
CREATE POLICY "Authenticated users can read health_records"
  ON public.health_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert health_records"
  ON public.health_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update health_records"
  ON public.health_records FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete health_records"
  ON public.health_records FOR DELETE
  TO authenticated
  USING (true);

-- Create auth-restricted policies for reminder_settings
CREATE POLICY "Authenticated users can read reminder_settings"
  ON public.reminder_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reminder_settings"
  ON public.reminder_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reminder_settings"
  ON public.reminder_settings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete reminder_settings"
  ON public.reminder_settings FOR DELETE
  TO authenticated
  USING (true);

-- Allow service_role access for edge functions (send-reminders)
CREATE POLICY "Service role can read all appointments"
  ON public.appointments FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can read all health_records"
  ON public.health_records FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can read all reminder_settings"
  ON public.reminder_settings FOR SELECT
  TO service_role
  USING (true);
