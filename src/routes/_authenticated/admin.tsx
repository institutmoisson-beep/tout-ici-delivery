import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, UtensilsCrossed, MapPin, Package, Wallet, ShieldCheck, Plus, Trash2, CheckCircle2, XCircle, Facebook, MessageCircle, Zap, Copy, PlayCircle, Truck, Pencil, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatXof, IVORIAN_CITIES } from "@/lib/distance";
import { Switch } from "@/components/ui/switch";
import { resolveTemplate } from "@/lib/gateway";
import { ImageUploader } from "@/components/image-uploader";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Accès réservé aux administrateurs");
      navigate({ to: "/" });
    }
  }, [isAdmin, loading, navigate]);

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Console Admin</h1>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="grid grid-cols-2 md:grid-cols-8 w-full">
          <TabsTrigger value="orders"><Package className="h-4 w-4 mr-1" />Commandes</TabsTrigger>
          <TabsTrigger value="restaurants"><Store className="h-4 w-4 mr-1" />Restaurants</TabsTrigger>
          <TabsTrigger value="dishes"><UtensilsCrossed className="h-4 w-4 mr-1" />Plats</TabsTrigger>
          <TabsTrigger value="relais"><MapPin className="h-4 w-4 mr-1" />Relais</TabsTrigger>
          <TabsTrigger value="delivery"><Truck className="h-4 w-4 mr-1" />Livraison</TabsTrigger>
          <TabsTrigger value="recharges"><Wallet className="h-4 w-4 mr-1" />Recharges</TabsTrigger>
          <TabsTrigger value="gateways"><Zap className="h-4 w-4 mr-1" />Passerelles</TabsTrigger>
          <TabsTrigger value="finance"><ShieldCheck className="h-4 w-4 mr-1" />MSN Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6"><OrdersLedger /></TabsContent>
        <TabsContent value="restaurants" className="mt-6"><RestaurantsAdmin /></TabsContent>
        <TabsContent value="dishes" className="mt-6"><DishesAdmin /></TabsContent>
        <TabsContent value="relais" className="mt-6"><RelaisAdmin /></TabsContent>
        <TabsContent value="delivery" className="mt-6"><DeliveryAdmin /></TabsContent>
        <TabsContent value="recharges" className="mt-6"><RechargesAdmin /></TabsContent>
        <TabsContent value="gateways" className="mt-6"><GatewaysAdmin /></TabsContent>
        <TabsContent value="finance" className="mt-6"><FinanceLedger /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ ORDERS LEDGER ============
