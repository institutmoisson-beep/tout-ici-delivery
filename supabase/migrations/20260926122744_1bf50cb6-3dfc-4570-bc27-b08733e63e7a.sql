ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS restaurants_owner_idx ON public.restaurants (owner_id);

CREATE POLICY "owner manages own restaurant" ON public.restaurants
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner manages own dishes" ON public.dishes
  FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'pending_payment'
    CHECK (escrow_status IN ('pending_payment', 'funds_locked', 'delivered_pending_code', 'completed', 'refunded')),
  ADD COLUMN IF NOT EXISTS qr_code_secret text,
  ADD COLUMN IF NOT EXISTS commission_amount_fcfa numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_city text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_qr_code_secret_key
  ON public.orders (qr_code_secret) WHERE qr_code_secret IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_courier_idx ON public.orders (courier_id);
CREATE INDEX IF NOT EXISTS orders_escrow_status_idx ON public.orders (escrow_status);

CREATE OR REPLACE FUNCTION public.guard_order_escrow_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.escrow_rpc', true) IS DISTINCT FROM 'on' THEN
    IF NEW.escrow_status IS DISTINCT FROM OLD.escrow_status
       OR NEW.qr_code_secret IS DISTINCT FROM OLD.qr_code_secret
       OR NEW.courier_id IS DISTINCT FROM OLD.courier_id
       OR NEW.commission_amount_fcfa IS DISTINCT FROM OLD.commission_amount_fcfa THEN
      RAISE EXCEPTION 'Ces champs de séquestre ne peuvent être modifiés que par les fonctions dédiées';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_order_escrow_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_order_escrow ON public.orders;
CREATE TRIGGER trg_guard_order_escrow
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_escrow_columns();

CREATE POLICY "restaurant_owner reads own orders" ON public.orders FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "restaurant_owner updates own orders" ON public.orders FOR UPDATE TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "courier reads assigned orders" ON public.orders FOR SELECT TO authenticated
  USING (courier_id = auth.uid());

CREATE POLICY "courier reads open deliveries" ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'courier'::app_role)
    AND courier_id IS NULL
    AND escrow_status = 'funds_locked'
    AND status = 'PREPARING'
  );

CREATE OR REPLACE FUNCTION public.credit_wallet(_user_id uuid, _amount numeric, _reference text, _order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_new numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  v_new := v_balance + _amount;
  UPDATE public.wallets SET balance = v_new, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, reference, order_id)
    VALUES (_user_id, 'CREDIT', _amount, v_new, _reference, _order_id);
