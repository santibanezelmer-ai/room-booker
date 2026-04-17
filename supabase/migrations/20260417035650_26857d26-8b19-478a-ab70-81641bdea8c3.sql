-- 1) Nuevas columnas en reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS idx_reservations_recurrence_group
  ON public.reservations(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

-- 2) Profesores pueden editar y borrar sus propias reservas pendientes
CREATE POLICY "Teachers can update own pending reservations"
ON public.reservations
FOR UPDATE
TO authenticated
USING (auth.uid() = teacher_id AND status = 'pending')
WITH CHECK (auth.uid() = teacher_id AND status = 'pending');

CREATE POLICY "Teachers can delete own pending reservations"
ON public.reservations
FOR DELETE
TO authenticated
USING (auth.uid() = teacher_id AND status = 'pending');

-- 3) Admins pueden eliminar reservas (necesario por si decidimos hard-delete)
CREATE POLICY "Admins can delete reservations"
ON public.reservations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Acceso público (sin login) al horario aprobado
DROP POLICY IF EXISTS "Anyone can view approved reservations" ON public.reservations;

CREATE POLICY "Public can view approved reservations"
ON public.reservations
FOR SELECT
TO anon, authenticated
USING (status IN ('approved', 'cancelled_by_admin'));

-- 5) Acceso público a establishment_settings y schedule_blocks
DROP POLICY IF EXISTS "Anyone authenticated can view settings" ON public.establishment_settings;
CREATE POLICY "Public can view establishment settings"
ON public.establishment_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone authenticated can view blocks" ON public.schedule_blocks;
CREATE POLICY "Public can view schedule blocks"
ON public.schedule_blocks
FOR SELECT
TO anon, authenticated
USING (true);

-- 6) Vista pública de profesores (solo nombre, sin email)
CREATE OR REPLACE VIEW public.public_teachers
WITH (security_invoker = true)
AS
SELECT user_id, full_name
FROM public.profiles;

GRANT SELECT ON public.public_teachers TO anon, authenticated;

-- Política en profiles para que cualquiera pueda leer user_id+full_name a través de la vista
-- (la vista usa security_invoker, así que necesita una RLS permisiva limitada).
-- En vez de exponer profiles, usaremos un policy que sólo aplica cuando la consulta viene
-- del path de la vista. Lo más simple: permitir SELECT público pero la app sólo expone la vista.
CREATE POLICY "Public can view teacher names"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Nota: la columna email sigue siendo accesible vía profiles para anon. Para evitarlo,
-- revocamos privilegios de columna email a anon.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (user_id, full_name) ON public.profiles TO anon;