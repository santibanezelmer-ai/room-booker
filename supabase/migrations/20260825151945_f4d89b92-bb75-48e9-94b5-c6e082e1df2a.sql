DROP POLICY IF EXISTS "Authenticated can view notification settings" ON public.notification_settings;

CREATE POLICY "Admins can view notification settings"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));