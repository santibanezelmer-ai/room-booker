-- 1) Private notes table
CREATE TABLE public.reservation_notes (
  reservation_id uuid PRIMARY KEY REFERENCES public.reservations(id) ON DELETE CASCADE,
  observation text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservation_notes TO authenticated;
GRANT ALL ON public.reservation_notes TO service_role;

ALTER TABLE public.reservation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view reservation notes"
ON public.reservation_notes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND r.teacher_id = auth.uid())
);

CREATE POLICY "Owner or admin can insert reservation notes"
ON public.reservation_notes FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND r.teacher_id = auth.uid())
);

CREATE POLICY "Owner or admin can update reservation notes"
ON public.reservation_notes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND r.teacher_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND r.teacher_id = auth.uid())
);

CREATE POLICY "Admins can delete reservation notes"
ON public.reservation_notes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_reservation_notes_updated_at
BEFORE UPDATE ON public.reservation_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Migrate existing data
INSERT INTO public.reservation_notes (reservation_id, observation, admin_notes)
SELECT id, observation, admin_notes
FROM public.reservations
WHERE observation IS NOT NULL OR admin_notes IS NOT NULL;

-- 3) Trigger no longer references moved columns
CREATE OR REPLACE FUNCTION public.restrict_teacher_reservation_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
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
      OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
      OR NEW.recurrence_group_id IS DISTINCT FROM OLD.recurrence_group_id
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
$function$;

-- 4) Drop the sensitive columns from the shared table
DROP VIEW IF EXISTS public.public_reservations;
ALTER TABLE public.reservations DROP COLUMN observation;
ALTER TABLE public.reservations DROP COLUMN admin_notes;

-- 5) Public calendar view (safe columns only), invoker semantics
CREATE VIEW public.public_reservations
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.reservation_date,
  r.block_start,
  r.block_end,
  r.course_name,
  r.class_objective,
  r.status,
  r.cancellation_reason,
  p.full_name AS teacher_name
FROM public.reservations r
LEFT JOIN public.profiles p ON p.user_id = r.teacher_id
WHERE r.status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]);

GRANT SELECT ON public.public_reservations TO anon, authenticated;

-- 6) Restore read access to the (now safe) scheduling columns
GRANT SELECT (id, reservation_date, block_start, block_end, course_name, class_objective, status, cancellation_reason, teacher_id)
ON public.reservations TO anon;

CREATE POLICY "Anon can read approved reservations (safe cols only)"
ON public.reservations FOR SELECT TO anon
USING (status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]));

CREATE POLICY "Authenticated can view approved reservations"
ON public.reservations FOR SELECT TO authenticated
USING (status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]));