import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatXof } from "@/lib/distance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("Orange Money");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["wallet-tx", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallet_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const { data: recharges = [] } = useQuery({
    queryKey: ["recharges", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("recharge_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Montant invalide");
    if (!ref) return toast.error("Référence de transaction requise");
    setSaving(true);
    const { error } = await supabase.from("recharge_requests").insert({
      user_id: user!.id,
      amount: n,
      payment_channel: channel,
      payment_ref: ref,
      note,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Demande envoyée. L'admin la validera bientôt.");
    setOpen(false);
    setAmount(""); setRef(""); setNote("");
    qc.invalidateQueries({ queryKey: ["recharges"] });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Mon portefeuille</h1>
      </div>

      <Card className="p-6 bg-gradient-primary shadow-elegant border-0 mb-6">
        <div className="flex items-center gap-3 text-primary-foreground">
          <WalletIcon className="h-6 w-6" />
          <p className="text-sm opacity-80">Solde disponible</p>
        </div>
        <p className="font-display text-5xl font-bold text-primary-foreground mt-3">
          {formatXof(Number(wallet?.balance ?? 0))}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="mt-5 bg-background/20 hover:bg-background/30 text-primary-foreground border border-primary-foreground/30">
              <Plus className="h-4 w-4 mr-2" />Recharger
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Demande de recharge</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Montant (FCFA)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div>
                <Label>Canal de paiement</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Orange Money">Orange Money</SelectItem>
                    <SelectItem value="MTN Money">MTN Money</SelectItem>
                    <SelectItem value="Moov Money">Moov Money</SelectItem>
                    <SelectItem value="Wave">Wave</SelectItem>
                    <SelectItem value="Virement bancaire">Virement bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Référence transaction</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ID de transaction envoyée" /></div>
              <div><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Info complémentaire..." /></div>
              <Button onClick={submit} disabled={saving} className="w-full bg-gradient-primary border-0">{saving ? "..." : "Envoyer la demande"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {recharges.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold mb-3">Recharges en cours</h2>
          <div className="space-y-2">
            {recharges.map((r: any) => (
              <Card key={r.id} className="p-4 bg-gradient-card border-border/40 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{formatXof(Number(r.amount))}</p>
                  <p className="text-xs text-muted-foreground">{r.payment_channel} · {r.payment_ref}</p>
                </div>
                <Badge className={cn(
                  r.status === "APPROVED" && "bg-gold/20 text-gold border-gold/40",
                  r.status === "PENDING" && "bg-kaki/20 text-kaki border-kaki/40",
                  r.status === "REJECTED" && "bg-destructive/20 text-destructive border-destructive/40"
                )} variant="outline">
                  {r.status}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display text-xl font-semibold mb-3">Historique</h2>
      {txs.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune transaction</p>}
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
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(t.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <span className={cn("font-semibold", positive ? "text-gold" : "text-foreground")}>{positive ? "+" : "−"}{formatXof(Number(t.amount))}</span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}