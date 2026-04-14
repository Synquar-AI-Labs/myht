CREATE TABLE public.written_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  title TEXT,
  content TEXT NOT NULL,
  recorded_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.written_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to written_notes"
ON public.written_notes
FOR ALL
USING (true)
WITH CHECK (true);