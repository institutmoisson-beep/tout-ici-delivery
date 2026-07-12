ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS default_latitude double precision,
  ADD COLUMN IF NOT EXISTS default_longitude double precision,
  ADD COLUMN IF NOT EXISTS default_address text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;