-- ============================================
-- RPC - ACTIVER UNE INVITATION STUDENT
-- ============================================
-- Exécuter ce script dans Supabase SQL Editor
-- Corrige l'inscription depuis un lien closer en faisant l'opération côté DB.
-- ============================================

CREATE OR REPLACE FUNCTION public.activate_student_invitation(
  p_code TEXT,
  p_user_id UUID
)
RETURNS public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitation_codes%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_price INTEGER;
  v_total_coins INTEGER;
  v_coins_unlocked INTEGER;
  v_one_to_one_count INTEGER;
  v_hotseats_total INTEGER;
  v_hotseats_per_week BOOLEAN;
  v_hotseats_duration TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitation_codes
  WHERE code = UPPER(TRIM(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code invitation introuvable';
  END IF;

  IF v_invitation.used THEN
    RAISE EXCEPTION 'Code invitation déjà utilisé';
  END IF;

  IF EXISTS (SELECT 1 FROM public.students WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Un forfait est déjà activé pour ce compte';
  END IF;

  v_price := v_invitation.package_type::INTEGER;

  CASE v_invitation.package_type
    WHEN '700' THEN
      v_total_coins := 0;
      v_coins_unlocked := 0;
      v_one_to_one_count := 0;
      v_hotseats_total := 1;
      v_hotseats_per_week := FALSE;
      v_hotseats_duration := NULL;
    WHEN '3000' THEN
      v_total_coins := 0;
      v_coins_unlocked := 0;
      v_one_to_one_count := 0;
      v_hotseats_total := 6;
      v_hotseats_per_week := FALSE;
      v_hotseats_duration := '3 mois';
    WHEN '5000' THEN
      v_total_coins := 4000;
      v_coins_unlocked := 0;
      v_one_to_one_count := 8;
      v_hotseats_total := NULL;
      v_hotseats_per_week := TRUE;
      v_hotseats_duration := '6 mois';
    WHEN '15000' THEN
      v_total_coins := 15000;
      v_coins_unlocked := 0;
      v_one_to_one_count := 15;
      v_hotseats_total := NULL;
      v_hotseats_per_week := TRUE;
      v_hotseats_duration := 'à vie';
    ELSE
      RAISE EXCEPTION 'Type de forfait invalide';
  END CASE;

  INSERT INTO public.students (
    user_id,
    closer_id,
    package_type,
    invitation_code,
    total_price,
    total_paid,
    total_coins,
    coins_unlocked,
    coins_available,
    one_to_one_count,
    hotseats_total,
    hotseats_per_week,
    hotseats_duration,
    hotseats_used
  ) VALUES (
    p_user_id,
    v_invitation.closer_id,
    v_invitation.package_type,
    v_invitation.code,
    v_price,
    CASE WHEN v_invitation.package_type IN ('3000', '5000', '15000') THEN 0 ELSE v_price END,
    v_total_coins,
    CASE WHEN v_invitation.package_type IN ('3000', '5000', '15000') THEN 0 ELSE v_coins_unlocked END,
    CASE WHEN v_invitation.package_type IN ('3000', '5000', '15000') THEN 0 ELSE v_coins_unlocked END,
    v_one_to_one_count,
    v_hotseats_total,
    v_hotseats_per_week,
    v_hotseats_duration,
    0
  )
  RETURNING * INTO v_student;

  UPDATE public.invitation_codes
  SET used = TRUE,
      used_by = p_user_id,
      used_at = NOW()
  WHERE id = v_invitation.id;

  IF v_invitation.package_type = '700' AND v_total_coins > 0 THEN
    INSERT INTO public.student_payments (student_id, amount, coins_unlocked, note)
    VALUES (v_student.id, v_price, v_total_coins, 'Paiement initial complet');
  END IF;

  RETURN v_student;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_student_invitation(TEXT, UUID) TO authenticated;
