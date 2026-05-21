-- Fuel planner persistence tables used by /[store]/fuel-management/fuel-plan.

CREATE TABLE IF NOT EXISTS public.atg_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  month_year text NOT NULL,
  dsl_tank1 numeric DEFAULT 0,
  dsl_tank2 numeric DEFAULT 0,
  ulp_tank1 numeric DEFAULT 0,
  ulp_tank2 numeric DEFAULT 0,
  manual_dip_dsl1 numeric DEFAULT 0,
  manual_dip_dsl2 numeric DEFAULT 0,
  manual_dip_ulp1 numeric DEFAULT 0,
  manual_dip_ulp2 numeric DEFAULT 0,
  tank_capacity_dsl1 numeric DEFAULT 30000,
  tank_capacity_dsl2 numeric DEFAULT 30000,
  tank_capacity_ulp1 numeric DEFAULT 30000,
  tank_capacity_ulp2 numeric DEFAULT 30000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_name, month_year)
);

CREATE TABLE IF NOT EXISTS public.site_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  month_year text NOT NULL,
  cost_dsl numeric DEFAULT 0,
  cost_ulp numeric DEFAULT 0,
  retail_dsl numeric DEFAULT 0,
  retail_ulp numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_name, month_year)
);

CREATE TABLE IF NOT EXISTS public.fuel_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  delivery_date date NOT NULL,
  dsl_vol numeric DEFAULT 0,
  ulp_vol numeric DEFAULT 0,
  dsl_invoice numeric DEFAULT 0,
  ulp_invoice numeric DEFAULT 0,
  ref_no text,
  ordered_by text,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fuel_orders_store_delivery_idx
  ON public.fuel_orders (store_name, delivery_date);

CREATE TABLE IF NOT EXISTS public.daily_fuel_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  reading_date date NOT NULL,
  forecast_dsl numeric DEFAULT 0,
  forecast_ulp numeric DEFAULT 0,
  actual_dsl numeric DEFAULT 0,
  actual_ulp numeric DEFAULT 0,
  ordered_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_name, reading_date)
);

-- Bring older/hand-created tables up to the app's canonical shape.
ALTER TABLE public.daily_fuel_metrics
  ADD COLUMN IF NOT EXISTS forecast_dsl numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forecast_ulp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_dsl numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_ulp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordered_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS daily_fuel_metrics_store_date_key
  ON public.daily_fuel_metrics (store_name, reading_date);

CREATE UNIQUE INDEX IF NOT EXISTS atg_readings_store_month_key
  ON public.atg_readings (store_name, month_year);

CREATE UNIQUE INDEX IF NOT EXISTS site_pricing_store_month_key
  ON public.site_pricing (store_name, month_year);

ALTER TABLE public.atg_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_fuel_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atg_readings_all_authenticated" ON public.atg_readings;
CREATE POLICY "atg_readings_all_authenticated" ON public.atg_readings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "site_pricing_all_authenticated" ON public.site_pricing;
CREATE POLICY "site_pricing_all_authenticated" ON public.site_pricing
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fuel_orders_all_authenticated" ON public.fuel_orders;
CREATE POLICY "fuel_orders_all_authenticated" ON public.fuel_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "daily_fuel_metrics_all_authenticated" ON public.daily_fuel_metrics;
CREATE POLICY "daily_fuel_metrics_all_authenticated" ON public.daily_fuel_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
