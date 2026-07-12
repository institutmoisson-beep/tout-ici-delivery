import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Copy,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatXof } from "@/lib/distance";
import { resolveTemplate, encodeQr, GATEWAY_CATEGORIES } from "@/lib/gateway";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["wallet-tx", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50)).data ?? [],
  });

  const { data: myFinTx = [] } = useQuery({
    queryKey: ["fin-tx", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("financial_transactions")
        .select("*, payment_gateways(display_name, logo_emoji)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50)).data ?? [],
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-primary-glow" />
        <h1 className="font-display text-3xl md:text-4xl font-bold">MSN Smart Wallet</h1>
      </div>

      <Card className="p-6 bg-gradient-primary shadow-elegant border-0 mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-3 text-primary-foreground relative">
          <WalletIcon className="h-6 w-6" />
          <p className="text-sm opacity-80">Solde disponible</p>
        </div>
        <p className="font-display text-5xl font-bold text-primary-foreground mt-3 relative">
          {formatXof(Number(wallet?.balance ?? 0))}
        </p>
        <p className="text-xs text-primary-foreground/70 mt-1 relative">
          Passerelle indépendante · sans intermédiaire
        </p>
      </Card>

      <Tabs defaultValue="recharge">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recharge">Recharger</TabsTrigger>
          <TabsTrigger value="withdraw">Retirer</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="recharge" className="mt-6">
          <RechargeFlow />
        </TabsContent>

        <TabsContent value="withdraw" className="mt-6">
          <WithdrawFlow balance={Number(wallet?.balance ?? 0)} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <FinTxHistory list={myFinTx} />
          <h3 className="font-display text-lg font-semibold mt-8 mb-3">Journal du portefeuille</h3>
          {txs.length === 0 && <p className="text-center text-muted-foreground py-6">Aucun mouvement</p>}
          <div className="space-y-2">
            {txs.map((t: any) => {
              const positive = t.type === "RECHARGE" || t.type === "CREDIT" || t.type === "REFUND";
              return (
                <Card key={t.id} className="p-3 bg-gradient-card border-border/40 flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-full grid place-items-center", positive ? "bg-gold/20 text-gold" : "bg-primary/20 text-primary-glow")}>
                    {positive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.reference ?? t.type}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(t.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span className={cn("font-semibold", positive ? "text-gold" : "text-foreground")}>
                    {positive ? "+" : "−"}
                    {formatXof(Number(t.amount))}
                  </span>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ RECHARGE ============
function RechargeFlow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: gateways = [] } = useQuery({
    queryKey: ["gateways-active"],
    queryFn: async () =>
      (await supabase.from("payment_gateways").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    gateways.forEach((gw: any) => {
      (g[gw.category] ??= []).push(gw);
    });
    return g;
  }, [gateways]);

  const amountNum = Number(amount) || 0;
  const deepLink = selected ? resolveTemplate(selected.deep_link_template, { ACCOUNT: selected.account_details ?? "", AMOUNT: amountNum }) : "";
  const ussd = selected ? resolveTemplate(selected.ussd_deposit_template, { ACCOUNT: selected.account_details ?? "", AMOUNT: amountNum }) : "";

  const copy = async (text: string, label = "Copié") => {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const submit = async () => {
    if (!user) return;
    if (amountNum <= 0) return toast.error("Montant invalide");
    if (!selected) return toast.error("Choisissez un moyen de paiement");
    if (!reference.trim()) return toast.error("Référence de transaction requise");
    setSubmitting(true);
    const { error } = await supabase.from("financial_transactions").insert({
      user_id: user.id,
      type: "RECHARGE",
      amount: amountNum,
      gateway_id: selected.id,
      payment_method: selected.display_name,
      transaction_reference: reference.trim(),
      proof_url: proofUrl || null,
      admin_note: note || null,
      status: "PENDING",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Demande envoyée. L'admin va vérifier et créditer.");
    setAmount(""); setReference(""); setProofUrl(""); setNote(""); setSelected(null);
    qc.invalidateQueries({ queryKey: ["fin-tx"] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-gradient-card border-border/40">
        <Label>Montant à recharger</Label>
        <div className="relative mt-2">
          <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-14 text-2xl font-display pr-20" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">F CFA</span>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {[1000, 5000, 10000, 25000].map((v) => (
            <Button key={v} type="button" size="sm" variant="outline" onClick={() => setAmount(String(v))}>
              +{formatXof(v)}
            </Button>
          ))}
        </div>
      </Card>

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Sélectionnez un moyen de paiement</h3>
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {GATEWAY_CATEGORIES[cat as keyof typeof GATEWAY_CATEGORIES] ?? cat}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((gw: any) => (
                <button
                  key={gw.id}
                  onClick={() => setSelected(gw)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all",
                    selected?.id === gw.id
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border/50 bg-gradient-card hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{gw.logo_emoji}</span>
                    <div>
                      <p className="font-semibold">{gw.display_name}</p>
                      <p className="text-xs text-muted-foreground">{cat.replace("_", " ")}</p>
                    </div>
                    {selected?.id === gw.id && <CheckCircle2 className="ml-auto h-5 w-5 text-primary-glow" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <Card className="p-5 bg-charcoal/50 border-primary/30 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Instructions {selected.display_name}</p>
              <p className="font-display text-2xl font-bold text-primary-glow">{formatXof(amountNum)}</p>
            </div>
            <span className="text-4xl">{selected.logo_emoji}</span>
          </div>

          {selected.category === "CRYPTO" && selected.account_details && (
            <div className="flex flex-col items-center gap-3 py-3">
              <img src={encodeQr(selected.account_details)} alt="QR" className="rounded-lg border border-border/40" />
              <code className="text-xs break-all text-center bg-secondary/50 p-2 rounded">{selected.account_details}</code>
              <Button size="sm" variant="outline" onClick={() => copy(selected.account_details, "Adresse copiée")}>
                <Copy className="h-3 w-3 mr-2" />Copier l'adresse
              </Button>
            </div>
          )}

          {selected.category !== "CRYPTO" && selected.account_details && (
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Compte de réception</p>
                <p className="font-mono font-semibold">{selected.account_details}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copy(selected.account_details, "Numéro copié")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {ussd && amountNum > 0 && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3">
              <div>
                <p className="text-xs text-primary-glow uppercase">Syntaxe USSD prête</p>
                <p className="font-mono font-bold text-lg">{ussd}</p>
              </div>
              <Button size="sm" onClick={() => copy(ussd, "Code USSD copié")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {deepLink && amountNum > 0 && (
            <a href={deepLink.startsWith("http") ? deepLink : `https://${deepLink}`} target="_blank" rel="noreferrer">
              <Button className="w-full bg-gradient-primary border-0 mb-3">
                <ExternalLink className="h-4 w-4 mr-2" />Ouvrir {selected.display_name}
              </Button>
            </a>
          )}

          {selected.instructions && <p className="text-xs text-muted-foreground italic mb-3">{selected.instructions}</p>}

          <div className="space-y-3 mt-4 pt-4 border-t border-border/30">
            <div>
              <Label>Référence / ID de transaction *</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex: TX-982374" className="mt-1" />
            </div>
            <div>
              <Label>URL de la capture d'écran (optionnel)</Label>
              <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Info complémentaire..." className="mt-1" />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gradient-primary border-0 shadow-glow">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre pour vérification
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ WITHDRAW ============
function WithdrawFlow({ balance }: { balance: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [destAccount, setDestAccount] = useState("");
  const [destName, setDestName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: gateways = [] } = useQuery({
    queryKey: ["gateways-payout"],
    queryFn: async () =>
      (await supabase.from("payment_gateways").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });

  const amountNum = Number(amount) || 0;

  const submit = async () => {
    if (!user) return;
    if (amountNum <= 0) return toast.error("Montant invalide");
    if (amountNum > balance) return toast.error("Solde insuffisant");
    if (!selected) return toast.error("Choisissez un canal de retrait");
    if (!destAccount.trim()) return toast.error("Numéro/adresse de réception requis");

    const compiled = resolveTemplate(selected.ussd_payout_template, {
      PHONE: destAccount.trim(),
      WALLET: destAccount.trim(),
      ACCOUNT: destAccount.trim(),
      AMOUNT: amountNum,
    });

    setSubmitting(true);
    const { error } = await supabase.from("financial_transactions").insert({
      user_id: user.id,
      type: "WITHDRAWAL",
      amount: amountNum,
      gateway_id: selected.id,
      payment_method: selected.display_name,
      destination_account: destAccount.trim(),
      destination_name: destName.trim() || null,
      compiled_syntax: compiled || null,
      status: "PENDING",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Retrait en attente. Le solde a été gelé.");
    setAmount(""); setDestAccount(""); setDestName(""); setSelected(null);
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    qc.invalidateQueries({ queryKey: ["fin-tx"] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-gradient-card border-border/40">
        <Label>Montant à retirer</Label>
        <div className="relative mt-2">
          <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-14 text-2xl font-display pr-20" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">F CFA</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Solde disponible : <span className="text-foreground font-semibold">{formatXof(balance)}</span>
        </p>
      </Card>

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Canal de réception</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {gateways.map((gw: any) => (
            <button
              key={gw.id}
              onClick={() => setSelected(gw)}
              className={cn(
                "text-left p-4 rounded-xl border transition-all",
                selected?.id === gw.id ? "border-primary bg-primary/10 shadow-glow" : "border-border/50 bg-gradient-card hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{gw.logo_emoji}</span>
                <div>
                  <p className="font-semibold">{gw.display_name}</p>
                  <p className="text-xs text-muted-foreground">{GATEWAY_CATEGORIES[gw.category as keyof typeof GATEWAY_CATEGORIES] ?? gw.category}</p>
                </div>
                {selected?.id === gw.id && <CheckCircle2 className="ml-auto h-5 w-5 text-primary-glow" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <Card className="p-5 bg-gradient-card border-border/40 space-y-3">
          <div>
            <Label>Numéro / adresse de réception *</Label>
            <Input value={destAccount} onChange={(e) => setDestAccount(e.target.value)} placeholder={selected.category === "CRYPTO" ? "Adresse wallet" : "+225 07 00 00 00 00"} className="mt-1" />
          </div>
          <div>
            <Label>Nom du titulaire</Label>
            <Input value={destName} onChange={(e) => setDestName(e.target.value)} placeholder="Prénom Nom" className="mt-1" />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gradient-primary border-0 shadow-glow">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Demander le retrait de {formatXof(amountNum)}
          </Button>
          <p className="text-xs text-muted-foreground">Le montant sera gelé immédiatement pour éviter le double-dépense. L'admin décaissera puis validera.</p>
        </Card>
      )}
    </div>
  );
}

// ============ HISTORY ============
function FinTxHistory({ list }: { list: any[] }) {
  if (list.length === 0) return <p className="text-center text-muted-foreground py-8">Aucune transaction MSN</p>;
  return (
    <div className="space-y-3">
      {list.map((t) => (
        <Card key={t.id} className="p-4 bg-gradient-card border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.payment_gateways?.logo_emoji ?? "💠"}</span>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  {t.type === "WITHDRAWAL" ? "Retrait" : t.type === "RECHARGE" ? "Recharge" : "Achat"}
                  <span className="text-xs text-muted-foreground">· {t.payment_method}</span>
                </p>
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</p>
                {t.transaction_reference && <p className="text-xs mt-1">Réf: <code>{t.transaction_reference}</code></p>}
                {t.destination_account && <p className="text-xs mt-1">Vers: <code>{t.destination_account}</code></p>}
                {t.admin_note && <p className="text-xs italic text-muted-foreground mt-1">"{t.admin_note}"</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-bold text-primary-glow">{formatXof(Number(t.amount))}</p>
              <StatusBadge status={t.status} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    PENDING: "bg-kaki/20 text-kaki border-kaki/40",
    PROCESSING: "bg-primary/20 text-primary-glow border-primary/40",
    APPROVED: "bg-gold/20 text-gold border-gold/40",
    DISBURSED: "bg-gold/20 text-gold border-gold/40",
    REJECTED: "bg-destructive/20 text-destructive border-destructive/40",
  };
  const label: Record<string, string> = {
    PENDING: "En attente",
    PROCESSING: "En traitement",
    APPROVED: "Approuvé",
    DISBURSED: "Décaissé",
    REJECTED: "Rejeté",
  };
  return <Badge variant="outline" className={cn("mt-1", style[status])}>{label[status] ?? status}</Badge>;
}
