
-- 1) Remove anon SELECT policies from base tables (RLS can't do column-level restriction)
DROP POLICY IF EXISTS "Anon may read teacher name rows via view" ON public.profiles;
DROP POLICY IF EXISTS "Anon may read approved reservation rows via view" ON public.reservations;

-- 2) Recreate views with security_invoker=false so they run with the (privileged) view owner's rights,
--    and expose ONLY safe columns. Grant SELECT to anon and authenticated on the views.

DROP VIEW IF EXISTS public.public_reservations;
CREATE VIEW public.public_reservations
WITH (security_invoker = false) AS
SELECT r.id,
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

DROP VIEW IF EXISTS public.public_teachers;
CREATE VIEW public.public_teachers
WITH (security_invoker = false) AS
SELECT user_id, full_name
FROM public.profiles;

GRANT SELECT ON public.public_teachers TO anon, authenticated;
