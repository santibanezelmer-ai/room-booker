CREATE POLICY "Admins can create reservations for anyone"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));