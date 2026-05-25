CREATE OR REPLACE FUNCTION public.update_reservation_objective(p_id uuid, p_objective text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_objective IS NULL OR length(btrim(p_objective)) = 0 THEN
    RAISE EXCEPTION 'Objective cannot be empty';
  END IF;

  IF length(p_objective) > 500 THEN
    RAISE EXCEPTION 'Objective too long (max 500)';
  END IF;

  SELECT teacher_id, status INTO v_owner, v_status
  FROM public.reservations
  WHERE id = p_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Cannot edit this reservation';
  END IF;

  UPDATE public.reservations
  SET class_objective = btrim(p_objective),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_reservation_objective(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_reservation_objective(uuid, text) TO authenticated;