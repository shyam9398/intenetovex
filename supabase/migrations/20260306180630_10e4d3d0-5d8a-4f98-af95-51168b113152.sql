-- Deactivate all old ambulances, keep only the 2 most recent
UPDATE public.ambulances SET active = false;
