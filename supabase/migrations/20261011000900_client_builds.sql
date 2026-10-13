-- Global release hints, not medical/household data; clients can only read.
CREATE TABLE public.client_builds (
  platform text PRIMARY KEY CHECK (platform IN ('ios', 'android')),
  min_build integer NOT NULL DEFAULT 0 CHECK (min_build >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_builds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_builds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_builds TO authenticated;
CREATE POLICY client_builds_read ON public.client_builds FOR SELECT TO authenticated USING (true);
INSERT INTO public.client_builds(platform) VALUES ('ios'), ('android');