END;
$$;
REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_escrow_order(
  p_restaurant_id uuid,
  p_items jsonb,
  p_delivery_mode public.delivery_mode,
  p_point_relais_id uuid,
  p_client_latitude double precision,
  p_client_longitude double precision,
  p_client_address text,
  p_delivery_city text,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_commission_rate numeric DEFAULT 0.07
)
RETURNS TABLE (order_id uuid, qr_code_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_commission_rate numeric := LEAST(GREATEST(COALESCE(p_commission_rate, 0.07), 0.05), 0.10);
  v_commission numeric;
  v_total numeric;
  v_qr text;
  v_order_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_subtotal IS NULL OR p_subtotal <= 0 THEN RAISE EXCEPTION 'Montant de commande invalide'; END IF;

  v_commission := ROUND(p_subtotal * v_commission_rate, 2);
  v_total := p_subtotal + COALESCE(p_delivery_fee, 0);
  v_qr := encode(gen_random_bytes(16), 'hex');

  PERFORM set_config('app.escrow_rpc', 'on', true);

  INSERT INTO public.orders (
    user_id, restaurant_id, items, delivery_mode, point_relais_id,
    client_latitude, client_longitude, client_address,
    subtotal, delivery_fee, total_amount, payment_method, status,
    escrow_status, qr_code_secret, commission_amount_fcfa, delivery_city
  ) VALUES (
    v_uid, p_restaurant_id, p_items, p_delivery_mode, p_point_relais_id,
    p_client_latitude, p_client_longitude, p_client_address,
    p_subtotal, COALESCE(p_delivery_fee, 0), v_total, 'WALLET', 'PENDING',
    'pending_payment', v_qr, v_commission, p_delivery_city
  ) RETURNING id INTO v_order_id;

  PERFORM public.pay_order_with_wallet(v_order_id);

  PERFORM set_config('app.escrow_rpc', 'on', true);
  UPDATE public.orders SET escrow_status = 'funds_locked' WHERE id = v_order_id;

  RETURN QUERY SELECT v_order_id, v_qr;
END;
$$;
REVOKE ALL ON FUNCTION public.create_escrow_order(
  uuid, jsonb, public.delivery_mode, uuid, double precision, double precision, text, text, numeric, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_escrow_order(
  uuid, jsonb, public.delivery_mode, uuid, double precision, double precision, text, text, numeric, numeric, numeric
) TO authenticated;

CREATE OR REPLACE FUNCTION public.courier_accept_delivery(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'courier'::app_role) THEN
    RAISE EXCEPTION 'Réservé aux livreurs enregistrés';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.courier_id IS NOT NULL THEN RAISE EXCEPTION 'Déjà prise en charge par un autre livreur'; END IF;
  IF v_order.escrow_status <> 'funds_locked' THEN RAISE EXCEPTION 'Commande non éligible'; END IF;

  PERFORM set_config('app.escrow_rpc', 'on', true);
  UPDATE public.orders SET courier_id = v_uid, status = 'IN_TRANSIT' WHERE id = _order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.courier_accept_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.courier_accept_delivery(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.courier_mark_arrived(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = _order_id AND courier_id = auth.uid() AND escrow_status = 'funds_locked'
  ) THEN
    RAISE EXCEPTION 'Action non autorisée';
  END IF;
  PERFORM set_config('app.escrow_rpc', 'on', true);
  UPDATE public.orders SET escrow_status = 'delivered_pending_code' WHERE id = _order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.courier_mark_arrived(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.courier_mark_arrived(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_qr_and_release_funds(_order_id uuid, _qr_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_restaurant_owner uuid;
  v_restaurant_share numeric;
  v_courier_share numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.courier_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Seul le livreur assigné peut valider cette livraison';
  END IF;
  IF v_order.escrow_status = 'completed' THEN RAISE EXCEPTION 'Fonds déjà libérés'; END IF;
  IF v_order.escrow_status NOT IN ('funds_locked', 'delivered_pending_code') THEN
    RAISE EXCEPTION 'Commande non éligible à la libération des fonds';
  END IF;
  IF v_order.qr_code_secret IS NULL OR v_order.qr_code_secret <> _qr_code THEN
    RAISE EXCEPTION 'Code QR invalide';
  END IF;

  SELECT owner_id INTO v_restaurant_owner FROM public.restaurants WHERE id = v_order.restaurant_id;

  v_restaurant_share := v_order.subtotal - COALESCE(v_order.commission_amount_fcfa, 0);
  v_courier_share := COALESCE(v_order.delivery_fee, 0);

  PERFORM set_config('app.escrow_rpc', 'on', true);

  IF v_restaurant_owner IS NOT NULL AND v_restaurant_share > 0 THEN
    PERFORM public.credit_wallet(
      v_restaurant_owner, v_restaurant_share,
      'Commande #' || substr(_order_id::text, 1, 8) || ' — règlement restaurateur', _order_id
    );
  END IF;
  IF v_courier_share > 0 THEN
    PERFORM public.credit_wallet(
      v_uid, v_courier_share,
      'Commande #' || substr(_order_id::text, 1, 8) || ' — frais de livraison', _order_id
    );
  END IF;

  UPDATE public.orders SET escrow_status = 'completed', status = 'DELIVERED' WHERE id = _order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_qr_and_release_funds(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_qr_and_release_funds(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_courier_deliveries()
RETURNS SETOF public.orders
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.orders WHERE courier_id = auth.uid() ORDER BY created_at DESC LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.my_courier_deliveries() TO authenticated;
REVOKE ALL ON FUNCTION public.my_courier_deliveries() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.available_deliveries(_city text DEFAULT NULL)
RETURNS SETOF public.orders
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.orders
  WHERE public.has_role(auth.uid(), 'courier'::app_role)
    AND courier_id IS NULL
    AND escrow_status = 'funds_locked'
    AND status = 'PREPARING'
    AND (_city IS NULL OR delivery_city = _city)
  ORDER BY created_at ASC LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.available_deliveries(text) TO authenticated;
REVOKE ALL ON FUNCTION public.available_deliveries(text) FROM PUBLIC, anon;