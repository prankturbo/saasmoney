-- ============================================
-- FIX RLS - INSCRIPTION STUDENT VIA LIEN CLOSER
-- ============================================
-- Exécuter ce script dans Supabase SQL Editor
-- ============================================

BEGIN;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own student record from invitation" ON public.students;
DROP POLICY IF EXISTS "Users can create initial payment for own student record" ON public.student_payments;

CREATE POLICY "Users can create their own student record from invitation"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.invitation_codes i
      WHERE i.code = invitation_code
        AND i.closer_id = students.closer_id
        AND i.package_type = students.package_type
        AND i.used = TRUE
        AND i.used_by = auth.uid()
    )
  );

CREATE POLICY "Users can create initial payment for own student record"
  ON public.student_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_payments.student_id
        AND s.user_id = auth.uid()
    )
  );

COMMIT;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('students', 'student_payments')
ORDER BY tablename, policyname;
