
-- 1. Manager roles table (per-domain delegation)
CREATE TABLE public.manager_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('restaurants','relais','orders','finance','payments','holidays','profiles')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

GRANT SELECT ON public.manager_roles TO authenticated;
GRANT ALL ON public.manager_roles TO service_role;

ALTER TABLE public.manager_roles ENABLE ROW LEVEL SECURITY;

-- Users see their own domains; admins see all
CREATE POLICY "read own manager roles" ON public.manager_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Only super-admin can write (via RPC below, but keep policy for defence in depth)
CREATE POLICY "admin manages manager roles" ON public.manager_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. has_manager helper
CREATE OR REPLACE FUNCTION public.has_manager(_user_id UUID, _domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_roles
    WHERE user_id = _user_id AND domain = _domain
  );
$$;

REVOKE ALL ON FUNCTION public.has_manager(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_manager(UUID, TEXT) TO authenticated;

-- 3. admin_set_manager_roles RPC (replaces domains for a user in one call)
CREATE OR REPLACE FUNCTION public.admin_set_manager_roles(p_user_id UUID, p_domains TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  DELETE FROM public.manager_roles WHERE user_id = p_user_id;
  IF p_domains IS NOT NULL THEN
    FOREACH d IN ARRAY p_domains LOOP
      IF d IN ('restaurants','relais','orders','finance','payments','holidays','profiles') THEN
        INSERT INTO public.manager_roles(user_id, domain) VALUES (p_user_id, d)
        ON CONFLICT (user_id, domain) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_manager_roles(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_manager_roles(UUID, TEXT[]) TO authenticated;

-- 4. admin_list_users RPC — returns profiles + roles + domains
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  is_admin BOOLEAN,
  domains TEXT[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT
      p.id,
      u.email::TEXT,
      p.full_name,
      p.phone,
      EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'::app_role) AS is_admin,
      COALESCE(ARRAY(SELECT mr.domain FROM public.manager_roles mr WHERE mr.user_id = p.id ORDER BY mr.domain), ARRAY[]::TEXT[]) AS domains
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END; $$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 5. Extend RLS to allow domain managers the same access as admin (write)

-- restaurants + dishes (domain: restaurants)
CREATE POLICY "restaurant_manager writes restaurants" ON public.restaurants
  FOR ALL TO authenticated
  USING (has_manager(auth.uid(), 'restaurants'))
  WITH CHECK (has_manager(auth.uid(), 'restaurants'));

CREATE POLICY "restaurant_manager writes dishes" ON public.dishes
  FOR ALL TO authenticated
  USING (has_manager(auth.uid(), 'restaurants'))
  WITH CHECK (has_manager(auth.uid(), 'restaurants'));

-- points_relais (domain: relais)
CREATE POLICY "relais_manager writes relais" ON public.points_relais
  FOR ALL TO authenticated
  USING (has_manager(auth.uid(), 'relais'))
  WITH CHECK (has_manager(auth.uid(), 'relais'));

-- orders (domain: orders)
CREATE POLICY "orders_manager reads orders" ON public.orders
  FOR SELECT TO authenticated
  USING (has_manager(auth.uid(), 'orders'));

CREATE POLICY "orders_manager updates orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_manager(auth.uid(), 'orders'))
  WITH CHECK (has_manager(auth.uid(), 'orders'));

-- finance (domain: finance) — delivery_pricing, recharge_requests, financial_transactions, wallets/wallet_transactions read
CREATE POLICY "finance_manager writes pricing" ON public.delivery_pricing
  FOR ALL TO authenticated
  USING (has_manager(auth.uid(), 'finance'))
  WITH CHECK (has_manager(auth.uid(), 'finance'));

CREATE POLICY "finance_manager reads recharges" ON public.recharge_requests
  FOR SELECT TO authenticated
  USING (has_manager(auth.uid(), 'finance'));

CREATE POLICY "finance_manager updates recharges" ON public.recharge_requests
  FOR UPDATE TO authenticated
  USING (has_manager(auth.uid(), 'finance'))
  WITH CHECK (has_manager(auth.uid(), 'finance'));

CREATE POLICY "finance_manager reads fin_tx" ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (has_manager(auth.uid(), 'finance'));

CREATE POLICY "finance_manager updates fin_tx" ON public.financial_transactions
  FOR UPDATE TO authenticated
  USING (has_manager(auth.uid(), 'finance'))
  WITH CHECK (has_manager(auth.uid(), 'finance'));

CREATE POLICY "finance_manager reads wallets" ON public.wallets
  FOR SELECT TO authenticated
  USING (has_manager(auth.uid(), 'finance'));

CREATE POLICY "finance_manager reads wallet_tx" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (has_manager(auth.uid(), 'finance'));

-- payment_gateways (domain: payments)
CREATE POLICY "payments_manager writes gateways" ON public.payment_gateways
  FOR ALL TO authenticated
  USING (has_manager(auth.uid(), 'payments'))
  WITH CHECK (has_manager(auth.uid(), 'payments'));

-- public_holidays (domain: holidays)
CREATE POLICY "holidays_manager writes holidays" ON public.public_holidays
  FOR ALL TO authenticated
  USING (has_manager(auth.uid(), 'holidays'))
  WITH CHECK (has_manager(auth.uid(), 'holidays'));

-- profiles (domain: profiles) - read all
CREATE POLICY "profiles_manager reads profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_manager(auth.uid(), 'profiles'));
