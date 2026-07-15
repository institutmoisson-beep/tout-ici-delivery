
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT ROUND(
    (2 * 6371 * asin(
      sqrt(
        power(sin(radians((lat2 - lat1) / 2)), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) *
        power(sin(radians((lng2 - lng1) / 2)), 2)
      )
    ))::numeric, 2
  );
$$;

DROP EXTENSION IF EXISTS postgis CASCADE;

DROP POLICY IF EXISTS "media_public_menu_read" ON storage.objects;

CREATE POLICY "media_public_menu_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'media'
  AND (
    (
      (storage.foldername(name))[1] = 'restaurants'
      AND EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id::text = (storage.foldername(name))[2]
          AND r.is_active = true
      )
    )
    OR (
      (storage.foldername(name))[1] = 'dishes'
      AND EXISTS (
        SELECT 1 FROM public.dishes d
        WHERE d.id::text = (storage.foldername(name))[2]
          AND d.is_available = true
      )
    )
  )
);

REVOKE ALL ON FUNCTION public.admin_approve_recharge(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_order_with_wallet(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_approve_recharge(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
