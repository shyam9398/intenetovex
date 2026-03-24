
-- Add city column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;

-- Add city column to junctions
ALTER TABLE public.junctions ADD COLUMN IF NOT EXISTS city text;

-- Add city column to geofences
ALTER TABLE public.geofences ADD COLUMN IF NOT EXISTS city text;

-- Add city column to hospitals
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS city text;
