-- Rebuild the public calendar view so it exposes only safe columns,
-- independent of who queries it.
DROP VIEW IF EXISTS public.public_reservations;

CREATE VIEW public.public_reservations
WITH (security_invoker = false) AS
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

REVOKE ALL ON public.public_reservations FROM anon, authenticated;
GRANT SELECT ON public.public_reservations TO anon, authenticated;

-- Remove broad row access to the base table; the view is the only public path now.
DROP POLICY IF EXISTS "Authenticated can view approved reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anon can read approved reservations (safe cols only)" ON public.reservations;

REVOKE ALL ON public.reservations FROM anon;