  import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star, Clock, CheckCircle2, Truck, ChefHat, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatXof } from "@/lib/distance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

const statusMeta: Record<string, { label: string; icon: any; color: string }> = {
  PENDING: { label: "En attente", icon: Clock, color: "text-kaki" },
  PREPARING: { label: "En préparation", icon: ChefHat, color: "text-accent" },
  IN_TRANSIT: { label: "En livraison", icon: Truck, color: "text-primary-glow" },
  DELIVERED: { label: "Livrée", icon: CheckCircle2, color: "text-gold" },
  CANCELLED: { label: "Annulée", icon: XCircle, color: "text-destructive" },
};

type Period = "ALL" | "DAY" | "MONTH" | "YEAR";
function periodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "DAY": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "MONTH": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "YEAR": return new Date(now.getFullYear(), 0, 1);
    default: return null;
  }
}
const periodLabel: Record<Period, string> = { ALL: "Tout", DAY: "Aujourd'hui", MONTH: "Ce mois", YEAR: "Cette année" };

function OrdersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("ALL");
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, restaurants(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const from = periodStart(period);
  const filteredOrders = orders.filter((o: any) => {
    if (from && new Date(o.created_at) < from) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const matchesSearch =
        o.id.toLowerCase().includes(s) ||
        o.restaurants?.name?.toLowerCase().includes(s) ||
        statusMeta[o.status]?.label.toLowerCase().includes(s);
      if (!matchesSearch) return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-6">Mes commandes</h1>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <Input
          placeholder="Rechercher par restaurant, statut ou n° de commande..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DAY", "MONTH", "YEAR"] as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
              {periodLabel[p]}
            </Button>
          ))}
        </div>
      </div>

      {orders.length === 0 && <p className="text-center py-16 text-muted-foreground">Aucune commande pour le moment.</p>}
      {orders.length > 0 && filteredOrders.length === 0 && <p className="text-center py-16 text-muted-foreground">Aucune commande ne correspond à votre recherche.</p>}
      <div className="space-y-4">
        {filteredOrders.map((o: any) => {
          const S = statusMeta[o.status];
          return (
            <Card key={o.id} className="p-5 bg-gradient-card border-border/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold">{o.restaurants?.name}</h3>
                  <p className="text-xs text-muted-foreground">#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <Badge variant="outline" className={cn("border-current", S.color)}>
                  <S.icon className="h-3 w-3 mr-1" />{S.label}
                </Badge>
              </div>
              <ul className="mt-3 text-sm space-y-1">
                {(o.items as any[]).map((i, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{i.quantity}× {i.name}</span>
                    <span className="text-muted-foreground">{formatXof(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{o.delivery_mode === "EXPRESS" ? `Livraison ${o.calculated_distance_km ?? 0} km` : "Point relais"}</span>
                <span className="font-display text-lg text-primary-glow font-bold">{formatXof(Number(o.total_amount))}</span>
              </div>
              {o.status === "DELIVERED" && !o.user_rating && (
                <RatingBlock orderId={o.id} onDone={() => qc.invalidateQueries({ queryKey: ["orders"] })} />
              )}
              {o.user_rating && (
                <div className="mt-3 flex items-center gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-4 w-4", i < o.user_rating ? "fill-current" : "opacity-30")} />
                  ))}
                  {o.user_review && <span className="text-xs text-muted-foreground ml-2">"{o.user_review}"</span>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RatingBlock({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating === 0) return toast.error("Donnez une note");
    setSaving(true);
    const { error } = await supabase.from("orders").update({ user_rating: rating, user_review: review }).eq("id", orderId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Merci pour votre avis !");
    onDone();
  };

  return (
    <div className="mt-4 p-3 rounded-lg bg-secondary/40 border border-border/40">
      <p className="text-sm font-medium mb-2">Noter cette commande</p>
      <div className="flex gap-1 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} onClick={() => setRating(i + 1)}>
            <Star className={cn("h-6 w-6 transition", i < rating ? "fill-gold text-gold" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      <Textarea placeholder="Un mot pour le restaurant..." value={review} onChange={(e) => setReview(e.target.value)} maxLength={300} />
      <Button size="sm" onClick={submit} disabled={saving} className="mt-2 bg-gradient-primary border-0">Envoyer</Button>
    </div>
  );
}          
