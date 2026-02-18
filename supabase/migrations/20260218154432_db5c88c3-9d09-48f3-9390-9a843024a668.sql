
-- User roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');

-- Profiles table (stores display name, email reference)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles RLS
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles RLS
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ambulances table (real-time position tracking)
CREATE TABLE public.ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  driver_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL DEFAULT 12.9716,
  lng DOUBLE PRECISION NOT NULL DEFAULT 77.5946,
  speed DOUBLE PRECISION NOT NULL DEFAULT 40,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  exit_direction TEXT CHECK (exit_direction IN ('left', 'straight', 'right')),
  inside_geofence_id UUID,
  eta DOUBLE PRECISION,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can read ambulances" ON public.ambulances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers can insert their ambulance" ON public.ambulances FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update their ambulance" ON public.ambulances FOR UPDATE TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Admins can update any ambulance" ON public.ambulances FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Junctions table
CREATE TABLE public.junctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  signal_status TEXT NOT NULL DEFAULT 'green' CHECK (signal_status IN ('red', 'green')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.junctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can read junctions" ON public.junctions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert junctions" ON public.junctions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update junctions" ON public.junctions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete junctions" ON public.junctions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Geofences table
CREATE TABLE public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 500,
  triggered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can read geofences" ON public.geofences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert geofences" ON public.geofences FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update geofences" ON public.geofences FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete geofences" ON public.geofences FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Hospitals table
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated users can read hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update hospitals" ON public.hospitals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete hospitals" ON public.hospitals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.junctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.geofences;

-- Auto-update updated_at for ambulances
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ambulances_updated_at
BEFORE UPDATE ON public.ambulances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default junctions
INSERT INTO public.junctions (name, lat, lng) VALUES
  ('MG Road Junction', 12.9716, 77.5946),
  ('Cubbon Park Junction', 12.9780, 77.5900),
  ('Richmond Circle', 12.9650, 77.6000),
  ('Silk Board Junction', 12.9352, 77.6245),
  ('Marathahalli Junction', 12.9698, 77.7500),
  ('Indiranagar 100ft Road', 12.9783, 77.6408),
  ('Lalbagh Gate Junction', 12.9563, 77.6010),
  ('Rajajinagar Junction', 12.9850, 77.5533),
  ('Yeshwanthpur Circle', 13.0070, 77.5650),
  ('Majestic Junction', 12.9906, 77.5712),
  ('Hebbal Flyover Junction', 13.0358, 77.5970),
  ('BTM Layout Junction', 12.9121, 77.6446),
  ('Jayanagar 4th Block', 12.9344, 77.6101),
  ('Basavanagudi Circle', 12.9540, 77.5730),
  ('Banashankari Junction', 12.9260, 77.5830),
  ('HSR Layout Junction', 12.9568, 77.7010),
  ('Bommanahalli Junction', 12.9165, 77.6101),
  ('KR Puram Junction', 13.0200, 77.6440),
  ('CV Raman Nagar Junction', 12.9950, 77.6170),
  ('Bull Temple Road Junction', 12.9450, 77.5620);

-- Seed default hospitals
INSERT INTO public.hospitals (name, lat, lng) VALUES
  ('City General Hospital', 12.9600, 77.5850),
  ('Metro Emergency Center', 12.9800, 77.6050);

-- Seed default geofence
INSERT INTO public.geofences (name, center_lat, center_lng, radius) VALUES
  ('MG Road Zone', 12.9716, 77.5946, 500);
