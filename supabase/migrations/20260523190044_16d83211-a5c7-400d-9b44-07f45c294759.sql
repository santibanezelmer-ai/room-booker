
-- 1. Remove anon email exposure: drop overly broad anon SELECT on profiles
DROP POLICY IF EXISTS "Public can view teacher names" ON public.profiles;

-- 2. Replace public_teachers view (safe columns only) with security_invoker so
--    it respects the caller's RLS rather than bypassing them.
DROP VIEW IF EXISTS public.public_teachers;
CREATE VIEW public.public_teachers
WITH (security_invoker = true) AS
SELECT user_id, full_name FROM public.profiles;

-- Allow the view itself to be readable by anon/authenticated; underlying
-- profiles access for anon is handled by the dedicated policy below that
-- restricts visibility to safe rows. We add a narrow SELECT policy on
-- profiles that only permits reading rows when accessed through the view
-- by restricting to specific safe columns (Postgres has no column RLS,
-- so we instead allow anon to SELECT but rely on the view's column list
-- and revoke direct table access for anon).
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (user_id, full_name) ON public.profiles TO anon;
GRANT SELECT ON public.public_teachers TO anon, authenticated;

-- Add a minimal anon SELECT policy so the column grant is usable through the view
CREATE POLICY "Anon can view teacher names only"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- 3. Reservations: replace broad anon access with a view that omits teacher_id
DROP POLICY IF EXISTS "Public can view approved reservations" ON public.reservations;

-- Re-add authenticated access (so signed-in teachers/admins still see via existing policies)
-- and a tighter anon policy that does NOT expose teacher_id directly.
CREATE POLICY "Authenticated can view approved reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (status = ANY (ARRAY['approved'::text, 'cancelled_by_admin'::text]));

CREATE OR REPLACE VIEW public.public_reservations
WITH (security_invoker = false) AS
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

-- 4. Lock down SECURITY DEFINER functions: revoke EXECUTE from public roles.
--    has_role is only used inside RLS expressions (runs as definer there), and
--    handle_new_user is only invoked by an auth trigger.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
