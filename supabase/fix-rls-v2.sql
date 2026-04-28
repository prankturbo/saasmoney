-- ============================================
-- FIX RLS V2 - SOLUTION DÉFINITIVE
-- ============================================
-- Le problème: récursion dans les policies
-- Solution: policies simples sans sous-requêtes sur profiles
-- ============================================

-- 1. Supprimer TOUTES les policies existantes sur profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "allow_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view user profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coaches can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Closers can view their students profiles" ON public.profiles;

-- 2. Créer UNE SEULE policy simple pour SELECT
-- Tout utilisateur connecté peut voir tous les profils (nécessaire pour l'app)
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Policy pour UPDATE - seulement son propre profil
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Vérifier que RLS est activé
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Vérification finale
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles', 'students')
ORDER BY tablename, policyname;
