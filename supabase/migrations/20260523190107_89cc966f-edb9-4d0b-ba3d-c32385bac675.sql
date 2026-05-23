
-- Recreate public_reservations using security_invoker so it does not bypass RLS
DROP VIEW IF EXISTS public.public_reservations;
CREATE VIEW public.public_reservations
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.reservation_date,
  r.block_start,
  r.block_end,
  r.course_name,
  r.class_objective,
  r.observation,
  r.status,
  r.cancellation_reason,
  p.full_name AS teacher_name
FROM public.reservations r
LEFT JOIN public.profiles p ON p.user_id = r.teacher_id
WHERE r.status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]);

GRANT SELECT ON public.public_reservations TO anon, authenticated;

-- Anon can SELECT only safe columns from reservations (no teacher_id, no admin_notes)
REVOKE SELECT ON public.reservations FROM anon;
GRANT SELECT (
  id, reservation_date, block_start, block_end,
  course_name, class_objective, observation, status, cancellation_reason
) ON public.reservations TO anon;

-- Anon RLS: only approved or admin-cancelled rows are visible
CREATE POLICY "Anon can view approved reservations (safe cols)"
ON public.reservations
FOR SELECT
TO anon
USING (status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]));
