
-- 1) Convert has_role to SECURITY INVOKER (safe: user_roles has RLS allowing self-lookup)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- 2) Drop the SECURITY DEFINER RPC; replace with a policy + trigger guard
DROP FUNCTION IF EXISTS public.update_reservation_objective(uuid, text);

-- Allow teachers to update their own approved reservations (columns restricted by trigger below)
DROP POLICY IF EXISTS "Teachers can update own approved reservations" ON public.reservations;
CREATE POLICY "Teachers can update own approved reservations"
ON public.reservations
FOR UPDATE
TO authenticated
USING (auth.uid() = teacher_id AND status = 'approved')
WITH CHECK (auth.uid() = teacher_id AND status = 'approved');

-- Trigger: teachers may only modify class_objective on approved rows; admins unaffected
CREATE OR REPLACE FUNCTION public.restrict_teacher_reservation_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Admins can modify freely
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'approved' THEN
    IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
      OR NEW.reservation_date IS DISTINCT FROM OLD.reservation_date
      OR NEW.block_start IS DISTINCT FROM OLD.block_start
      OR NEW.block_end IS DISTINCT FROM OLD.block_end
      OR NEW.course_name IS DISTINCT FROM OLD.course_name
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
      OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
      OR NEW.recurrence_group_id IS DISTINCT FROM OLD.recurrence_group_id
      OR NEW.observation IS DISTINCT FROM OLD.observation
    THEN
      RAISE EXCEPTION 'Only the class objective can be modified on approved reservations';
    END IF;

    IF NEW.class_objective IS NULL OR length(btrim(NEW.class_objective)) = 0 THEN
      RAISE EXCEPTION 'Objective cannot be empty';
    END IF;
    IF length(NEW.class_objective) > 500 THEN
      RAISE EXCEPTION 'Objective too long (max 500)';
    END IF;

    NEW.updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_teacher_reservation_updates ON public.reservations;
CREATE TRIGGER trg_restrict_teacher_reservation_updates
BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.restrict_teacher_reservation_updates();
