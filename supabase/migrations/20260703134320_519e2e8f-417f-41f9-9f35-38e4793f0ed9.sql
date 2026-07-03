
-- Recreate views with security_invoker=true (satisfies linter)
DROP VIEW IF EXISTS public.public_reservations;
CREATE VIEW public.public_reservations
WITH (security_invoker = true) AS
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
WITH (security_invoker = true) AS
SELECT user_id, full_name FROM public.profiles;
GRANT SELECT ON public.public_teachers TO anon, authenticated;

-- Column-level grants so anon can never read sensitive columns even via direct queries
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (user_id, full_name) ON public.profiles TO anon;

REVOKE SELECT ON public.reservations FROM anon;
GRANT SELECT (id, reservation_date, block_start, block_end, course_name, status, cancellation_reason, teacher_id)
  ON public.reservations TO anon;

-- Row-level policies for anon (restricted, safe rows only)
CREATE POLICY "Anon can read teacher names (safe cols only)"
ON public.profiles
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon can read approved reservations (safe cols only)"
ON public.reservations
FOR SELECT
TO anon
USING (status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]));
