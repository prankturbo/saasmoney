-- ============================================
-- ENABLE REALTIME - CONVERSATIONS REMBOURSEMENT
-- ============================================
-- Exécuter ce script dans Supabase SQL Editor, ou activer ces tables
-- depuis Dashboard > Database > Replication.
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_messages;
