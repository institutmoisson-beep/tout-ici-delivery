
-- 1. payment_gateways: remove anon read access
DROP POLICY IF EXISTS "read active gateways" ON public.payment_gateways;
CREATE POLICY "read active gateways" ON public.payment_gateways
  FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.payment_gateways FROM anon;

-- 2. media bucket: scope public read to restaurant/dish images only
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
CREATE POLICY "media_public_menu_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] IN ('restaurants', 'dishes')
    )
  );
CREATE POLICY "media_authenticated_read_other" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR owner = auth.uid()
    )
  );

-- 3. PostGIS spatial_ref_sys: enable RLS with public read
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_public_read ON public.spatial_ref_sys';
    EXECUTE 'CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys FOR SELECT USING (true)';
  EXCEPTION WHEN insufficient_privilege THEN
    -- PostGIS system table may be owned by another role; skip silently.
    NULL;
  END;
END $$;

-- 4. calculate_distance_km: pin search_path
ALTER FUNCTION public.calculate_distance_km(double precision, double precision, double precision, double precision)
  SET search_path = public, pg_catalog;

-- 5. Revoke public/anon/authenticated EXECUTE on internal SECURITY DEFINER functions
--    Trigger functions are invoked by the table owner; app never calls them directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fin_tx_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fin_tx_after_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;

-- claim_first_admin: authenticated only (called from /setup by the very first user)
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- has_role: needed inside RLS policies (called as auth.uid()); allow authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
