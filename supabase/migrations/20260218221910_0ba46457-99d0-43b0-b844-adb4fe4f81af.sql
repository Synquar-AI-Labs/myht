
CREATE TABLE public.hospital_stays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_name text NOT NULL,
  date date NOT NULL,
  start_hour integer NOT NULL,
  end_hour integer NOT NULL,
  is_unavailable boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_stays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hospital_stays"
  ON public.hospital_stays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert hospital_stays"
  ON public.hospital_stays FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hospital_stays"
  ON public.hospital_stays FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete hospital_stays"
  ON public.hospital_stays FOR DELETE
  TO authenticated
  USING (true);
