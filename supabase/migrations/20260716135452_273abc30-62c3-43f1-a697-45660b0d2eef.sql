
-- 1. delivery_pricing: restrict SELECT to authenticated only
DROP POLICY IF EXISTS "public read pricing" ON public.delivery_pricing;
CREATE POLICY "authenticated read pricing" ON public.delivery_pricing
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.delivery_pricing FROM anon;

-- 2. financial_transactions: explicit deny DELETE from clients
CREATE POLICY "deny client delete" ON public.financial_transactions
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 3. wallet_transactions: explicit deny all client writes
CREATE POLICY "deny client insert" ON public.wallet_transactions
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client update" ON public.wallet_transactions
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "deny client delete" ON public.wallet_transactions
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 4. wallets: explicit deny all client writes
CREATE POLICY "deny client insert" ON public.wallets
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "deny client update" ON public.wallets
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "deny client delete" ON public.wallets
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- 5. update_updated_at: set immutable search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
