-- Allow any authenticated user to update geofence triggered status (needed when ambulance enters/exits)
CREATE POLICY "Any authenticated can update geofence triggered"
ON public.geofences FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

-- Allow any authenticated user to update junction signal_status
CREATE POLICY "Any authenticated can update junction signal"
ON public.junctions FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

-- Drop old restrictive admin-only update policies
DROP POLICY IF EXISTS "Admins can update geofences" ON public.geofences;
DROP POLICY IF EXISTS "Admins can update junctions" ON public.junctions;