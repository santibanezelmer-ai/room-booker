-- Storage bucket for establishment logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow admins to upload logos
CREATE POLICY "Admins can upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to update logos
CREATE POLICY "Admins can update logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete logos
CREATE POLICY "Admins can delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

-- Anyone can view logos
CREATE POLICY "Anyone can view logos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logos');

-- Allow public (anon) to view logos too
CREATE POLICY "Public can view logos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'logos');

-- Table to store establishment settings like logo URL
CREATE TABLE public.establishment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  name text DEFAULT 'Sala de Computación',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.establishment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settings" ON public.establishment_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage settings" ON public.establishment_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.establishment_settings (name) VALUES ('Sala de Computación');

-- Allow admins to delete profiles (for user management)
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete user roles
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));