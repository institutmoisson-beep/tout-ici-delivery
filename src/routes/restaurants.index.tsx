import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/restaurants")({
  head: () => ({
    meta: [
      { title: "Restaurants — Tout'ICI" },
      { name: "description", content: "Parcourez tous les restaurants et stands partenaires Tout'ICI." },
    ],
  }),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>("all");
  const [neighborhood, setNeighborhood] = useState<string>("all");

  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants-all"],
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("*").eq("is_active", true);
      return data ?? [];
    },
  });

  const cities = Array.from(new Set(restaurants.map((r) => r.city))).sort();
  const neighborhoods = Array.from(
    new Set(restaurants.filter((r) => city === "all" || r.city === city).map((r) => r.neighborhood))
  ).sort();

  const filtered = restaurants.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (city !== "all" && r.city !== city) return false;
    if (neighborhood !== "all" && r.neighborhood !== neighborhood) return false;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Explorer</h1>
        <p className="text-muted-foreground mt-2">Trouvez votre stand préféré partout en Côte d'Ivoire.</p>
      </div>

      <div className="grid md:grid-cols-[1fr_200px_220px] gap-3 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom du restaurant..." className="pl-10" />
        </div>
        <Select value={city} onValueChange={(v) => { setCity(v); setNeighborhood("all"); }}>
          <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={neighborhood} onValueChange={setNeighborhood}>
          <SelectTrigger><SelectValue placeholder="Quartier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les quartiers</SelectItem>
            {neighborhoods.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          Aucun restaurant ne correspond à votre recherche pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <Link key={r.id} to="/restaurants/$id" params={{ id: r.id }}>
              <Card className="overflow-hidden bg-gradient-card border-border/40 shadow-card hover:shadow-elegant transition-all group h-full">
                <div className="aspect-[16/10] bg-gradient-primary/20 relative overflow-hidden">
                  {r.banner_url ? (
                    <img src={r.banner_url} alt={r.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-5xl font-display text-primary-glow">{r.name[0]}</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-lg font-semibold truncate">{r.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{r.neighborhood}, {r.city}
                  </p>
                  {r.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.description}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}