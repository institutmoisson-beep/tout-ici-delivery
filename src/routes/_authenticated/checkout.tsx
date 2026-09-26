import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarIcon, MapPin, Navigation, AlertTriangle, Wallet, Banknote, Trash2, Store } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { haversineKm, formatXof } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, restaurantId, subtotal, updateQty, removeItem, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"EXPRESS" | "RELAIS" | "PICKUP">("PICKUP");
  const [pointRelaisId, setPointRelaisId] = useState<string>("");
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [payment, setPayment] = useState<"WALLET" | "CASH">("WALLET");
  const [cguAccepted, setCguAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-cart", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("id", restaurantId!).maybeSingle();
      return data;
    },
  });

  const { data: relais = [] } = useQuery({
    queryKey: ["relais-all"],
    enabled: !!restaurant,
    queryFn: async () => {
      const { data } = await supabase.from("points_relais").select("*").eq("is_active", true).order("city");
      return data ?? [];
    },
  });

  const { data: pricing } = useQuery({
    queryKey: ["delivery-pricing"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_delivery_pricing");
      return (Array.isArray(data) ? data[0] : data) ?? null;
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: async () => ((await (supabase as any).rpc("list_holiday_dates")).data as any[] | null) ?? [],
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("cgu_accepted_at,full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.cgu_accepted_at) setCguAccepted(true);
  }, [profile]);

  const distanceKm = useMemo(() => {
    if (mode !== "EXPRESS" || !restaurant || !clientCoords) return null;
    return haversineKm(restaurant.latitude, restaurant.longitude, clientCoords.lat, clientCoords.lng);
  }, [mode, restaurant, clientCoords]);

  const selectedRelais = useMemo(
    () => (relais as any[]).find((r) => r.id === pointRelaisId) ?? null,
    [relais, pointRelaisId]
  );

  const relaisDistanceKm = useMemo(() => {
    if (mode !== "RELAIS" || !restaurant || !selectedRelais?.latitude || !selectedRelais?.longitude) return null;
    return haversineKm(restaurant.latitude, restaurant.longitude, selectedRelais.latitude, selectedRelais.longitude);
  }, [mode, restaurant, selectedRelais]);

  const { fee: deliveryFee, breakdown } = useMemo(() => {
    if (mode === "PICKUP") return { fee: 0, breakdown: [] as string[] };
    if (!pricing) return { fee: 0, breakdown: [] };
    const now = scheduled && scheduledDate ? new Date(`${format(scheduledDate, "yyyy-MM-dd")}T${scheduledTime}:00`) : new Date();
    const hour = now.getHours();
    const dow = now.getDay();
    const nightStart = Number(pricing.night_start_hour);
    const nightEnd = Number(pricing.night_end_hour);
    const isNight = nightStart > nightEnd ? hour >= nightStart || hour < nightEnd : hour >= nightStart && hour < nightEnd;
    const isWeekend = dow === 0 || dow === 6;
    const dateStr = format(now, "yyyy-MM-dd");
    const isHoliday = holidays.some((h: any) => h.holiday_date === dateStr);
    const isStrike = !!pricing.strike_active;

    let km = 0;
    if (mode === "EXPRESS") km = distanceKm ?? 0;
    else if (mode === "RELAIS") km = relaisDistanceKm ?? 0;
    if (km === 0) return { fee: 0, breakdown: [] };

    let base = km * Number(pricing.base_per_km);
    const bd: string[] = [`${km} km × ${formatXof(Number(pricing.base_per_km))}/km`];
    if (isNight) { base *= Number(pricing.night_multiplier); bd.push(`Nuit ×${pricing.night_multiplier}`); }
    if (isHoliday) { base *= Number(pricing.holiday_multiplier); bd.push(`Férié ×${pricing.holiday_multiplier}`); }
    else if (isWeekend) { base *= Number(pricing.weekend_multiplier); bd.push(`Week-end ×${pricing.weekend_multiplier}`); }
    if (isStrike) { base *= Number(pricing.strike_multiplier); bd.push(`Grève ×${pricing.strike_multiplier}`); }
    const isIntercity = mode === "RELAIS" && selectedRelais && restaurant && selectedRelais.city !== restaurant.city;
    if (isIntercity) { base += Number(pricing.intercity_flat_surcharge); bd.push(`Interville +${formatXof(Number(pricing.intercity_flat_surcharge))}`); }
    const fee = Math.max(Math.round(base), Number(pricing.minimum_fee));
    if (fee === Number(pricing.minimum_fee)) bd.push(`Minimum : ${formatXof(fee)}`);
    return { fee, breakdown: bd };
  }, [mode, pricing, holidays, distanceKm, relaisDistanceKm, scheduled, scheduledDate, scheduledTime, selectedRelais, restaurant]);

  const isLongDistance = (distanceKm ?? 0) > 15;
  const total = subtotal + deliveryFee;

  // Force non-CASH for long distance
  useEffect(() => {
    if (isLongDistance && payment === "CASH") setPayment("WALLET");
  }, [isLongDistance, payment]);

  const captureGps = () => {
    if (!("geolocation" in navigator)) return toast.error("GPS non supporté par votre appareil");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Position GPS capturée");
        setLocating(false);
      },
      (err) => {
        toast.error("Autorisation GPS refusée : " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const submit = async () => {
    if (!user || !restaurant || items.length === 0) return;
    if (!cguAccepted) return toast.error("Veuillez accepter les CGU/CGV");
    if (mode === "EXPRESS" && !clientCoords) return toast.error("Activez le GPS pour la livraison express");
    if (mode === "RELAIS" && !pointRelaisId) return toast.error("Choisissez un point relais");
    if (payment === "WALLET" && (wallet?.balance ?? 0) < total) return toast.error("Solde wallet insuffisant. Rechargez.");

    setSubmitting(true);
    try {
      // Accept CGU on profile
      if (!profile?.cgu_accepted_at) {
        await supabase.from("profiles").update({ cgu_accepted_at: new Date().toISOString() }).eq("id", user.id);
      }

      const { data: order, error } = await supabase.from("orders").insert({
        user_id: user.id,
        restaurant_id: restaurant.id,
        items: items.map((i) => ({
          dish_id: i.dishId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          instructions: i.instructions,
          custom_note: i.customNote,
        })),
        delivery_mode: mode,
        point_relais_id: mode === "RELAIS" ? pointRelaisId : null,
        scheduled_date: scheduled && scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
        scheduled_time: scheduled ? scheduledTime : null,
        client_latitude: clientCoords?.lat,
        client_longitude: clientCoords?.lng,
        client_address: address || null,
        calculated_distance_km: mode === "EXPRESS" ? distanceKm : relaisDistanceKm,
        is_intercity: isLongDistance,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: total,
        payment_method: payment,
        status: "PENDING",
      }).select("id").single();

      if (error) throw error;

      // Atomic wallet debit via RPC
      if (payment === "WALLET") {
        const { error: rpcErr } = await supabase.rpc("pay_order_with_wallet" as any, { p_order_id: order.id });
        if (rpcErr) throw rpcErr;
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["wallet-tx"] });
      }

      clear();
      toast.success("Commande envoyée ! Suivez son statut.");
      navigate({ to: "/orders" });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-3">Votre panier est vide</h1>
        <p className="text-muted-foreground mb-6">Explorez nos restaurants pour ajouter des plats.</p>
        <Link to="/restaurants"><Button className="bg-gradient-primary border-0">Voir les restaurants</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-6">Finaliser la commande</h1>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          {/* PANIER */}
          <Card className="p-5 bg-gradient-card border-border/40">
            <h2 className="font-display text-xl font-semibold mb-4">Votre panier · {restaurant?.name}</h2>
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.dishId} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{i.name}</span>
                      <span className="text-sm text-primary-glow font-semibold">{formatXof(i.price * i.quantity)}</span>
                    </div>
                    {i.instructions.length > 0 && (
                      <div className="text-xs text-accent mt-1">→ {i.instructions.join(", ")}</div>
                    )}
                    {i.customNote && <div className="text-xs text-muted-foreground italic mt-1">"{i.customNote}"</div>}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center border border-border rounded">
                        <button className="px-2" onClick={() => updateQty(i.dishId, i.quantity - 1)}>−</button>
                        <span className="px-2 text-sm">{i.quantity}</span>
                        <button className="px-2" onClick={() => updateQty(i.dishId, i.quantity + 1)}>+</button>
                      </div>
                      <button className="text-xs text-destructive flex items-center gap-1" onClick={() => removeItem(i.dishId)}>
                        <Trash2 className="h-3 w-3" />Retirer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* MODE LIVRAISON */}
          <Card className="p-5 bg-gradient-card border-border/40">
            <h2 className="font-display text-xl font-semibold mb-4">Mode de livraison</h2>
            <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)}>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className={cn("border rounded-xl p-4 cursor-pointer transition", mode === "PICKUP" ? "border-primary bg-primary/10" : "border-border/50")}>
                  <div className="flex items-center gap-2 font-semibold"><RadioGroupItem value="PICKUP" /><Store className="h-4 w-4" />Sur place</div>
                  <p className="text-xs text-muted-foreground mt-2">Retrait au restaurant · <span className="text-gold font-semibold">gratuit</span></p>
                </label>
                <label className={cn("border rounded-xl p-4 cursor-pointer transition", mode === "EXPRESS" ? "border-primary bg-primary/10" : "border-border/50")}>
                  <div className="flex items-center gap-2 font-semibold"><RadioGroupItem value="EXPRESS" /><Navigation className="h-4 w-4" />Express à domicile</div>
                  <p className="text-xs text-muted-foreground mt-2">Calcul GPS au km réel</p>
                </label>
                <label className={cn("border rounded-xl p-4 cursor-pointer transition", mode === "RELAIS" ? "border-primary bg-primary/10" : "border-border/50")}>
                  <div className="flex items-center gap-2 font-semibold"><RadioGroupItem value="RELAIS" /><MapPin className="h-4 w-4" />Point relais</div>
                  <p className="text-xs text-muted-foreground mt-2">Retrait dans un point relais · payant</p>
                </label>
              </div>
            </RadioGroup>

            {mode === "EXPRESS" && (
              <div className="mt-4 space-y-3">
                <Button variant="outline" onClick={captureGps} disabled={locating} className="w-full">
                  <Navigation className="h-4 w-4 mr-2" />
                  {locating ? "Localisation..." : clientCoords ? `GPS OK (${clientCoords.lat.toFixed(4)}, ${clientCoords.lng.toFixed(4)})` : "Activer le GPS"}
                </Button>
                <Input placeholder="Adresse détaillée (bâtiment, étage...)" value={address} onChange={(e) => setAddress(e.target.value)} />
                {distanceKm !== null && (
                  <div className="text-sm p-3 rounded-lg bg-secondary/50 flex items-center justify-between">
                    <span>Distance calculée</span>
                    <span className="font-semibold text-primary-glow">{distanceKm} km</span>
                  </div>
                )}
                {isLongDistance && (
                  <Alert className="border-accent/50 bg-accent/10">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    <AlertTitle className="text-accent">Commande longue distance détectée</AlertTitle>
                    <AlertDescription className="text-xs">
                      Distance &gt; 15 km : le paiement à la livraison est désactivé. Un délai interurbain s'applique.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {mode === "RELAIS" && (
              <div className="mt-4">
                <Label>Choisir un point relais (toutes villes)</Label>
                <Select value={pointRelaisId} onValueChange={setPointRelaisId}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {relais.length === 0 && <div className="p-3 text-sm text-muted-foreground">Aucun point relais disponible</div>}
                    {relais.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.city} · {r.address_name} — {r.neighborhood}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRelais && !selectedRelais.latitude && (
                  <Alert className="mt-3 border-accent/50 bg-accent/10">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    <AlertDescription className="text-xs">Ce point relais n'a pas de coordonnées GPS. L'administrateur doit les renseigner pour calculer la tarification.</AlertDescription>
                  </Alert>
                )}
                {relaisDistanceKm !== null && (
                  <div className="text-sm p-3 rounded-lg bg-secondary/50 mt-3 flex items-center justify-between">
                    <span>Distance restaurant → relais</span>
                    <span className="font-semibold text-primary-glow">{relaisDistanceKm} km</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* PLANIFICATION */}
          <Card className="p-5 bg-gradient-card border-border/40">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={scheduled} onCheckedChange={(v) => setScheduled(!!v)} />
              <span className="font-semibold">Programmer la livraison</span>
            </label>
            {scheduled && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP", { locale: fr }) : "Choisir la date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus disabled={(d) => d < new Date()} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
              </div>
            )}
          </Card>

          {/* PAIEMENT */}
          <Card className="p-5 bg-gradient-card border-border/40">
            <h2 className="font-display text-xl font-semibold mb-4">Paiement</h2>
            <RadioGroup value={payment} onValueChange={(v: any) => setPayment(v)} className="space-y-2">
              <PaymentOption value="WALLET" icon={Wallet} label={`Wallet Tout'ICI (Solde : ${formatXof(Number(wallet?.balance ?? 0))})`} />
              <PaymentOption value="CASH" icon={Banknote} label="Paiement à la livraison" disabled={isLongDistance} note={isLongDistance ? "Indisponible pour les commandes > 15 km" : undefined} />
            </RadioGroup>
          </Card>

          {/* CGU */}
          <Card className="p-4 bg-gradient-card border-border/40">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={cguAccepted} onCheckedChange={(v) => setCguAccepted(!!v)} />
              <span className="text-sm">
                J'ai lu et j'accepte les{" "}
                <Link to="/cgu" className="text-primary-glow underline">Conditions Générales d'Utilisation et de Vente</Link>.
              </span>
            </label>
          </Card>
        </div>

        {/* SUMMARY */}
        <Card className="p-5 bg-gradient-card border-border/40 h-fit lg:sticky lg:top-20 shadow-elegant">
          <h3 className="font-display text-xl font-semibold mb-4">Récapitulatif</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Sous-total" value={formatXof(subtotal)} />
            <Row label="Livraison" value={formatXof(deliveryFee)} />
            {breakdown.length > 0 && (
              <div className="text-xs text-muted-foreground pl-1 space-y-0.5">
                {breakdown.map((b, i) => <div key={i}>· {b}</div>)}
              </div>
            )}
            {distanceKm !== null && mode === "EXPRESS" && <Row label="Distance" value={`${distanceKm} km`} />}
            <div className="border-t border-border/50 pt-2 mt-2">
              <Row label="Total" value={formatXof(total)} big />
            </div>
          </dl>
          <Button
            disabled={submitting || !cguAccepted}
            onClick={submit}
            className="w-full mt-5 h-12 bg-gradient-primary border-0 shadow-glow"
          >
            {submitting ? "Envoi..." : "Confirmer la commande"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function PaymentOption({ value, icon: Icon, label, disabled, note }: { value: string; icon: any; label: string; disabled?: boolean; note?: string }) {
  return (
    <label className={cn("flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition", disabled ? "opacity-40 cursor-not-allowed" : "border-border/50 hover:border-primary/40")}>
      <RadioGroupItem value={value} disabled={disabled} />
      <Icon className="h-4 w-4 mt-0.5" />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
      </div>
    </label>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn("text-muted-foreground", big && "text-foreground font-semibold")}>{label}</dt>
      <dd className={cn(big && "text-lg font-display text-primary-glow font-bold")}>{value}</dd>
    </div>
  );
}