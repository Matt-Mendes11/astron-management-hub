-- Customer account payment schedule: monthly handwritten-style ledger
-- Run in Supabase SQL Editor, then reload API schema.

CREATE TABLE IF NOT EXISTS public.customer_account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  month_year text NOT NULL,
  account_name text,
  amount_paid numeric(12, 2),
  date_paid date,
  recorded_by text,
  schedule_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_account_payments_store_month_idx
  ON public.customer_account_payments (store_name, month_year, created_at);

ALTER TABLE public.customer_account_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_account_payments_all" ON public.customer_account_payments;
CREATE POLICY "customer_account_payments_all" ON public.customer_account_payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
