
-- Switch views to security_invoker
DROP VIEW IF EXISTS public.public_teachers;
CREATE VIEW public.public_teachers WITH (security_invoker = true) AS
SELECT user_id, full_name FROM public.profiles;
GRANT SELECT ON public.public_teachers TO anon, authenticated;

DROP VIEW IF EXISTS public.public_reservations;
CREATE VIEW public.public_reservations WITH (security_invoker = true) AS
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

-- Anon column-level grants: only safe columns
GRANT SELECT (user_id, full_name) ON public.profiles TO anon;
GRANT SELECT (
  id, reservation_date, block_start, block_end,
  course_name, status, cancellation_reason, teacher_id
) ON public.reservations TO anon;

-- Anon RLS: narrow policies so views can read the underlying rows
CREATE POLICY "Anon may read teacher name rows via view"
ON public.profiles
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon may read approved reservation rows via view"
ON public.reservations
FOR SELECT
TO anon
USING (status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]));
