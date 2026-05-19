-- Per-store, per-assessment-type question templates for deep site assessments
-- Run in Supabase SQL Editor, then reload API schema.

CREATE TABLE IF NOT EXISTS public.assessment_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  assessment_key text NOT NULL,
  question_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_templates_store_type_active_idx
  ON public.assessment_question_templates (store_name, assessment_key, is_active, sort_order);

ALTER TABLE public.assessment_question_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessment_question_templates_all" ON public.assessment_question_templates;
CREATE POLICY "assessment_question_templates_all" ON public.assessment_question_templates
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
