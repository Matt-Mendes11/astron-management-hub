-- Leadership Diary: daily manager log entries (separate from notices)
-- Run in Supabase SQL Editor, then reload API schema.

CREATE TABLE IF NOT EXISTS public.leadership_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id text NOT NULL,
  entry_date date NOT NULL DEFAULT (CURRENT_DATE),
  category text NOT NULL CHECK (
    category IN ('shift_handover', 'team_commentary', 'operational_note')
  ),
  content text NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leadership_diary_branch_date_idx
  ON public.leadership_diary_entries (branch_id, entry_date DESC, created_at DESC);

ALTER TABLE public.leadership_diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leadership_diary_all" ON public.leadership_diary_entries;
CREATE POLICY "leadership_diary_all" ON public.leadership_diary_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
