import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Clock, ShoppingBag, Facebook, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerTrigger } from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatXof } from "@/lib/distance";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { ShareMenu } from "@/components/share-menu";

const INSTRUCTIONS = [
  "Plus de piment",
  "Moins d'huile",
  "Pas d'oignons",
  "Pas de piment",
  "Pas de tomate",
  "Sans sel",
  "Bien cuit",
];

export const Route = createFileRoute("/restaurants/$id")({
  head: ({ params }) => ({ meta: [{ title: `Menu — Tout'ICI` }, { name: "description", content: `Menu du restaurant partenaire.` }] }),
  component: RestaurantDetail,
});

function RestaurantDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ["dishes", id],
    queryFn: async () => {
      const { data } = await supabase.from("dishes").select("*").eq("restaurant_id", id).eq("is_available", true).order("category");
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, typeof dishes> = {};
    dishes.forEach((d) => {
      (g[d.category] ??= []).push(d);
    });
    return g;
  }, [dishes]);

  const shareWhatsApp = () => {
    const url = window.location.href;
    const text = `Découvrez ${restaurant?.name} sur Tout'ICI ! ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank");
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Lien copié !");
  };

  if (!restaurant) return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div>
      {/* BANNER */}
      <div className="relative h-56 md:h-72 bg-gradient-primary/40 overflow-hidden">
        {restaurant.banner_url && (
          <img src={restaurant.banner_url} alt={restaurant.name} className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-16 relative pb-16">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="h-24 w-24 rounded-2xl bg-card border-4 border-background shadow-elegant overflow-hidden grid place-items-center">
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt="logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-display text-primary-glow">{restaurant.name[0]}</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl md:text-4xl font-bold">{restaurant.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{restaurant.neighborhood}, {restaurant.city}</span>
              {restaurant.opening_hours && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{restaurant.opening_hours}</span>}
              <Badge variant="outline" className="border-primary/40 text-primary-glow">{formatXof(restaurant.price_per_km)}/km</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="outline" onClick={shareWhatsApp} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={shareFacebook} title="Facebook"><Facebook className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={copyLink} title="Copier le lien"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>

        {restaurant.description && (
          <p className="mt-4 text-muted-foreground max-w-2xl">{restaurant.description}</p>
        )}

        <div className="mt-10 space-y-10">
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-muted-foreground py-16">Aucun plat disponible actuellement.</p>
          )}
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-3">
                <span className="h-px flex-1 max-w-[3rem] bg-gradient-primary" />
                {cat}
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((d) => (
                  <DishCard key={d.id} dish={d} restaurant={restaurant} onNeedAuth={() => navigate({ to: "/auth" })} authed={!!user} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DishCard({ dish, restaurant, onNeedAuth, authed }: { dish: any; restaurant: any; onNeedAuth: () => void; authed: boolean }) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const restaurantId = restaurant.id;
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/restaurants/${restaurantId}#dish-${dish.id}`
    : `/restaurants/${restaurantId}#dish-${dish.id}`;
  const shareText = `🍽️ ${dish.name} — ${formatXof(Number(dish.price))}\n${dish.description ? dish.description + "\n" : ""}Chez ${restaurant.name} (${restaurant.neighborhood ?? restaurant.city}) sur Tout'ICI`;

  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const add = () => {
    if (!authed) return onNeedAuth();
    addItem({
      dishId: dish.id,
      restaurantId,
      name: dish.name,
      price: Number(dish.price),
      quantity: qty,
      imageUrl: dish.image_url,
      instructions: selected,
      customNote: note || undefined,
    });
    toast.success(`${dish.name} ajouté au panier`);
    setOpen(false);
    setQty(1);
    setSelected([]);
    setNote("");
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Card id={`dish-${dish.id}`} className="overflow-hidden bg-gradient-card border-border/40 shadow-card hover:shadow-glow transition-all cursor-pointer group relative">
          <div className="absolute top-2 right-2 z-10 bg-background/70 backdrop-blur rounded-full">
            <ShareMenu url={shareUrl} text={shareText} title={dish.name} imageUrl={dish.image_url} stopPropagation />
          </div>
          <div className="aspect-[4/3] bg-secondary/40 overflow-hidden">
            {dish.image_url ? (
              <img src={dish.image_url} alt={dish.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              <div className="h-full w-full grid place-items-center text-4xl">🍽️</div>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold">{dish.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">{dish.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-display text-lg text-primary-glow font-bold">{formatXof(Number(dish.price))}</span>
              <Button size="sm" className="bg-gradient-primary border-0 shadow-glow">Ajouter</Button>
            </div>
          </div>
        </Card>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <div className="max-w-lg mx-auto w-full px-4 overflow-y-auto">
          <DrawerHeader className="px-0">
            <DrawerTitle className="font-display text-2xl">{dish.name}</DrawerTitle>
          </DrawerHeader>
          {dish.image_url && (
            <img src={dish.image_url} alt={dish.name} className="rounded-xl aspect-[16/10] object-cover w-full mb-4" />
          )}
          {dish.description && <p className="text-sm text-muted-foreground mb-4">{dish.description}</p>}

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Consignes spéciales</h4>
              <div className="grid grid-cols-2 gap-2">
                {INSTRUCTIONS.map((i) => (
                  <label key={i} className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border border-border/50 p-2 hover:border-primary/50 transition-colors">
                    <Checkbox checked={selected.includes(i)} onCheckedChange={() => toggle(i)} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Instruction personnalisée</h4>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex: bien épicé mais sans piment vert..." />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-lg">
                <button className="px-3 py-2" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span className="px-3 w-10 text-center">{qty}</span>
                <button className="px-3 py-2" onClick={() => setQty(qty + 1)}>+</button>
              </div>
              <span className="text-sm text-muted-foreground">Total : <span className="text-foreground font-semibold">{formatXof(Number(dish.price) * qty)}</span></span>
            </div>
          </div>

          <DrawerFooter className="px-0">
            <Button onClick={add} className="w-full h-12 bg-gradient-primary border-0 shadow-glow">
              <ShoppingBag className="h-4 w-4 mr-2" />Ajouter au panier · {formatXof(Number(dish.price) * qty)}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}