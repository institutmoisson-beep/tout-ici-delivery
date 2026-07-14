
-- 1. PICKUP mode
ALTER TYPE delivery_mode ADD VALUE IF NOT EXISTS 'PICKUP';

-- 2. GPS on relais
ALTER TABLE public.points_relais
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- 3. delivery_pricing (single-row config)
CREATE TABLE IF NOT EXISTS public.delivery_pricing (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  base_per_km numeric(10,2) NOT NULL DEFAULT 150,
  minimum_fee numeric(10,2) NOT NULL DEFAULT 500,
  night_start_hour int NOT NULL DEFAULT 21 CHECK (night_start_hour BETWEEN 0 AND 23),
  night_end_hour int NOT NULL DEFAULT 6 CHECK (night_end_hour BETWEEN 0 AND 23),
  night_multiplier numeric(5,2) NOT NULL DEFAULT 1.30,
  weekend_multiplier numeric(5,2) NOT NULL DEFAULT 1.15,
  holiday_multiplier numeric(5,2) NOT NULL DEFAULT 1.50,
  strike_active boolean NOT NULL DEFAULT false,
  strike_multiplier numeric(5,2) NOT NULL DEFAULT 1.75,
  intercity_flat_surcharge numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_pricing TO anon, authenticated;
GRANT ALL ON public.delivery_pricing TO service_role;
ALTER TABLE public.delivery_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read pricing" ON public.delivery_pricing FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages pricing" ON public.delivery_pricing FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.delivery_pricing (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 4. public_holidays
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.public_holidays TO anon, authenticated;
GRANT ALL ON public.public_holidays TO service_role;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holidays" ON public.public_holidays FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manages holidays" ON public.public_holidays FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Atomic wallet debit for orders
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_balance numeric;
  v_new_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.user_id <> v_uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_order.payment_method <> 'WALLET' THEN RAISE EXCEPTION 'Order not paid with wallet'; END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (v_uid, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_balance < v_order.total_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - v_order.total_amount;
  UPDATE public.wallets SET balance = v_new_balance, updated_at = now() WHERE user_id = v_uid;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, reference, order_id)
    VALUES (v_uid, 'DEBIT', v_order.total_amount, v_new_balance,
            'Commande #' || substr(v_order.id::text, 1, 8), v_order.id);
  RETURN v_new_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_order_with_wallet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;

-- 6. Admin recharge approval RPC
CREATE OR REPLACE FUNCTION public.admin_approve_recharge(p_recharge_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_r public.recharge_requests%ROWTYPE;
  v_balance numeric;
  v_new numeric;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO v_r FROM public.recharge_requests WHERE id = p_recharge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recharge not found'; END IF;
  IF v_r.status <> 'PENDING' THEN RAISE EXCEPTION 'Already processed'; END IF;

  IF p_approve THEN
    INSERT INTO public.wallets(user_id, balance) VALUES (v_r.user_id, 0) ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_r.user_id FOR UPDATE;
    v_new := v_balance + v_r.amount;
    UPDATE public.wallets SET balance = v_new, updated_at = now() WHERE user_id = v_r.user_id;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, reference)
      VALUES (v_r.user_id, 'RECHARGE', v_r.amount, v_new,
              'Recharge ' || COALESCE(v_r.payment_channel, '') || ' (' || COALESCE(v_r.payment_ref,'') || ')');
    UPDATE public.recharge_requests SET status = 'APPROVED', processed_at = now() WHERE id = p_recharge_id;
  ELSE
    UPDATE public.recharge_requests SET status = 'REJECTED', processed_at = now() WHERE id = p_recharge_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_approve_recharge(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_recharge(uuid, boolean) TO authenticated;
