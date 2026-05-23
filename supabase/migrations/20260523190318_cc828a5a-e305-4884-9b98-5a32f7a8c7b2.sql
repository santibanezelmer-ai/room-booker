
-- PROFILES: remove all anon access to the table; expose only the view
DROP POLICY IF EXISTS "Anon can view teacher names only" ON public.profiles;
REVOKE ALL ON public.profiles FROM anon;

-- Recreate public_teachers view without security_invoker so it uses owner perms
DROP VIEW IF EXISTS public.public_teachers;
CREATE VIEW public.public_teachers AS
SELECT user_id, full_name FROM public.profiles;
GRANT SELECT ON public.public_teachers TO anon, authenticated;

-- RESERVATIONS: remove anon SELECT policy/grants on the table; expose only view
DROP POLICY IF EXISTS "Anon can view approved reservations (safe cols)" ON public.reservations;
REVOKE ALL ON public.reservations FROM anon;

DROP VIEW IF EXISTS public.public_reservations;
CREATE VIEW public.public_reservations AS
SELECT
  r.id,
  r.reservation_date,
  r.block_start,
  r.block_end,
  r.course_name,
  r.status,
  r.cancellation_reason,
  p.full_name AS teacher_name
FROM public.reservations r
LEFT JOIN public.profiles p ON p.user_id = r.teacher_id
WHERE r.status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]);

GRANT SELECT ON public.public_reservations TO anon, authenticated;