function OrdersLedger() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*, restaurants(name,city,neighborhood), points_relais(address_name,neighborhood,city), profiles(full_name,phone)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["admin-orders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const updateStatus = async (id: string, status: any) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
  };

  const buildOrderMessage = (o: any) => {
    const lines: string[] = [];
    lines.push(`🧾 Commande Tout'ICI #${o.id.slice(0, 8)}`);
    lines.push(`📅 ${new Date(o.created_at).toLocaleString("fr-FR")}`);
    lines.push(`🏪 Restaurant : ${o.restaurants?.name ?? "—"} (${o.restaurants?.neighborhood ?? ""}, ${o.restaurants?.city ?? ""})`);
    lines.push("");
    lines.push(`👤 Client : ${o.profiles?.full_name ?? "—"}`);
    if (o.profiles?.phone) lines.push(`📞 ${o.profiles.phone}`);
    lines.push("");
    lines.push("🍽️ Articles :");
    for (const i of (o.items as any[])) {
      let line = `  • ${i.quantity}× ${i.name} — ${formatXof(Number(i.price ?? 0) * Number(i.quantity ?? 1))}`;
      if (i.instructions?.length) line += ` [${i.instructions.join(", ")}]`;
      if (i.custom_note) line += ` (${i.custom_note})`;
      lines.push(line);
    }
    lines.push("");
    lines.push(`🚚 Mode : ${o.delivery_mode}`);
    if (o.delivery_mode === "RELAIS" && o.points_relais) {
      lines.push(`📍 Retrait : ${o.points_relais.address_name} — ${o.points_relais.neighborhood}, ${o.points_relais.city}`);
    } else if (o.delivery_mode === "EXPRESS") {
      if (o.client_address) lines.push(`📍 Livraison : ${o.client_address}`);
      if (o.client_latitude) lines.push(`🗺️ https://maps.google.com/?q=${o.client_latitude},${o.client_longitude}`);
      if (o.calculated_distance_km) lines.push(`📏 Distance : ${o.calculated_distance_km} km`);
    } else if (o.delivery_mode === "PICKUP") {
      lines.push("📍 Retrait sur place au restaurant");
    }
    if (o.scheduled_date) lines.push(`⏰ Programmée : ${o.scheduled_date} ${o.scheduled_time ?? ""}`);
    lines.push("");
    lines.push(`💰 Sous-total : ${formatXof(Number(o.subtotal))}`);
    lines.push(`🚚 Livraison : ${formatXof(Number(o.delivery_fee))}`);
    lines.push(`✅ TOTAL : ${formatXof(Number(o.total_amount))}`);
    lines.push(`💳 Paiement : ${o.payment_method}`);
    lines.push(`📌 Statut : ${o.status}`);
    return lines.join("\n");
  };

  const shareWhatsApp = (o: any) => {
    const msg = buildOrderMessage(o);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const shareSms = (o: any) => {
    const msg = buildOrderMessage(o);
    window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
  };
  const copyOrder = async (o: any) => {
    await navigator.clipboard.writeText(buildOrderMessage(o));
    toast.success("Commande copiée");
  };

  return (
    <div className="space-y-3">
      {orders.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune commande</p>}
      {orders.map((o: any) => (
        <Card key={o.id} className="p-4 bg-gradient-card border-border/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{o.restaurants?.name} <span className="text-xs text-muted-foreground">#{o.id.slice(0, 8)}</span></p>
              <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</p>
              {o.profiles?.full_name && (
                <p className="text-xs text-muted-foreground">👤 {o.profiles.full_name}{o.profiles.phone && ` · ${o.profiles.phone}`}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{o.payment_method}</Badge>
              <Badge variant="outline" className={o.is_intercity ? "border-accent text-accent" : ""}>
                {o.delivery_mode === "EXPRESS" ? `${o.calculated_distance_km ?? 0} km` : "Point relais"}
              </Badge>
            </div>
          </div>

          <ul className="mt-3 text-sm space-y-1">
            {(o.items as any[]).map((i, idx) => (
              <li key={idx}>
                <span className="font-medium">{i.quantity}× {i.name}</span>
                {i.instructions?.length > 0 && <span className="text-accent"> — {i.instructions.join(", ")}</span>}
                {i.custom_note && <span className="text-muted-foreground italic"> · "{i.custom_note}"</span>}
              </li>
            ))}
          </ul>

          {o.client_latitude && (
            <p className="text-xs text-muted-foreground mt-2">
              📍 <a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${o.client_latitude},${o.client_longitude}`}>{o.client_latitude.toFixed(5)}, {o.client_longitude.toFixed(5)}</a>
              {o.client_address && ` · ${o.client_address}`}
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-lg text-primary-glow font-bold">{formatXof(Number(o.total_amount))}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => shareWhatsApp(o)} title="Partager WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => shareSms(o)} title="Envoyer par SMS"><Share2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => copyOrder(o)} title="Copier"><Copy className="h-4 w-4" /></Button>
              <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="PREPARING">En préparation</SelectItem>
                <SelectItem value="IN_TRANSIT">En livraison</SelectItem>
                <SelectItem value="DELIVERED">Livrée</SelectItem>
                <SelectItem value="CANCELLED">Annulée</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============ RESTAURANTS ============
function RestaurantsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data: restaurants = [] } = useQuery({
    queryKey: ["admin-restaurants"],
    queryFn: async () => (await supabase.from("restaurants").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce restaurant ?")) return;
    await supabase.from("restaurants").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-restaurants"] });
  };

  const share = (r: any, channel: "wa" | "fb") => {
    const url = `${window.location.origin}/restaurants/${r.id}`;
    const text = `🍽️ Découvrez ${r.name} à ${r.neighborhood}, ${r.city} sur Tout'ICI ! Commandez en ligne : ${url}`;
    if (channel === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    else window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button className="bg-gradient-primary border-0" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Nouveau stand
        </Button>
      </div>
      <div className="grid gap-3">
        {restaurants.map((r) => (
          <Card key={r.id} className="p-4 bg-gradient-card border-border/40 flex flex-wrap items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-secondary overflow-hidden grid place-items-center">
              {r.logo_url ? <img src={r.logo_url} className="h-full w-full object-cover" /> : <span>{r.name[0]}</span>}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.neighborhood}, {r.city} · {formatXof(r.price_per_km)}/km · GPS {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" onClick={() => share(r, "wa")} title="Partager WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => share(r, "fb")} title="Partager Facebook"><Facebook className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => { setEditing(r); setOpen(true); }} title="Modifier"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Créer"} un restaurant</DialogTitle></DialogHeader>
          <RestaurantForm initial={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-restaurants"] }); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function RestaurantForm({ initial, onDone }: { initial?: any; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    city: initial?.city ?? "Abidjan",
    neighborhood: initial?.neighborhood ?? "",
    latitude: initial?.latitude?.toString() ?? "",
    longitude: initial?.longitude?.toString() ?? "",
    price_per_km: initial?.price_per_km?.toString() ?? "300",
    description: initial?.description ?? "",
    logo_url: initial?.logo_url ?? "",
    banner_url: initial?.banner_url ?? "",
    opening_hours: initial?.opening_hours ?? "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...f,
      latitude: parseFloat(f.latitude),
      longitude: parseFloat(f.longitude),
      price_per_km: parseFloat(f.price_per_km),
    };
    const { error } = initial
      ? await supabase.from("restaurants").update(payload).eq("id", initial.id)
      : await supabase.from("restaurants").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Restaurant mis à jour" : "Restaurant créé");
    onDone();
  };
  const usePos = () => {
    navigator.geolocation.getCurrentPosition((p) => setF((s) => ({ ...s, latitude: p.coords.latitude.toString(), longitude: p.coords.longitude.toString() })));
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nom</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Ville</Label>
          <Select value={f.city} onValueChange={(v) => setF({ ...f, city: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{IVORIAN_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Quartier</Label><Input required value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Latitude</Label><Input required type="number" step="any" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} /></div>
        <div><Label>Longitude</Label><Input required type="number" step="any" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} /></div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={usePos}>Utiliser ma position actuelle</Button>
      <div><Label>Prix / km (FCFA)</Label><Input required type="number" value={f.price_per_km} onChange={(e) => setF({ ...f, price_per_km: e.target.value })} /></div>
      <ImageUploader label="Logo" folder="restaurants/logos" value={f.logo_url} onChange={(url) => setF({ ...f, logo_url: url })} />
      <ImageUploader label="Bannière" aspect="wide" folder="restaurants/banners" value={f.banner_url} onChange={(url) => setF({ ...f, banner_url: url })} />
      <div><Label>Horaires</Label><Input value={f.opening_hours} onChange={(e) => setF({ ...f, opening_hours: e.target.value })} placeholder="10h - 22h" /></div>
      <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-primary border-0">{saving ? "..." : initial ? "Enregistrer" : "Créer"}</Button>
    </form>
  );
}

// ============ DISHES ============
function DishesAdmin() {
  const qc = useQueryClient();
  const [restId, setRestId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const { data: restaurants = [] } = useQuery({
    queryKey: ["admin-restaurants-min"],
    queryFn: async () => (await supabase.from("restaurants").select("id,name")).data ?? [],
  });
  const { data: dishes = [] } = useQuery({
    queryKey: ["admin-dishes", restId],
    enabled: !!restId,
    queryFn: async () => (await supabase.from("dishes").select("*").eq("restaurant_id", restId).order("category")).data ?? [],
  });

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce plat ?")) return;
    await supabase.from("dishes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-dishes"] });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={restId} onValueChange={setRestId}>
          <SelectTrigger className="flex-1 min-w-[200px]"><SelectValue placeholder="Choisir un restaurant" /></SelectTrigger>
          <SelectContent>{restaurants.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
        </Select>
        {restId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-primary border-0"><Plus className="h-4 w-4 mr-1" />Nouveau plat</Button></DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader><DialogTitle>Ajouter un plat</DialogTitle></DialogHeader>
              <DishForm restaurantId={restId} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-dishes"] }); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="grid gap-3">
        {dishes.map((d) => (
          <Card key={d.id} className="p-3 bg-gradient-card border-border/40 flex items-center gap-3">
            <div className="h-14 w-14 rounded-lg bg-secondary overflow-hidden grid place-items-center">
              {d.image_url ? <img src={d.image_url} className="h-full w-full object-cover" /> : <span>🍽️</span>}
            </div>
            <div className="flex-1"><p className="font-semibold">{d.name}</p><p className="text-xs text-muted-foreground">{d.category} · {formatXof(Number(d.price))}</p></div>
            <Button size="icon" variant="outline" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DishForm({ restaurantId, onDone }: { restaurantId: string; onDone: () => void }) {
  const [f, setF] = useState({ name: "", price: "", category: "Plat principal", description: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("dishes").insert({ ...f, price: parseFloat(f.price), restaurant_id: restaurantId });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plat ajouté"); onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nom</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Prix (FCFA)</Label><Input required type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
        <div><Label>Catégorie</Label><Input required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
      </div>
      <ImageUploader label="Photo du plat" folder="dishes" value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />
      <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-primary border-0">{saving ? "..." : "Ajouter"}</Button>
    </form>
  );
}

// ============ POINTS RELAIS ============
function RelaisAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ city: "Abidjan", neighborhood: "", address_name: "", additional_details: "", opening_hours: "", latitude: "", longitude: "" });
  const { data: relais = [] } = useQuery({
    queryKey: ["admin-relais"],
    queryFn: async () => (await supabase.from("points_relais").select("*").order("city")).data ?? [],
  });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...f };
    payload.latitude = f.latitude ? Number(f.latitude) : null;
    payload.longitude = f.longitude ? Number(f.longitude) : null;
    const { error } = await supabase.from("points_relais").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Point relais ajouté");
    setOpen(false);
    setF({ city: "Abidjan", neighborhood: "", address_name: "", additional_details: "", opening_hours: "", latitude: "", longitude: "" });
    qc.invalidateQueries({ queryKey: ["admin-relais"] });
  };
  const remove = async (id: string) => { await supabase.from("points_relais").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["admin-relais"] }); };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-primary border-0"><Plus className="h-4 w-4 mr-1" />Nouveau point relais</Button></DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader><DialogTitle>Créer un point relais</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Ville</Label>
                <Select value={f.city} onValueChange={(v) => setF({ ...f, city: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{IVORIAN_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quartier</Label><Input required value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} /></div>
              <div><Label>Adresse</Label><Input required value={f.address_name} onChange={(e) => setF({ ...f, address_name: e.target.value })} /></div>
              <div><Label>Détails</Label><Textarea value={f.additional_details} onChange={(e) => setF({ ...f, additional_details: e.target.value })} /></div>
              <div><Label>Horaires</Label><Input value={f.opening_hours} onChange={(e) => setF({ ...f, opening_hours: e.target.value })} placeholder="8h - 20h" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Latitude</Label><Input type="number" step="0.000001" required value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} placeholder="5.3364" /></div>
                <div><Label>Longitude</Label><Input type="number" step="0.000001" required value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} placeholder="-4.0267" /></div>
              </div>
              <Button type="submit" className="w-full bg-gradient-primary border-0">Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3">
        {relais.map((r) => (
          <Card key={r.id} className="p-4 bg-gradient-card border-border/40 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary-glow" />
            <div className="flex-1">
              <p className="font-semibold">{r.address_name}</p>
              <p className="text-xs text-muted-foreground">{r.neighborhood}, {r.city} · {r.opening_hours}</p>
              {(r as any).latitude && (r as any).longitude ? (
                <p className="text-xs text-muted-foreground">GPS : {(r as any).latitude}, {(r as any).longitude}</p>
              ) : (
                <p className="text-xs text-destructive">⚠ GPS manquant — retrait indisponible</p>
              )}
            </div>
            <Button size="icon" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </>
  );
}

// ============ DELIVERY PRICING ============
function DeliveryAdmin() {
  const qc = useQueryClient();
  const { data: pricing } = useQuery({
    queryKey: ["admin-delivery-pricing"],
    queryFn: async () => (await supabase.from("delivery_pricing" as any).select("*").maybeSingle()).data as any,
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ["admin-holidays"],
    queryFn: async () => (await supabase.from("public_holidays" as any).select("*").order("holiday_date")).data as any[] ?? [],
  });
  const [form, setForm] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => { if (pricing) setForm(pricing); }, [pricing]);
  if (!form) return <p className="text-muted-foreground text-center py-8">Chargement…</p>;

  const save = async () => {
    const { error } = await supabase.from("delivery_pricing" as any).update({
      base_per_km: Number(form.base_per_km),
      minimum_fee: Number(form.minimum_fee),
      night_start_hour: Number(form.night_start_hour),
      night_end_hour: Number(form.night_end_hour),
      night_multiplier: Number(form.night_multiplier),
      weekend_multiplier: Number(form.weekend_multiplier),
      holiday_multiplier: Number(form.holiday_multiplier),
      strike_active: !!form.strike_active,
      strike_multiplier: Number(form.strike_multiplier),
      intercity_flat_surcharge: Number(form.intercity_flat_surcharge),
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Tarifs enregistrés");
    qc.invalidateQueries({ queryKey: ["admin-delivery-pricing"] });
    qc.invalidateQueries({ queryKey: ["delivery-pricing"] });
  };

  const addHoliday = async () => {
    if (!newDate || !newLabel) return toast.error("Date + libellé requis");
    const { error } = await supabase.from("public_holidays" as any).insert({ holiday_date: newDate, label: newLabel });
    if (error) return toast.error(error.message);
    setNewDate(""); setNewLabel("");
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    qc.invalidateQueries({ queryKey: ["public-holidays"] });
  };
  const removeHoliday = async (id: string) => {
    await supabase.from("public_holidays" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    qc.invalidateQueries({ queryKey: ["public-holidays"] });
  };

  const F = ({ label, k, step = "1" }: { label: string; k: string; step?: string }) => (
    <div><Label>{label}</Label><Input type="number" step={step} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1" /></div>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5 bg-gradient-card border-border/40">
        <h3 className="font-display text-lg font-semibold mb-4">Tarifs de livraison</h3>
        <div className="grid grid-cols-2 gap-3">
          <F label="Tarif par km (FCFA)" k="base_per_km" />
          <F label="Tarif minimum (FCFA)" k="minimum_fee" />
          <F label="Début nuit (heure)" k="night_start_hour" />
          <F label="Fin nuit (heure)" k="night_end_hour" />
          <F label="Majoration nuit (×)" k="night_multiplier" step="0.01" />
          <F label="Majoration week-end (×)" k="weekend_multiplier" step="0.01" />
          <F label="Majoration jour férié (×)" k="holiday_multiplier" step="0.01" />
          <F label="Majoration grève (×)" k="strike_multiplier" step="0.01" />
          <F label="Supplément interville (FCFA)" k="intercity_flat_surcharge" />
          <div className="flex items-end gap-2">
            <Switch checked={!!form.strike_active} onCheckedChange={(v) => setForm({ ...form, strike_active: v })} />
            <Label className="mb-2">Grève en cours</Label>
          </div>
        </div>
        <Button onClick={save} className="w-full mt-4 bg-gradient-primary border-0">Enregistrer les tarifs</Button>
      </Card>

      <Card className="p-5 bg-gradient-card border-border/40">
        <h3 className="font-display text-lg font-semibold mb-4">Jours fériés</h3>
        <div className="flex gap-2 mb-4">
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <Input placeholder="Libellé" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Button onClick={addHoliday} className="bg-gradient-primary border-0"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-2">
          {holidays.length === 0 && <p className="text-xs text-muted-foreground">Aucun jour férié configuré.</p>}
          {holidays.map((h: any) => (
            <div key={h.id} className="flex items-center justify-between bg-secondary/30 rounded p-2">
              <span className="text-sm"><b>{h.holiday_date}</b> — {h.label}</span>
              <Button size="icon" variant="ghost" onClick={() => removeHoliday(h.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============ RECHARGES ============
function RechargesAdmin() {
  const qc = useQueryClient();
  const { data: recharges = [] } = useQuery({
    queryKey: ["admin-recharges"],
    queryFn: async () => (await supabase.from("recharge_requests").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const process = async (r: any, approve: boolean) => {
    const { error } = await supabase.rpc("admin_approve_recharge" as any, { p_recharge_id: r.id, p_approve: approve });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Créditée" : "Rejetée");
    qc.invalidateQueries({ queryKey: ["admin-recharges"] });
  };

  return (
    <div className="space-y-3">
      {recharges.map((r: any) => (
        <Card key={r.id} className="p-4 bg-gradient-card border-border/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{formatXof(Number(r.amount))} <span className="text-xs text-muted-foreground">— {r.profiles?.full_name ?? r.user_id.slice(0, 8)}</span></p>
              <p className="text-xs text-muted-foreground">{r.payment_channel} · Ref: {r.payment_ref}</p>
              {r.note && <p className="text-xs italic mt-1">"{r.note}"</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
            </div>
            {r.status === "PENDING" ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => process(r, true)} className="bg-gold text-background border-0"><CheckCircle2 className="h-4 w-4 mr-1" />Approuver</Button>
                <Button size="sm" variant="outline" onClick={() => process(r, false)}><XCircle className="h-4 w-4 mr-1" />Rejeter</Button>
              </div>
            ) : (
              <Badge variant="outline">{r.status}</Badge>
            )}
          </div>
        </Card>
      ))}
      {recharges.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune demande</p>}
    </div>
  );
}
// ============ MSN GATEWAYS CONFIG ============
function GatewaysAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { data: gateways = [] } = useQuery({
    queryKey: ["admin-gateways"],
    queryFn: async () => (await supabase.from("payment_gateways").select("*").order("sort_order")).data ?? [],
  });

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette passerelle ?")) return;
    await supabase.from("payment_gateways").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-gateways"] });
  };
  const toggle = async (g: any) => {
    await supabase.from("payment_gateways").update({ is_active: !g.is_active }).eq("id", g.id);
    qc.invalidateQueries({ queryKey: ["admin-gateways"] });
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button className="bg-gradient-primary border-0" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Nouvelle passerelle
        </Button>
      </div>
      <div className="grid gap-3">
        {gateways.map((g: any) => (
          <Card key={g.id} className="p-4 bg-gradient-card border-border/40">
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-3xl">{g.logo_emoji}</span>
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold">{g.display_name} <span className="text-xs text-muted-foreground">· {g.category}</span></p>
                <p className="text-xs text-muted-foreground">Compte : <code>{g.account_details ?? "—"}</code></p>
                {g.ussd_deposit_template && <p className="text-xs mt-1">Dépôt : <code>{g.ussd_deposit_template}</code></p>}
                {g.ussd_payout_template && <p className="text-xs">Retrait : <code>{g.ussd_payout_template}</code></p>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={g.is_active} onCheckedChange={() => toggle(g)} />
                <Button size="icon" variant="outline" onClick={() => { setEditing(g); setOpen(true); }}><Zap className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Créer"} une passerelle</DialogTitle></DialogHeader>
          <GatewayForm initial={editing} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-gateways"] }); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function GatewayForm({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [f, setF] = useState({
    method_name: initial?.method_name ?? "",
    display_name: initial?.display_name ?? "",
    category: initial?.category ?? "MOBILE_MONEY",
    logo_emoji: initial?.logo_emoji ?? "💳",
    account_details: initial?.account_details ?? "",
    deep_link_template: initial?.deep_link_template ?? "",
    ussd_deposit_template: initial?.ussd_deposit_template ?? "",
    ussd_payout_template: initial?.ussd_payout_template ?? "",
    instructions: initial?.instructions ?? "",
    sort_order: initial?.sort_order ?? 10,
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...f, sort_order: Number(f.sort_order) };
    const { error } = initial
      ? await supabase.from("payment_gateways").update(payload).eq("id", initial.id)
      : await supabase.from("payment_gateways").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Enregistré"); onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Nom technique</Label><Input required value={f.method_name} onChange={(e) => setF({ ...f, method_name: e.target.value })} /></div>
        <div><Label>Nom affiché</Label><Input required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Catégorie</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
              <SelectItem value="CRYPTO">Crypto</SelectItem>
              <SelectItem value="CARD">Carte bancaire</SelectItem>
              <SelectItem value="BANK">Banque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Emoji</Label><Input value={f.logo_emoji} onChange={(e) => setF({ ...f, logo_emoji: e.target.value })} /></div>
      </div>
      <div><Label>Compte / adresse</Label><Input value={f.account_details} onChange={(e) => setF({ ...f, account_details: e.target.value })} /></div>
      <div><Label>Deep link (variables: {"{{ACCOUNT}} {{AMOUNT}}"})</Label><Input value={f.deep_link_template} onChange={(e) => setF({ ...f, deep_link_template: e.target.value })} /></div>
      <div><Label>USSD dépôt</Label><Input value={f.ussd_deposit_template} onChange={(e) => setF({ ...f, ussd_deposit_template: e.target.value })} placeholder="*133*1*1*{{ACCOUNT}}*{{AMOUNT}}#" /></div>
      <div><Label>USSD retrait ({"{{PHONE}} {{AMOUNT}}"})</Label><Input value={f.ussd_payout_template} onChange={(e) => setF({ ...f, ussd_payout_template: e.target.value })} placeholder="*122*4*{{PHONE}}*{{AMOUNT}}#" /></div>
      <div><Label>Instructions</Label><Textarea value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></div>
      <div><Label>Ordre</Label><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-primary border-0">{saving ? "..." : "Enregistrer"}</Button>
    </form>
  );
}

// ============ FINANCE LEDGER ============
function FinanceLedger() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-fin-tx", filter],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("*, payment_gateways(display_name, logo_emoji, ussd_payout_template)").order("created_at", { ascending: false }).limit(150);
      if (filter !== "ALL") q = q.eq("type", filter as any);
      return (await q).data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("admin-fin-tx")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_transactions" }, () => qc.invalidateQueries({ queryKey: ["admin-fin-tx"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("financial_transactions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mis à jour");
  };
  const copy = async (t: string) => { await navigator.clipboard.writeText(t); toast.success("Copié"); };

  return (
    <>
      <div className="flex gap-2 mb-4">
        {["ALL","RECHARGE","WITHDRAWAL","PURCHASE"].map((v) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)}>{v}</Button>
        ))}
      </div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune transaction</p>}
        {rows.map((r: any) => {
          const compiled = r.compiled_syntax ?? resolveTemplate(r.payment_gateways?.ussd_payout_template, { PHONE: r.destination_account ?? "", AMOUNT: r.amount });
          return (
            <Card key={r.id} className="p-4 bg-gradient-card border-border/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <span className="text-xl">{r.payment_gateways?.logo_emoji ?? "💠"}</span>
                    {r.type} · {formatXof(Number(r.amount))}
                    <Badge variant="outline" className="ml-1">{r.status}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">User: <code>{r.user_id.slice(0,8)}</code> · {new Date(r.created_at).toLocaleString("fr-FR")}</p>
                  <p className="text-xs">Méthode : {r.payment_method}</p>
                  {r.transaction_reference && <p className="text-xs">Réf: <code>{r.transaction_reference}</code></p>}
                  {r.destination_account && <p className="text-xs">Vers: <code>{r.destination_account}</code> {r.destination_name && `(${r.destination_name})`}</p>}
                  {r.proof_url && <a className="text-xs underline text-primary-glow" href={r.proof_url} target="_blank" rel="noreferrer">Preuve</a>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {r.type === "WITHDRAWAL" && compiled && (
                    <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded px-2 py-1">
                      <code className="text-xs font-bold">{compiled}</code>
                      <Button size="icon" variant="ghost" onClick={() => copy(compiled)}><Copy className="h-3 w-3" /></Button>
                    </div>
                  )}
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      {r.type === "RECHARGE" && (
                        <Button size="sm" onClick={() => update(r.id, { status: "APPROVED" })} className="bg-gold text-background border-0">
                          <CheckCircle2 className="h-4 w-4 mr-1" />Créditer
                        </Button>
                      )}
                      {r.type === "WITHDRAWAL" && (
                        <>
                          <Button size="sm" onClick={() => update(r.id, { status: "PROCESSING" })} className="bg-primary border-0">
                            <PlayCircle className="h-4 w-4 mr-1" />Traiter
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => update(r.id, { status: "REJECTED" })}>
                        <XCircle className="h-4 w-4 mr-1" />Rejeter
                      </Button>
                    </div>
                  )}
                  {r.status === "PROCESSING" && r.type === "WITHDRAWAL" && (
                    <Button size="sm" onClick={() => update(r.id, { status: "DISBURSED" })} className="bg-gold text-background border-0">
                      <CheckCircle2 className="h-4 w-4 mr-1" />Marquer décaissé
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
