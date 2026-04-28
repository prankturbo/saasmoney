-- ============================================
-- SAAS MONEY - ALL IN ONE REFUND SYSTEM UPDATE
-- ============================================
-- Exécute ce script une seule fois dans Supabase SQL Editor
-- Objectif: remettre à niveau profiles + refund_conversations + refund_messages
-- et corriger les politiques RLS en une exécution.
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1) Profiles: base minimale + trigger + backfill
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

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, coins_balance, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, NEW.id::text), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    0,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, name, role, coins_balance, created_at, updated_at)
SELECT
  au.id,
  au.email,
  split_part(au.email, '@', 1),
  'user',
  0,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
WHERE au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- 2) Refund tables: création/mise à niveau
-- ============================================

CREATE TABLE IF NOT EXISTS public.refund_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  acceptance_status TEXT NOT NULL DEFAULT 'pending',
  ai_handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refund_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.refund_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.refund_conversations
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_status TEXT,
  ADD COLUMN IF NOT EXISTS ai_handled BOOLEAN,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.refund_messages
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.refund_conversations
SET
  status = COALESCE(status, 'open'),
  acceptance_status = COALESCE(acceptance_status, 'pending'),
  ai_handled = COALESCE(ai_handled, false),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

UPDATE public.refund_messages
SET created_at = COALESCE(created_at, NOW());

ALTER TABLE public.refund_conversations
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN acceptance_status SET DEFAULT 'pending',
  ALTER COLUMN ai_handled SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.refund_messages
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.refund_conversations
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN acceptance_status SET NOT NULL,
  ALTER COLUMN ai_handled SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.refund_messages
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.refund_conversations
  DROP CONSTRAINT IF EXISTS refund_conversations_status_check,
  DROP CONSTRAINT IF EXISTS refund_conversations_acceptance_status_check;

ALTER TABLE public.refund_conversations
  ADD CONSTRAINT refund_conversations_status_check
  CHECK (status IN ('open', 'resolved', 'cancelled')),
  ADD CONSTRAINT refund_conversations_acceptance_status_check
  CHECK (acceptance_status IN ('pending', 'accepted', 'refused'));

CREATE INDEX IF NOT EXISTS idx_refund_conversations_user ON public.refund_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_conversations_status ON public.refund_conversations(status);
CREATE INDEX IF NOT EXISTS idx_refund_messages_conversation ON public.refund_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_refund_messages_user ON public.refund_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_messages_created ON public.refund_messages(created_at);

DROP TRIGGER IF EXISTS update_refund_conversations_updated_at ON public.refund_conversations;
CREATE TRIGGER update_refund_conversations_updated_at
  BEFORE UPDATE ON public.refund_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_refund_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.refund_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refund_message_update_conversation ON public.refund_messages;
CREATE TRIGGER refund_message_update_conversation
  AFTER INSERT ON public.refund_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_refund_conversation_timestamp();

-- ============================================
-- 3) Grants + RLS sur refund
-- ============================================

GRANT SELECT, INSERT, UPDATE ON public.refund_conversations TO authenticated;
GRANT SELECT, INSERT ON public.refund_messages TO authenticated;
GRANT ALL ON public.refund_conversations TO service_role;
GRANT ALL ON public.refund_messages TO service_role;

ALTER TABLE public.refund_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own refund conversations" ON public.refund_conversations;
DROP POLICY IF EXISTS "Users can create their own refund conversations" ON public.refund_conversations;
DROP POLICY IF EXISTS "Admins can update refund conversations" ON public.refund_conversations;

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.refund_messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.refund_messages;
DROP POLICY IF EXISTS "Users can view all messages in their conversations" ON public.refund_messages;
DROP POLICY IF EXISTS "Users and admins can send messages" ON public.refund_messages;

CREATE POLICY "Users can view their own refund conversations"
  ON public.refund_conversations FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach')
    )
  );

CREATE POLICY "Users can create their own refund conversations"
  ON public.refund_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update refund conversations"
  ON public.refund_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can view all messages in their conversations"
  ON public.refund_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.refund_conversations rc
      WHERE rc.id = refund_messages.conversation_id
        AND rc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach')
    )
  );

CREATE POLICY "Users and admins can send messages"
  ON public.refund_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.refund_conversations rc
      WHERE rc.id = refund_messages.conversation_id
        AND rc.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach')
    )
  );

COMMIT;

-- ============================================
-- 4) Vérifications rapides
-- ============================================

SELECT 'refund_conversations' AS table_name, COUNT(*) AS row_count FROM public.refund_conversations
UNION ALL
SELECT 'refund_messages' AS table_name, COUNT(*) AS row_count FROM public.refund_messages
UNION ALL
SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM public.profiles;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'refund_conversations'
ORDER BY ordinal_position;

SELECT
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('refund_conversations', 'refund_messages')
ORDER BY tablename, policyname;
