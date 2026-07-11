import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, UtensilsCrossed, MapPin, Package, Wallet, ShieldCheck, Plus, Trash2, CheckCircle2, XCircle, Facebook, MessageCircle } from "lucide-react";
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
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="orders"><Package className="h-4 w-4 mr-1" />Commandes</TabsTrigger>
          <TabsTrigger value="restaurants"><Store className="h-4 w-4 mr-1" />Restaurants</TabsTrigger>
          <TabsTrigger value="dishes"><UtensilsCrossed className="h-4 w-4 mr-1" />Plats</TabsTrigger>
          <TabsTrigger value="relais"><MapPin className="h-4 w-4 mr-1" />Relais</TabsTrigger>
          <TabsTrigger value="recharges"><Wallet className="h-4 w-4 mr-1" />Recharges</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6"><OrdersLedger /></TabsContent>
        <TabsContent value="restaurants" className="mt-6"><RestaurantsAdmin /></TabsContent>
        <TabsContent value="dishes" className="mt-6"><DishesAdmin /></TabsContent>
        <TabsContent value="relais" className="mt-6"><RelaisAdmin /></TabsContent>
        <TabsContent value="recharges" className="mt-6"><RechargesAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ ORDERS LEDGER ============
function OrdersLedger() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*, restaurants(name,city)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["admin-orders"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
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
        </Card>
      ))}
    </div>
  );
}

// ============ RESTAURANTS ============
function RestaurantsAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary border-0"><Plus className="h-4 w-4 mr-1" />Nouveau stand</Button>
          </DialogTrigger>
          <DialogContent className="bg-card max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer un restaurant</DialogTitle></DialogHeader>
            <RestaurantForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-restaurants"] }); }} />
          </DialogContent>
        </Dialog>
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
              <Button size="icon" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function RestaurantForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", city: "Abidjan", neighborhood: "", latitude: "", longitude: "", price_per_km: "300", description: "", logo_url: "", banner_url: "", opening_hours: "" });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("restaurants").insert({
      ...f,
      latitude: parseFloat(f.latitude),
      longitude: parseFloat(f.longitude),
      price_per_km: parseFloat(f.price_per_km),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Restaurant créé");
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
      <div><Label>Logo (URL)</Label><Input value={f.logo_url} onChange={(e) => setF({ ...f, logo_url: e.target.value })} /></div>
      <div><Label>Bannière (URL)</Label><Input value={f.banner_url} onChange={(e) => setF({ ...f, banner_url: e.target.value })} /></div>
      <div><Label>Horaires</Label><Input value={f.opening_hours} onChange={(e) => setF({ ...f, opening_hours: e.target.value })} placeholder="10h - 22h" /></div>
      <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-primary border-0">{saving ? "..." : "Créer"}</Button>
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
      <div><Label>Image (URL)</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></div>
      <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-primary border-0">{saving ? "..." : "Ajouter"}</Button>
    </form>
  );
}

// ============ POINTS RELAIS ============
function RelaisAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ city: "Abidjan", neighborhood: "", address_name: "", additional_details: "", opening_hours: "" });
  const { data: relais = [] } = useQuery({
    queryKey: ["admin-relais"],
    queryFn: async () => (await supabase.from("points_relais").select("*").order("city")).data ?? [],
  });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("points_relais").insert(f);
    if (error) return toast.error(error.message);
    toast.success("Point relais ajouté");
    setOpen(false);
    setF({ city: "Abidjan", neighborhood: "", address_name: "", additional_details: "", opening_hours: "" });
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
              <Button type="submit" className="w-full bg-gradient-primary border-0">Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3">
        {relais.map((r) => (
          <Card key={r.id} className="p-4 bg-gradient-card border-border/40 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary-glow" />
            <div className="flex-1"><p className="font-semibold">{r.address_name}</p><p className="text-xs text-muted-foreground">{r.neighborhood}, {r.city} · {r.opening_hours}</p></div>
            <Button size="icon" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </>
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
    if (approve) {
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", r.user_id).maybeSingle();
      const newBalance = Number(w?.balance ?? 0) + Number(r.amount);
      await supabase.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("user_id", r.user_id);
      await supabase.from("wallet_transactions").insert({
        user_id: r.user_id, type: "RECHARGE", amount: r.amount, balance_after: newBalance,
        reference: `Recharge ${r.payment_channel} (${r.payment_ref})`,
      });
    }
    await supabase.from("recharge_requests").update({
      status: approve ? "APPROVED" : "REJECTED",
      processed_at: new Date().toISOString(),
    }).eq("id", r.id);
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