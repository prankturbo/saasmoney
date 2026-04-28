-- ============================================
-- SAAS MONEY - SCHEMA SUPABASE COMPLET
-- ============================================
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: profiles
-- Profils utilisateurs (liés à auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'coach', 'closer')),
  coins_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches par role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: invitation_codes
-- Codes d'invitation générés par les closers
-- ============================================
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  closer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('700', '3000', '5000', '15000')),
  coins_amount INTEGER NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_invitation_codes_closer ON public.invitation_codes(closer_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes(code);

-- ============================================
-- TABLE: students
-- Enregistrements des élèves (suivi par closers)
-- ============================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL REFERENCES public.profiles(id),
  package_type TEXT NOT NULL CHECK (package_type IN ('700', '3000', '5000', '15000')),
  invitation_code TEXT NOT NULL,
  -- Paiements
  total_price INTEGER NOT NULL,
  total_paid INTEGER NOT NULL DEFAULT 0,
  -- Coins
  total_coins INTEGER NOT NULL DEFAULT 0,
  coins_unlocked INTEGER NOT NULL DEFAULT 0,
  coins_available INTEGER NOT NULL DEFAULT 0,
  -- One to One
  one_to_one_count INTEGER NOT NULL DEFAULT 0,
  -- Hot-Seats
  hotseats_total INTEGER, -- NULL = illimité
  hotseats_per_week BOOLEAN NOT NULL DEFAULT FALSE,
  hotseats_duration TEXT, -- "3 mois", "12 mois", "à vie"
  hotseats_used INTEGER NOT NULL DEFAULT 0,
  last_hotseat_booking TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_students_closer ON public.students(closer_id);
CREATE INDEX IF NOT EXISTS idx_students_user ON public.students(user_id);

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: student_payments
-- Historique des paiements des élèves
-- ============================================
CREATE TABLE IF NOT EXISTS public.student_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  coins_unlocked INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_payments_student ON public.student_payments(student_id);

-- ============================================
-- TABLE: one_of_one_slots
-- Créneaux One of One des coachs
-- ============================================
CREATE TABLE IF NOT EXISTS public.one_of_one_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  meeting_link TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_one_of_one_slots_coach ON public.one_of_one_slots(coach_id);
CREATE INDEX IF NOT EXISTS idx_one_of_one_slots_date ON public.one_of_one_slots(date);
CREATE INDEX IF NOT EXISTS idx_one_of_one_slots_available ON public.one_of_one_slots(is_available);

-- ============================================
-- TABLE: one_of_one_bookings
-- Réservations One of One
-- ============================================
CREATE TABLE IF NOT EXISTS public.one_of_one_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES public.one_of_one_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins_spent INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_one_of_one_bookings_user ON public.one_of_one_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_one_of_one_bookings_slot ON public.one_of_one_bookings(slot_id);

-- ============================================
-- TABLE: hotset_types
-- Types de Hot-Seats disponibles
-- ============================================
CREATE TABLE IF NOT EXISTS public.hotset_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: hotset_slots
-- Créneaux Hot-Seat des coachs
-- ============================================
CREATE TABLE IF NOT EXISTS public.hotset_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type_id UUID REFERENCES public.hotset_types(id) ON DELETE CASCADE, -- Nullable pour nouveau système simplifié
  date TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL DEFAULT 15, -- Durée fixe à 15 minutes pour tous les Hot-Seats
  meeting_link TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotset_slots_coach ON public.hotset_slots(coach_id);
CREATE INDEX IF NOT EXISTS idx_hotset_slots_type ON public.hotset_slots(type_id);
CREATE INDEX IF NOT EXISTS idx_hotset_slots_date ON public.hotset_slots(date);

-- ============================================
-- TABLE: hotset_bookings
-- Réservations Hot-Seat
-- ============================================
CREATE TABLE IF NOT EXISTS public.hotset_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES public.hotset_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotset_bookings_user ON public.hotset_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_hotset_bookings_slot ON public.hotset_bookings(slot_id);

-- ============================================
-- TABLE: conversations
-- Conversations avec l'IA SaaS Money
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  mode TEXT NOT NULL DEFAULT 'coach' CHECK (mode IN ('coach', 'growth', 'produit', 'copywriting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: messages
-- Messages dans les conversations
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

-- ============================================
-- TABLE: refund_conversations
-- Conversations de remboursement
-- ============================================
CREATE TABLE IF NOT EXISTS public.refund_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_conversations_user ON public.refund_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_conversations_status ON public.refund_conversations(status);

-- ============================================
-- TABLE: refund_messages
-- Messages des conversations de remboursement
-- ============================================
CREATE TABLE IF NOT EXISTS public.refund_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.refund_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_messages_conversation ON public.refund_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_refund_messages_user ON public.refund_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_messages_created ON public.refund_messages(created_at);

-- ============================================
-- TABLE: app_settings
-- Paramètres globaux de l'application
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  one_of_one_cost INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer les paramètres par défaut
INSERT INTO public.app_settings (one_of_one_cost) VALUES (1000)
ON CONFLICT DO NOTHING;

-- ============================================
-- FONCTIONS RPC
-- ============================================

-- Fonction pour débiter des coins
CREATE OR REPLACE FUNCTION debit_coins(user_uuid UUID, amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT coins_balance INTO current_balance FROM public.profiles WHERE id = user_uuid;
  
  IF current_balance >= amount THEN
    UPDATE public.profiles SET coins_balance = coins_balance - amount WHERE id = user_uuid;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créditer des coins
CREATE OR REPLACE FUNCTION credit_coins(user_uuid UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles SET coins_balance = coins_balance + amount WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour débloquer des coins pour un étudiant
CREATE OR REPLACE FUNCTION unlock_student_coins(
  p_student_id UUID,
  p_amount INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_student students%ROWTYPE;
  v_coins_to_unlock INTEGER;
  v_remaining_to_pay INTEGER;
BEGIN
  -- Récupérer l'étudiant
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Vérifier qu'il y a un montant à payer
  v_remaining_to_pay := v_student.total_price - v_student.total_paid;
  IF v_remaining_to_pay <= 0 THEN
    RETURN FALSE; -- Déjà payé en totalité
  END IF;
  
  -- Ne pas autoriser un paiement supérieur au restant dû
  IF p_amount > v_remaining_to_pay THEN
    RETURN FALSE;
  END IF;
  
  -- Calculer les coins à débloquer (max = total - déjà débloqués)
  -- Peut être 0 pour les offres sans coins (3000€)
  v_coins_to_unlock := LEAST(p_amount, GREATEST(0, v_student.total_coins - v_student.coins_unlocked));
  
  -- Mettre à jour l'étudiant
  UPDATE public.students 
  SET 
    total_paid = total_paid + p_amount,
    coins_unlocked = coins_unlocked + v_coins_to_unlock,
    coins_available = coins_available + v_coins_to_unlock,
    updated_at = NOW()
  WHERE id = p_student_id;
  
  -- Mettre à jour le profil (coins_balance) seulement s'il y a des coins
  IF v_coins_to_unlock > 0 THEN
    UPDATE public.profiles 
    SET coins_balance = coins_balance + v_coins_to_unlock
    WHERE id = v_student.user_id;
  END IF;
  
  -- Enregistrer le paiement
  INSERT INTO public.student_payments (student_id, amount, coins_unlocked, note)
  VALUES (p_student_id, p_amount, v_coins_to_unlock, COALESCE(p_note, 'Paiement de ' || p_amount || '€'));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_of_one_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_of_one_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotset_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotset_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: profiles
-- ============================================
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- POLICIES: invitation_codes
-- ============================================
CREATE POLICY "Closers can create invitation codes"
  ON public.invitation_codes FOR INSERT
  WITH CHECK (
    closer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('closer', 'admin'))
  );

CREATE POLICY "Closers can view their own codes"
  ON public.invitation_codes FOR SELECT
  USING (closer_id = auth.uid());

CREATE POLICY "Admins can view all codes"
  ON public.invitation_codes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read invitation codes for registration"
  ON public.invitation_codes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can use an invitation code"
  ON public.invitation_codes FOR UPDATE
  USING (used = FALSE)
  WITH CHECK (used = TRUE);

-- ============================================
-- POLICIES: students
-- ============================================
CREATE POLICY "Closers can view their students"
  ON public.students FOR SELECT
  USING (closer_id = auth.uid());

CREATE POLICY "Users can view their own student record"
  ON public.students FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all students"
  ON public.students FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Closers can update their students"
  ON public.students FOR UPDATE
  USING (closer_id = auth.uid());

-- ============================================
-- POLICIES: student_payments
-- ============================================
CREATE POLICY "Closers can manage payments for their students"
  ON public.student_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s 
      WHERE s.id = student_payments.student_id 
      AND s.closer_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own payments"
  ON public.student_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s 
      WHERE s.id = student_payments.student_id 
      AND s.user_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES: one_of_one_slots
-- ============================================
CREATE POLICY "Everyone can view available slots"
  ON public.one_of_one_slots FOR SELECT
  USING (TRUE);

CREATE POLICY "Coaches can create slots"
  ON public.one_of_one_slots FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
    AND coach_id = auth.uid()
  );

CREATE POLICY "Coaches can update their own slots"
  ON public.one_of_one_slots FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their own slots"
  ON public.one_of_one_slots FOR DELETE
  USING (coach_id = auth.uid());

-- ============================================
-- POLICIES: one_of_one_bookings
-- ============================================
CREATE POLICY "Users can create bookings"
  ON public.one_of_one_bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own bookings"
  ON public.one_of_one_bookings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Coaches can view bookings for their slots"
  ON public.one_of_one_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.one_of_one_slots s 
      WHERE s.id = one_of_one_bookings.slot_id 
      AND s.coach_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES: hotset_types
-- ============================================
CREATE POLICY "Everyone can view hotset types"
  ON public.hotset_types FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage hotset types"
  ON public.hotset_types FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- POLICIES: hotset_slots
-- ============================================
CREATE POLICY "Everyone can view available hotset slots"
  ON public.hotset_slots FOR SELECT
  USING (TRUE);

CREATE POLICY "Coaches can create hotset slots"
  ON public.hotset_slots FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
    AND coach_id = auth.uid()
  );

CREATE POLICY "Coaches can update their own hotset slots"
  ON public.hotset_slots FOR UPDATE
  USING (coach_id = auth.uid());

-- ============================================
-- POLICIES: hotset_bookings
-- ============================================
CREATE POLICY "Users can create hotset bookings"
  ON public.hotset_bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own hotset bookings"
  ON public.hotset_bookings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Coaches can view bookings for their slots"
  ON public.hotset_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotset_slots s 
      WHERE s.id = hotset_bookings.slot_id 
      AND s.coach_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES: conversations & messages
-- ============================================
CREATE POLICY "Users can manage their own conversations"
  ON public.conversations FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage messages in their conversations"
  ON public.messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = messages.conversation_id 
      AND c.user_id = auth.uid()
    )
  );

-- ============================================
-- POLICIES: app_settings
-- ============================================
CREATE POLICY "Everyone can view app settings"
  ON public.app_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TRIGGER: Créer un profil automatiquement à l'inscription
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, coins_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- DONNÉES INITIALES: Types de Hot-Seat
-- ============================================
INSERT INTO public.hotset_types (name, description, duration, is_active) VALUES
  ('Audit Express', 'Un audit complet de ton SaaS en 20 minutes. Identification des points faibles et recommandations concrètes.', 20, TRUE),
  ('Refonte Offre', 'Restructure ton offre commerciale pour maximiser les conversions. Pricing, packaging, positionnement.', 25, TRUE),
  ('Positionnement', 'Trouve ta niche et différencie-toi. Workshop intensif pour clarifier ton message.', 20, TRUE),
  ('Go-to-Market', 'Stratégie de lancement complète. Canaux, messaging, premiers clients.', 25, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================
-- FIN DU SCHEMA
-- ============================================
