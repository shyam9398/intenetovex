
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- ═══ PROFILES ═══
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ═══ USER_ROLES ═══
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ═══ AMBULANCES ═══
DROP POLICY IF EXISTS "All authenticated users can read ambulances" ON public.ambulances;
DROP POLICY IF EXISTS "Drivers can insert their ambulance" ON public.ambulances;
DROP POLICY IF EXISTS "Drivers can update their ambulance" ON public.ambulances;
DROP POLICY IF EXISTS "Admins can update any ambulance" ON public.ambulances;

CREATE POLICY "All authenticated users can read ambulances" ON public.ambulances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers can insert their ambulance" ON public.ambulances FOR INSERT TO authenticated WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update their ambulance" ON public.ambulances FOR UPDATE TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Admins can update any ambulance" ON public.ambulances FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ═══ JUNCTIONS ═══
DROP POLICY IF EXISTS "All authenticated users can read junctions" ON public.junctions;
DROP POLICY IF EXISTS "Admins can insert junctions" ON public.junctions;
DROP POLICY IF EXISTS "Admins can update junctions" ON public.junctions;
DROP POLICY IF EXISTS "Admins can delete junctions" ON public.junctions;

CREATE POLICY "All authenticated users can read junctions" ON public.junctions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert junctions" ON public.junctions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update junctions" ON public.junctions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete junctions" ON public.junctions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ═══ GEOFENCES ═══
DROP POLICY IF EXISTS "All authenticated users can read geofences" ON public.geofences;
DROP POLICY IF EXISTS "Admins can insert geofences" ON public.geofences;
DROP POLICY IF EXISTS "Admins can update geofences" ON public.geofences;
DROP POLICY IF EXISTS "Admins can delete geofences" ON public.geofences;

CREATE POLICY "All authenticated users can read geofences" ON public.geofences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert geofences" ON public.geofences FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update geofences" ON public.geofences FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete geofences" ON public.geofences FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ═══ HOSPITALS ═══
DROP POLICY IF EXISTS "All authenticated users can read hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Admins can insert hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Admins can update hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Admins can delete hospitals" ON public.hospitals;

CREATE POLICY "All authenticated users can read hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update hospitals" ON public.hospitals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete hospitals" ON public.hospitals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
