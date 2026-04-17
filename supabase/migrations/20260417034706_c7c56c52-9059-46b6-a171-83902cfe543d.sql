-- 1) Profiles: restrict SELECT
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) user_roles: explicit restrictive INSERT policy preventing self-elevation
-- The existing "Admins can manage roles" ALL policy already covers admins.
-- Add a RESTRICTIVE policy so non-admin INSERTs are blocked even if a permissive
-- policy were added later. Trigger handle_new_user is SECURITY DEFINER so it bypasses RLS.
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Storage: prevent listing of the public `logos` bucket while keeping
-- direct file access (by exact path) working for everyone.
-- Drop any overly permissive existing SELECT policies on logos, then add a
-- narrow policy: only admins can list; individual files remain accessible
-- via public URLs (Supabase serves public bucket files without RLS check on the public endpoint).
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname IN (
        'Public can view logos',
        'Anyone can view logos',
        'Logos are publicly accessible',
        'Public read logos'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

-- Admins can manage (upload/update/delete/list) logos
CREATE POLICY "Admins can manage logos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'::public.app_role));