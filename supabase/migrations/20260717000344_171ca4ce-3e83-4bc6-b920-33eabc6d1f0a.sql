DROP POLICY IF EXISTS "public read relais" ON public.points_relais;
CREATE POLICY "authenticated read relais" ON public.points_relais FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.points_relais FROM anon;