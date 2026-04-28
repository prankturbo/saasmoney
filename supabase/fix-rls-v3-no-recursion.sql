-- ============================================
-- FIX RLS V3 - SUPPRIMER LA RÉCURSION PROFILES <-> STUDENTS
-- ============================================
-- Objectif: corriger l'erreur PostgREST 42P17 due à des policies récursives
-- Exécuter ce script dans Supabase SQL Editor
-- ============================================

BEGIN;

-- Assurer RLS active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 1) Nettoyage policies profiles existantes (anciens noms inclus)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view user profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Closers can view their students profiles" ON public.profiles;

-- 2) Policies profiles non récursives
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;

-- 3) Vérification immédiate
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles', 'students')
ORDER BY tablename, policyname;