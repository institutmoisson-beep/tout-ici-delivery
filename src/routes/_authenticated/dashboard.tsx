import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldCheck, ShoppingBag, Wallet as WalletIcon, MapPin, Clock, ChefHat,
  Truck, CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft, LocateFixed,
  UtensilsCrossed, Store, Package, Zap, Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatXof } from "@/lib/distance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const statusMeta: Record<string, { label: string; icon: any; color: string }> = {
  PENDING: { label: "En attente", icon: Clock, color: "text-kaki" },
  PREPARING: { label: "En préparation", icon: ChefHat, color: "text-accent" },
  IN_TRANSIT: { label: "En livraison", icon: Truck, color: "text-primary-glow" },
  DELIVERED: { label: "Livrée", icon: CheckCircle2, color: "text-gold" },
  CANCELLED: { label: "Annulée", icon: XCircle, color: "text-destructive" },
};

function DashboardPage() {
  const { user, isAdmin, domains } = useAuth();
  const qc = useQueryClient();
  const [locating, setLocating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["dash-orders", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("orders")
        .select("*, restaurants(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5)).data ?? [],
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["dash-tx", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5)).data ?? [],
  });

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total_amount,status").eq("user_id", user!.id);
      const rows = data ?? [];
      return {
        totalOrders: rows.length,
        active: rows.filter((r: any) => ["PENDING", "PREPARING", "IN_TRANSIT"].includes(r.status)).length,
        delivered: rows.filter((r: any) => r.status === "DELIVERED").length,
        totalSpent: rows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
      };
    },
  });

  const activateLocation = () => {
    if (!("geolocation" in navigator)) return toast.error("Géolocalisation indisponible");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase
          .from("profiles")
          .update({
            default_latitude: pos.coords.latitude,
            default_longitude: pos.coords.longitude,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", user!.id);
        setLocating(false);
        if (error) return toast.error(error.message);
        toast.success("Localisation activée et enregistrée");
        qc.invalidateQueries({ queryKey: ["profile", user!.id] });
      },
      (err) => {
        setLocating(false);
        toast.error("Autorisation refusée : " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Bonjour {profile?.full_name?.split(" ")[0] ?? "👋"}
          </h1>
          <p className="text-muted-foreground text-sm">Tableau de bord Tout'ICI</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/restaurants">
            <Button variant="outline">
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Explorer les restaurants
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/admin">
              <Button className="bg-gradient-primary shadow-glow border-0">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Console Administration
              </Button>
            </Link>
          )}
        </div>
      </div>

      {(isAdmin || domains.length > 0) && <ManagementSpaces isAdmin={isAdmin} domains={domains} />}

      {/* Recap grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={ShoppingBag} label="Commandes" value={stats?.totalOrders ?? 0} />
        <StatCard icon={Truck} label="En cours" value={stats?.active ?? 0} accent />
        <StatCard icon={CheckCircle2} label="Livrées" value={stats?.delivered ?? 0} />
        <StatCard icon={WalletIcon} label="Solde" value={formatXof(Number(wallet?.balance ?? 0))} />
      </div>

      {/* Location card */}
      <Card className="p-5 mb-6 bg-gradient-card border-border/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
              <MapPin className="h-5 w-5 text-primary-glow" />
            </div>
            <div>
              <p className="font-semibold">Ma localisation</p>
              {profile?.default_latitude ? (
                <p className="text-xs text-muted-foreground">
                  📍 {Number(profile.default_latitude).toFixed(5)}, {Number(profile.default_longitude).toFixed(5)}
                  {profile.location_updated_at && ` · MàJ ${new Date(profile.location_updated_at).toLocaleString("fr-FR")}`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Activez le GPS pour bénéficier du calcul de livraison automatique.
                </p>
              )}
            </div>
          </div>
          <Button onClick={activateLocation} disabled={locating} variant="outline">
            <LocateFixed className="h-4 w-4 mr-2" />
            {locating ? "Localisation..." : profile?.default_latitude ? "Mettre à jour" : "Activer ma localisation"}
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent orders */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold">Historique commandes</h2>
            <Link to="/orders" className="text-xs text-primary-glow hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-2">
            {orders.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground bg-gradient-card border-border/40">
                Aucune commande. <Link to="/restaurants" className="text-primary-glow hover:underline">Commander maintenant</Link>
              </Card>
            )}
            {orders.map((o: any) => {
              const S = statusMeta[o.status] ?? statusMeta.PENDING;
              return (
                <Card key={o.id} className="p-3 bg-gradient-card border-border/40 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{o.restaurants?.name ?? "Restaurant"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      #{o.id.slice(0, 6)} · {new Date(o.created_at).toLocaleDateString("fr-FR")} · {formatXof(Number(o.total_amount))}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("border-current text-[10px]", S.color)}>
                    <S.icon className="h-3 w-3 mr-1" />{S.label}
                  </Badge>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Recent transactions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold">Transactions wallet</h2>
            <Link to="/wallet" className="text-xs text-primary-glow hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-2">
            {txs.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground bg-gradient-card border-border/40">
                Aucune transaction.
              </Card>
            )}
            {txs.map((t: any) => {
              const isCredit = t.type === "RECHARGE" || Number(t.amount) > 0;
              return (
                <Card key={t.id} className="p-3 bg-gradient-card border-border/40 flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-lg grid place-items-center", isCredit ? "bg-gold/15 text-gold" : "bg-primary/15 text-primary-glow")}>
                    {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.reference ?? t.type}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <span className={cn("text-sm font-semibold", isCredit ? "text-gold" : "text-primary-glow")}>
                    {isCredit ? "+" : "-"}{formatXof(Math.abs(Number(t.amount)))}
                  </span>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: boolean }) {
  return (
    <Card className={cn("p-4 bg-gradient-card border-border/40", accent && "ring-1 ring-primary/40")}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-4 w-4" />{label}
      </div>
      <p className="font-display text-xl font-bold">{value}</p>
    </Card>
  );
}