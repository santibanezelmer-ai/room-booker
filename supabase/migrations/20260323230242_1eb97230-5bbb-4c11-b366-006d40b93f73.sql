
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'teacher',
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create schedule_settings table
CREATE TABLE public.schedule_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIME NOT NULL DEFAULT '08:30',
    end_time TIME NOT NULL DEFAULT '15:30',
    block_duration_minutes INT NOT NULL DEFAULT 45,
    allow_double_blocks BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settings" ON public.schedule_settings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update settings" ON public.schedule_settings
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings" ON public.schedule_settings
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.schedule_settings (start_time, end_time, block_duration_minutes, allow_double_blocks)
VALUES ('08:30', '15:30', 45, true);

-- Create materials table
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    quantity_available INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view materials" ON public.materials
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage materials" ON public.materials
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create reservations table
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL,
    block_start INT NOT NULL,
    block_end INT NOT NULL,
    course_name TEXT NOT NULL,
    observation TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own reservations" ON public.reservations
FOR SELECT TO authenticated USING (auth.uid() = teacher_id);

CREATE POLICY "Admins can view all reservations" ON public.reservations
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view approved reservations" ON public.reservations
FOR SELECT TO authenticated USING (status = 'approved');

CREATE POLICY "Teachers can create reservations" ON public.reservations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Admins can update reservations" ON public.reservations
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create material_reservations table
CREATE TABLE public.material_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL,
    block_start INT NOT NULL,
    block_end INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    course_name TEXT NOT NULL,
    observation TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own material reservations" ON public.material_reservations
FOR SELECT TO authenticated USING (auth.uid() = teacher_id);

CREATE POLICY "Admins can view all material reservations" ON public.material_reservations
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can create material reservations" ON public.material_reservations
FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Admins can update material reservations" ON public.material_reservations
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for auto-creating profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_material_reservations_updated_at BEFORE UPDATE ON public.material_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_schedule_settings_updated_at BEFORE UPDATE ON public.schedule_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
