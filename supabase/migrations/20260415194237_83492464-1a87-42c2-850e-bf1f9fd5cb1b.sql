
-- Table to define custom quick actions
CREATE TABLE public.custom_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'bg-gray-500',
  default_value numeric NOT NULL DEFAULT 1,
  show_graph boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read custom_actions" ON public.custom_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert custom_actions" ON public.custom_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update custom_actions" ON public.custom_actions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete custom_actions" ON public.custom_actions FOR DELETE TO authenticated USING (true);

-- Table to log entries for custom actions
CREATE TABLE public.custom_action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES public.custom_actions(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  date date NOT NULL,
  recorded_by text NOT NULL DEFAULT '',
  hour integer NOT NULL DEFAULT 12,
  am_pm text NOT NULL DEFAULT 'AM',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read custom_action_logs" ON public.custom_action_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert custom_action_logs" ON public.custom_action_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete custom_action_logs" ON public.custom_action_logs FOR DELETE TO authenticated USING (true);
