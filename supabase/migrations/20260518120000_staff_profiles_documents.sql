-- Staff profiles: extended HR fields, document metadata, and storage bucket
-- Run in Supabase Dashboard → SQL Editor (New query) → Run, then reload API schema.

-- Extended profile columns (safe if already applied)
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS training_status text DEFAULT 'Pending';

-- Drop old check if re-running, then re-add
ALTER TABLE public.staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_training_status_check;
ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_training_status_check
  CHECK (training_status IS NULL OR training_status IN ('Pending', 'In Progress', 'Certified'));

CREATE TABLE IF NOT EXISTS public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_profiles (id) ON DELETE CASCADE,
  store_name text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_documents_staff_id_idx
  ON public.staff_documents (staff_id, uploaded_at DESC);

ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_documents_all" ON public.staff_documents;
CREATE POLICY "staff_documents_all" ON public.staff_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-documents',
  'staff-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "staff_documents_storage_select" ON storage.objects;
CREATE POLICY "staff_documents_storage_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'staff-documents');

DROP POLICY IF EXISTS "staff_documents_storage_insert" ON storage.objects;
CREATE POLICY "staff_documents_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'staff-documents');

DROP POLICY IF EXISTS "staff_documents_storage_delete" ON storage.objects;
CREATE POLICY "staff_documents_storage_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'staff-documents');

-- Refresh PostgREST schema cache (fixes "Could not find table in schema cache")
NOTIFY pgrst, 'reload schema';
