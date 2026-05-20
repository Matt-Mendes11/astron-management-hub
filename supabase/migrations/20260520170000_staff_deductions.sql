-- Staff deductions tracking template: weekly grouped ledger
-- Run in Supabase SQL Editor, then reload API schema.

CREATE TABLE IF NOT EXISTS public.staff_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  week_starting date NOT NULL,
  staff_id uuid REFERENCES public.staff_profiles (id) ON DELETE SET NULL,
  staff_name text,
  due_amount numeric(12, 2),
  payment_amount numeric(12, 2),
  is_paid boolean NOT NULL DEFAULT false,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_deductions_store_week_idx
  ON public.staff_deductions (store_name, week_starting DESC, created_at);

CREATE INDEX IF NOT EXISTS staff_deductions_staff_id_idx
  ON public.staff_deductions (staff_id);

ALTER TABLE public.staff_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_deductions_all" ON public.staff_deductions;
CREATE POLICY "staff_deductions_all" ON public.staff_deductions
  FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
