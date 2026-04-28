-- ============================================
-- MIGRATION: AJOUT DU RÔLE COACH
-- ============================================
-- À exécuter dans Supabase SQL Editor

-- 1. Mettre à jour la contrainte de rôle pour inclure 'coach'
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'coach'));

-- 2. Ajouter coach_id aux one_of_one_slots
ALTER TABLE public.one_of_one_slots 
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id);

-- 3. Ajouter coach_id aux hotset_slots  
ALTER TABLE public.hotset_slots 
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id);

-- 4. Supprimer les anciennes policies pour les recréer
DROP POLICY IF EXISTS "Admins can manage slots" ON public.one_of_one_slots;
DROP POLICY IF EXISTS "Admins can manage slots" ON public.hotset_slots;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.one_of_one_bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.hotset_bookings;

-- 5. Nouvelles policies pour one_of_one_slots
CREATE POLICY "Coaches and admins can manage slots" ON public.one_of_one_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "Coaches can manage their own slots" ON public.one_of_one_slots
  FOR ALL USING (coach_id = auth.uid());

-- 6. Nouvelles policies pour hotset_slots
CREATE POLICY "Coaches and admins can manage hotset slots" ON public.hotset_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

CREATE POLICY "Coaches can manage their own hotset slots" ON public.hotset_slots
  FOR ALL USING (coach_id = auth.uid());

-- 7. Policies pour voir les réservations (one_of_one)
CREATE POLICY "Coaches can view bookings on their slots" ON public.one_of_one_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.one_of_one_slots 
      WHERE id = one_of_one_bookings.slot_id AND coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins and coaches can view all bookings" ON public.one_of_one_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- 8. Policies pour voir les réservations (hotset)
CREATE POLICY "Coaches can view hotset bookings on their slots" ON public.hotset_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hotset_slots 
      WHERE id = hotset_bookings.slot_id AND coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins and coaches can view all hotset bookings" ON public.hotset_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- 9. Policy profiles centralisée ailleurs (évite la récursion RLS)
-- Ne pas recréer ici de policy SELECT sur public.profiles

-- 10. Policy pour que les coachs puissent modifier le statut des réservations
CREATE POLICY "Coaches can update booking status" ON public.one_of_one_bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.one_of_one_slots 
      WHERE id = one_of_one_bookings.slot_id AND coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update hotset booking status" ON public.hotset_bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.hotset_slots 
      WHERE id = hotset_bookings.slot_id AND coach_id = auth.uid()
    )
  );

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

