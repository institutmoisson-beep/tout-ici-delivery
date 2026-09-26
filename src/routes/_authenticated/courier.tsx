import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Package, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { formatXof, IVORIAN_CITIES } from "@/lib/distance";
import { QrDeliveryScanner } from "@/components/courtage/QrDeliveryScanner";
import {
  courierAcceptDelivery,
  fetchAvailableDeliveries,
  fetchMyCourierDeliveries,
  type EscrowOrder,
} from "@/lib/courtage";

export const Route = createFileRoute("/_authenticated/courier")({
  component: CourierSpacePage,
});

function CourierSpacePage() {
  const { isCourier, loading } = useAuth();
  const qc = useQueryClient();
  const [city, setCity] = useState<string>("all");
  const [active, setActive] = useState<EscrowOrder | null>(null);

  const mine = useQuery({
    queryKey: ["courier-mine"],
    enabled: isCourier,
    queryFn: fetchMyCourierDeliveries,
    refetchInterval: 8000,
  });

  const available = useQuery({
    queryKey: ["courier-available", city],
    enabled: isCourier,
    queryFn: () => fetchAvailableDeliveries(city === "all" ? null : city),
    refetchInterval: 8000,
  });

  const inTransit = (mine.data ?? []).filter((o) => o.status === "IN_TRANSIT" && o.escrow_status !== "completed");

  async function accept(orderId: string) {
    try {
      await courierAcceptDelivery(orderId);
      toast.success("Livraison prise en charge");
      await Promise.all([qc.invalidateQueries({ queryKey: ["courier-mine"] }), qc.invalidateQueries({ queryKey: ["courier-available"] })]);
    } catch (e) {
      toast.error("Impossible d'accepter", { description: e instanceof Error ? e.message : "Erreur" });
    }
  }

  if (loading) return null;

  if (!isCourier) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <ShieldOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Cet espace est réservé aux livreurs enregistrés. Contactez un administrateur pour activer votre compte.
        </p>
      </div>
    );
  }

  if (active) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4">
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          ← Retour à mes livraisons
        </Button>
        <QrDeliveryScanner
          orderId={active.id}
          onReleased={() => {
            setActive(null);
            void qc.invalidateQueries({ queryKey: ["courier-mine"] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Espace livreur</h1>

      {inTransit.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">En cours de livraison</h2>
          {inTransit.map((o) => (
            <Card key={o.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Commande #{o.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">{formatXof(o.delivery_fee)} de frais de livraison</p>
              </div>
              <Button onClick={() => setActive(o)}>Scanner à la remise</Button>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Livraisons disponibles</h2>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {IVORIAN_CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(available.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune livraison disponible pour le moment.</p>
        ) : (
          (available.data ?? []).map((o) => (
            <Card key={o.id} className="flex items-center justify-between p-4">
              <div>
                <p className="flex items-center gap-1 font-medium">
                  <Package className="h-4 w-4" /> Commande #{o.id.slice(0, 8)}
                </p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {o.delivery_city ?? "Ville non précisée"} ·{" "}
                  {formatXof(o.delivery_fee)} de frais
                </p>
              </div>
              <Button variant="secondary" onClick={() => void accept(o.id)}>
                Accepter
              </Button>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
