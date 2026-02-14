
-- Create audio_transcripts table
CREATE TABLE public.audio_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL,
  title text,
  audio_url text,
  transcript text NOT NULL,
  summary text NOT NULL,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audio_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS policies (shared access model - all authenticated users)
CREATE POLICY "Authenticated users can view transcripts"
  ON public.audio_transcripts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transcripts"
  ON public.audio_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transcripts"
  ON public.audio_transcripts FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio-files');

CREATE POLICY "Authenticated users can read audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio-files');

CREATE POLICY "Authenticated users can delete audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio-files');
