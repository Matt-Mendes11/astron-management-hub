-- Daily checklist audit: per-store question templates + response rows
-- Run in Supabase SQL Editor, then reload API schema.

CREATE TABLE IF NOT EXISTS public.checklist_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  category text NOT NULL,
  question_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checklist_templates_store_active_idx
  ON public.checklist_question_templates (store_name, is_active, category, sort_order);

ALTER TABLE public.daily_checklists
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS completed_by text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL,
  question_id uuid,
  category text NOT NULL,
  question_text text NOT NULL,
  answer boolean NOT NULL,
  remediation_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checklist_responses_checklist_idx
  ON public.checklist_responses (checklist_id);

ALTER TABLE public.checklist_question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_question_templates_all" ON public.checklist_question_templates;
CREATE POLICY "checklist_question_templates_all" ON public.checklist_question_templates
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "checklist_responses_all" ON public.checklist_responses;
CREATE POLICY "checklist_responses_all" ON public.checklist_responses
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
