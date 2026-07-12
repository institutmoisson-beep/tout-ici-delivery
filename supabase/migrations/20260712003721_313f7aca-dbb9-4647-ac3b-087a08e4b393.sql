
-- ============ PAYMENT GATEWAYS ============
CREATE TABLE public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL, -- MOBILE_MONEY | CRYPTO | CARD | BANK
  logo_emoji TEXT DEFAULT '💳',
  account_details TEXT,             -- number / wallet address
  deep_link_template TEXT,          -- e.g. wave://send?to={{ACCOUNT}}&amount={{AMOUNT}}
  ussd_deposit_template TEXT,       -- e.g. *133*1*1*{{AMOUNT}}*{{ACCOUNT}}#
  ussd_payout_template TEXT,        -- e.g. *122*4*{{PHONE}}*{{AMOUNT}}#
  qr_payload TEXT,                  -- for crypto: address
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_gateways TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active gateways" ON public.payment_gateways FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manages gateways" ON public.payment_gateways FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_payment_gateways_touch BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ FINANCIAL TRANSACTIONS ============
CREATE TYPE public.fin_tx_type AS ENUM ('PURCHASE','RECHARGE','WITHDRAWAL');
CREATE TYPE public.fin_tx_status AS ENUM ('PENDING','PROCESSING','APPROVED','REJECTED','DISBURSED');

CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.fin_tx_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  gateway_id UUID REFERENCES public.payment_gateways(id),
  payment_method TEXT,
  transaction_reference TEXT,
  proof_url TEXT,
  destination_account TEXT,        -- for withdrawal (user's receiving wallet)
  destination_name TEXT,
  compiled_syntax TEXT,            -- resolved USSD prepared for admin payout
  status public.fin_tx_status NOT NULL DEFAULT 'PENDING',
  admin_note TEXT,
  associated_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or admin" ON public.financial_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "create own recharge or withdrawal" ON public.financial_transactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND type IN ('RECHARGE','WITHDRAWAL')
    AND status = 'PENDING'
  );

CREATE POLICY "admin updates" ON public.financial_transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_fin_tx_touch BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ensure wallets row exists (used by triggers)
CREATE OR REPLACE FUNCTION public.ensure_wallet(_uid UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal NUMERIC;
BEGIN
  INSERT INTO public.wallets(user_id, balance) VALUES (_uid, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO bal FROM public.wallets WHERE user_id = _uid;
  RETURN COALESCE(bal, 0);
END; $$;

-- Freeze balance immediately when a WITHDRAWAL is requested (INSERT PENDING)
CREATE OR REPLACE FUNCTION public.fin_tx_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur NUMERIC;
BEGIN
  IF NEW.type = 'WITHDRAWAL' AND NEW.status = 'PENDING' THEN
    cur := public.ensure_wallet(NEW.user_id);
    IF cur < NEW.amount THEN
      RAISE EXCEPTION 'Solde insuffisant pour le retrait (solde: %, demandé: %)', cur, NEW.amount;
    END IF;
    UPDATE public.wallets SET balance = balance - NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, reference)
      VALUES (NEW.user_id, 'DEBIT', NEW.amount, cur - NEW.amount, 'Retrait #' || substr(NEW.id::text,1,8) || ' (gelé)');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fin_tx_ai AFTER INSERT ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fin_tx_after_insert();

-- Handle status transitions
CREATE OR REPLACE FUNCTION public.fin_tx_after_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur NUMERIC;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- RECHARGE approved => credit wallet
  IF NEW.type = 'RECHARGE' AND NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED' THEN
    cur := public.ensure_wallet(NEW.user_id);
    UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, reference)
      VALUES (NEW.user_id, 'RECHARGE', NEW.amount, cur + NEW.amount, 'Recharge ' || COALESCE(NEW.payment_method,'') || ' #' || substr(NEW.id::text,1,8));
  END IF;

  -- WITHDRAWAL rejected => refund frozen amount
  IF NEW.type = 'WITHDRAWAL' AND NEW.status = 'REJECTED' AND OLD.status IN ('PENDING','PROCESSING') THEN
    cur := public.ensure_wallet(NEW.user_id);
    UPDATE public.wallets SET balance = balance + NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, reference)
      VALUES (NEW.user_id, 'REFUND', NEW.amount, cur + NEW.amount, 'Retrait rejeté #' || substr(NEW.id::text,1,8));
  END IF;

  -- WITHDRAWAL disbursed => already debited on insert, just stamp processed_at
  IF NEW.status IN ('APPROVED','REJECTED','DISBURSED') AND NEW.processed_at IS NULL THEN
    NEW.processed_at := now();
    NEW.processed_by := auth.uid();
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fin_tx_au BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fin_tx_after_update();

-- Seed sample gateways
INSERT INTO public.payment_gateways (method_name, display_name, category, logo_emoji, account_details, deep_link_template, ussd_deposit_template, ussd_payout_template, instructions, sort_order) VALUES
('WAVE','Wave','MOBILE_MONEY','🌊','+2250700000000','wave.com/pay?recipient={{ACCOUNT}}&amount={{AMOUNT}}',NULL,NULL,'Envoyez le montant exact au numéro Wave ci-dessus puis collez la référence de transaction.',1),
('ORANGE_MONEY','Orange Money','MOBILE_MONEY','🟠','+2250700000001',NULL,'#144*82*{{ACCOUNT}}*{{AMOUNT}}#','#144*82*{{PHONE}}*{{AMOUNT}}#','Composez la syntaxe USSD affichée pour transférer.',2),
('MTN_MOMO','MTN MoMo','MOBILE_MONEY','🟡','+2250500000002',NULL,'*133*1*1*{{ACCOUNT}}*{{AMOUNT}}#','*133*2*1*{{PHONE}}*{{AMOUNT}}#','Utilisez la syntaxe MTN pour envoyer.',3),
('MOOV_MONEY','Moov Money','MOBILE_MONEY','🔵','+2250100000003',NULL,'*155*1*{{ACCOUNT}}*{{AMOUNT}}#','*155*2*{{PHONE}}*{{AMOUNT}}#','Composez le code Moov.',4),
('USDT_TRC20','USDT (TRC20)','CRYPTO','🪙','TXxxxxxxxxxxxxxxxxxxxxxxxxxxxx',NULL,NULL,NULL,'Envoyez l''équivalent en USDT sur le réseau TRC20. Réseau incorrect = perte.',5),
('BTC','Bitcoin','CRYPTO','₿','bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',NULL,NULL,NULL,'Envoyez le montant équivalent en BTC.',6);
