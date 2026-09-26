import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ShieldCheck, Loader2, CheckCircle2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatXof } from "@/lib/distance";
import {
  commissionPreview,
  createEscrowOrder,
  type CartLineInput,
  type DeliveryMode,
  type EscrowOrder,
} from "@/lib/courtage";

/**
 * Composant principal du flux de paiement séquestré (Escrow Checkout).
 *
 * Étapes : (1) rappel du montant + explication du séquestre + solde
 * portefeuille, (2) paiement (débit + verrouillage des fonds en un seul
 * appel atomique), (3) Pass QR affiché tant que la commande n'est pas
 * livrée, avec bascule automatique en temps réel dès que le livreur a
 * scanné le code et que les fonds ont été libérés.
 *
 * Réutilisable tel quel dans n'importe quel écran de commande — il ne
 * dépend que des props ci-dessous, pas de l'état du panier maison.
 */
export function EscrowCheckout({
  restaurantId,
  restaurantName,
  items,
  deliveryMode,
  pointRelaisId,
  clientLatitude,
  clientLongitude,
  clientAddress,
  deliveryCity,
  subtotal,
  deliveryFee,
  commissionRate = 0.07,
  onCompleted,
}: {
  restaurantId: string;
  restaurantName: string;
  items: CartLineInput[];
  deliveryMode: DeliveryMode;
  pointRelaisId?: string | null;
  clientLatitude?: number | null;
  clientLongitude?: number | null;
  clientAddress?: string | null;
  deliveryCity: string;
  subtotal: number;
  deliveryFee: number;
  commissionRate?: number;
  onCompleted?: (orderId: string) => void;
}) {
  const { user } = useAuth();
  const [stage, setStage] = useState<"review" | "paying" | "locked" | "completed">("review");
  const [order, setOrder] = useState<{ id: string; qr: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const total = subtotal + deliveryFee;
  const commission = commissionPreview(subtotal, commissionRate);

  const wallet = useQuery({
    queryKey: ["wallet-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle();
      return data?.balance ?? 0;
    },
  });

  useEffect(() => {
    if (!order) return;
    void QRCode.toDataURL(order.qr, { margin: 1, width: 260 }).then(setQrDataUrl);
  }, [order]);

  // Bascule automatique dès que le livreur valide le QR et que les
  // fonds sont libérés (mise à jour Realtime de la commande).
  useEffect(() => {
    if (!order) return;
    const channel = supabase
      .channel(`escrow-order:${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload: { new: EscrowOrder }) => {
          if (payload.new.escrow_status === "completed") {
            setStage("completed");
            onCompleted?.(order.id);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [order, onCompleted]);

  async function pay() {
    if (!user) return;
    setStage("paying");
    try {
      const result = await createEscrowOrder({
        restaurantId,
        items,
        deliveryMode,
        pointRelaisId,
        clientLatitude,
        clientLongitude,
        clientAddress,
        deliveryCity,
        subtotal,
        deliveryFee,
        commissionRate,
      });
      setOrder({ id: result.orderId, qr: result.qrCodeSecret });
      setStage("locked");
    } catch (e) {
      setStage("review");
      toast.error("Paiement impossible", {
        description: e instanceof Error ? e.message : "Solde insuffisant ou erreur réseau",
      });
    }
  }

  if (stage === "locked" && order) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-[#D4AF37]" />
        <h3 className="text-lg font-semibold">Fonds sécurisés</h3>
        <p className="text-sm text-muted-foreground">
          Présentez ce code au livreur uniquement à la réception de votre plat. Le restaurateur et le livreur ne
          seront payés qu'à ce moment-là.
        </p>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Code QR de remise" className="mx-auto rounded-lg border" width={260} height={260} />
        ) : (
          <div className="mx-auto flex h-[260px] w-[260px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <p className="font-mono text-xs text-muted-foreground">Commande #{order.id.slice(0, 8)}</p>
      </Card>
    );
  }

  if (stage === "completed" && order) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <h3 className="text-lg font-semibold">Livraison confirmée</h3>
        <p className="text-sm text-muted-foreground">
          Le paiement a été libéré vers le restaurateur et le livreur. Merci pour votre commande !
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Paiement sécurisé — {restaurantName}</h3>
        <p className="text-sm text-muted-foreground">Sous-total : {formatXof(subtotal)}</p>
        <p className="text-sm text-muted-foreground">Livraison : {formatXof(deliveryFee)}</p>
        <p className="text-sm text-muted-foreground">
          Commission courtage ({Math.round(commissionRate * 100)} %) : {formatXof(commission)}, incluse dans le
          sous-total reversé au restaurateur.
        </p>
        <p className="mt-2 text-base font-semibold">Total à payer : {formatXof(total)}</p>
      </div>

      <Alert className="border-[#D4AF37]/40 bg-[#D4AF37]/5">
        <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
        <AlertTitle>Paiement en séquestre</AlertTitle>
        <AlertDescription>
          Vos fonds sont sécurisés. Le restaurateur ne sera payé qu'une fois votre plat livré et votre QR Code
          scanné.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-4 w-4" /> Solde portefeuille
        </span>
        <span className="font-semibold">{wallet.isLoading ? "…" : formatXof(wallet.data ?? 0)}</span>
      </div>

      {(wallet.data ?? 0) < total ? (
        <Alert variant="destructive">
          <AlertTitle>Solde insuffisant</AlertTitle>
          <AlertDescription>
            Rechargez votre portefeuille (Wave, Orange Money, MTN, Moov) avant de continuer.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="w-full bg-[#0F0F0F] text-white hover:bg-[#0F0F0F]/90"
        disabled={stage === "paying" || (wallet.data ?? 0) < total}
        onClick={() => void pay()}
      >
        {stage === "paying" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Payer {formatXof(total)} en toute sécurité
      </Button>
    </Card>
  );
}
