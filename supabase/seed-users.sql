-- ============================================
-- SAAS MONEY - CRÉATION DES COMPTES UTILISATEURS
-- ============================================
-- IMPORTANT: Ce script met à jour les rôles des utilisateurs
-- après leur inscription via l'interface Supabase Auth
-- ============================================

-- ============================================
-- ÉTAPE 1: Créer les utilisateurs via Supabase Dashboard
-- ============================================
-- Allez dans Authentication > Users > Invite user
-- Créez ces comptes avec les emails suivants :
--
-- CLOSERS:
--   - clement@saasmoney.fr
--   - elias@saasmoney.fr
--   - leni@saasmoney.fr
--   - tino@saasmoney.fr
--
-- COACHS:
--   - martin@saasmoney.fr
--   - augustin@saasmoney.fr
--
-- ADMINS:
--   - sacha@saasmoney.fr
--   - quentin@saasmoney.fr
-- ============================================

-- ============================================
-- ÉTAPE 2: Exécuter ce script pour mettre à jour les rôles
-- ============================================

-- Mettre à jour les Closers
UPDATE public.profiles SET role = 'closer', name = 'Clément' WHERE email = 'clement@saasmoney.fr';
UPDATE public.profiles SET role = 'closer', name = 'Elias' WHERE email = 'elias@saasmoney.fr';
UPDATE public.profiles SET role = 'closer', name = 'Leni' WHERE email = 'leni@saasmoney.fr';
UPDATE public.profiles SET role = 'closer', name = 'Tino' WHERE email = 'tino@saasmoney.fr';

-- Mettre à jour les Coachs
UPDATE public.profiles SET role = 'coach', name = 'Martin' WHERE email = 'martin@saasmoney.fr';
UPDATE public.profiles SET role = 'coach', name = 'Augustin' WHERE email = 'auguste@saasmoney.fr';

-- Mettre à jour les Admins
UPDATE public.profiles SET role = 'admin', name = 'Sacha' WHERE email = 'sacha@saasmoney.fr';
UPDATE public.profiles SET role = 'admin', name = 'Quentin' WHERE email = 'auguste@saasmoney.fr';

-- Vérification
SELECT email, name, role FROM public.profiles WHERE role IN ('closer', 'coach', 'admin') ORDER BY role, name;
