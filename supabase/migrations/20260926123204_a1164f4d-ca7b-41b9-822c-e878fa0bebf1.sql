DROP POLICY "public read restaurants" ON public.restaurants;
CREATE POLICY "public read restaurants" ON public.restaurants FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY "public read dishes" ON public.dishes;
CREATE POLICY "public read dishes" ON public.dishes FOR SELECT TO anon, authenticated USING (is_available = true);

DROP POLICY "authenticated read relais" ON public.points_relais;
CREATE POLICY "authenticated read relais" ON public.points_relais FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY "public read holidays" ON public.public_holidays;
CREATE OR REPLACE FUNCTION public.list_holiday_dates()
RETURNS TABLE(holiday_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT holiday_date FROM public.public_holidays $$;
REVOKE ALL ON FUNCTION public.list_holiday_dates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_holiday_dates() TO authenticated;

DROP POLICY "authenticated read pricing" ON public.delivery_pricing;
CREATE OR REPLACE FUNCTION public.get_delivery_pricing()
RETURNS SETOF public.delivery_pricing
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.delivery_pricing $$;
REVOKE ALL ON FUNCTION public.get_delivery_pricing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_pricing() TO authenticated;

DROP POLICY "media_public_menu_read" ON storage.objects;