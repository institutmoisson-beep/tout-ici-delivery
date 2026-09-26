CREATE TABLE public.courier_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  vehicle text,
  motivation text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX courier_app_one_pending ON public.courier_applications(user_id) WHERE status = 'PENDING';
GRANT SELECT, INSERT ON public.courier_applications TO authenticated;
GRANT ALL ON public.courier_applications TO service_role;
ALTER TABLE public.courier_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own apps read" ON public.courier_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_manager(auth.uid(),'courtage'));
CREATE POLICY "own apps insert" ON public.courier_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'PENDING' AND processed_by IS NULL);
CREATE TRIGGER courier_app_touch BEFORE UPDATE ON public.courier_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_courtage_admin(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_manager(_uid,'courtage')
$$;

CREATE OR REPLACE FUNCTION public.admin_set_courier(p_user_id uuid, p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_courtage_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF p_active THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id,'courier') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'courier';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_courier_application(p_id uuid, p_approve boolean, p_note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.is_courtage_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.courier_applications
    SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
        admin_note = p_note, processed_by = auth.uid(), processed_at = now()
    WHERE id = p_id AND status = 'PENDING' RETURNING user_id INTO v_uid;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Demande introuvable ou déjà traitée'; END IF;
  IF p_approve THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (v_uid,'courier') ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_couriers() RETURNS TABLE(id uuid, full_name text, phone text, active_deliveries bigint, completed_deliveries bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_courtage_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.phone,
    (SELECT count(*) FROM public.orders o WHERE o.courier_id = p.id AND o.escrow_status IN ('funds_locked','delivered_pending_code')),
    (SELECT count(*) FROM public.orders o WHERE o.courier_id = p.id AND o.escrow_status = 'completed')
  FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
  WHERE r.role = 'courier';
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_escrow_orders() RETURNS SETOF public.orders
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_courtage_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN QUERY SELECT * FROM public.orders WHERE escrow_status <> 'pending_payment' OR qr_code_secret IS NOT NULL
    ORDER BY created_at DESC LIMIT 300;
END $$;

CREATE OR REPLACE FUNCTION public.admin_assign_courier(p_order_id uuid, p_courier_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_esc text;
BEGIN
  IF NOT public.is_courtage_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT escrow_status INTO v_esc FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_esc IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_esc NOT IN ('funds_locked','delivered_pending_code') THEN RAISE EXCEPTION 'Commande non assignable (statut %)', v_esc; END IF;
  IF p_courier_id IS NOT NULL AND NOT public.has_role(p_courier_id,'courier') THEN RAISE EXCEPTION 'Cet utilisateur n''est pas livreur'; END IF;
  PERFORM set_config('app.escrow_rpc','on',true);
  UPDATE public.orders SET courier_id = p_courier_id,
    status = CASE WHEN p_courier_id IS NULL THEN 'PREPARING'::order_status ELSE 'IN_TRANSIT'::order_status END,
    updated_at = now()
  WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_refund_escrow(p_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  IF NOT public.is_courtage_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF o.escrow_status NOT IN ('funds_locked','delivered_pending_code') THEN RAISE EXCEPTION 'Remboursement impossible (statut %)', o.escrow_status; END IF;
  PERFORM set_config('app.escrow_rpc','on',true);
  PERFORM public.credit_wallet(o.user_id, o.total_amount, 'Remboursement séquestre ' || left(o.id::text,8), o.id);
  UPDATE public.orders SET escrow_status = 'refunded', status = 'CANCELLED', updated_at = now() WHERE id = o.id;
END $$;

REVOKE EXECUTE ON FUNCTION public.is_courtage_admin(uuid), public.admin_set_courier(uuid,boolean),
  public.admin_review_courier_application(uuid,boolean,text), public.admin_list_couriers(),
  public.admin_list_escrow_orders(), public.admin_assign_courier(uuid,uuid), public.admin_refund_escrow(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_courtage_admin(uuid), public.admin_set_courier(uuid,boolean),
  public.admin_review_courier_application(uuid,boolean,text), public.admin_list_couriers(),
  public.admin_list_escrow_orders(), public.admin_assign_courier(uuid,uuid), public.admin_refund_escrow(uuid) TO authenticated;