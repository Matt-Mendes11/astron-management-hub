-- Repairs & Maintenance: run in Supabase SQL Editor or via supabase db push
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  equipment_name text NOT NULL,
  issue_description text NOT NULL,
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High')),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fixed')),
  reported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_logs_store_status_priority_idx
  ON public.maintenance_logs (store_name, status, priority);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Adjust to your security model: full access for the portal anon key (match other app tables)
CREATE POLICY "maintenance_logs_all" ON public.maintenance_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
