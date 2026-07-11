import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Navigation, Wallet, Timer, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { data: restaurants } = useQuery({
    queryKey: ["landing-restaurants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id,name,city,neighborhood,banner_url,logo_url,description")
        .eq("is_active", true)
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="bg-hero">
      {/* HERO */}
      <section className="container mx-auto px-4 pt-16 pb-20 md:pt-28 md:pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-glow mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Nouvelle génération — Livraison intelligente au kilomètre
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.02]">
            La gastronomie <span className="text-primary-glow">ivoirienne</span>,
            <br /> livrée <span className="italic text-accent">là où tu es</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Tout'ICI connecte les meilleurs restaurants d'Abidjan, Bouaké,
            Yamoussoukro et San-Pédro à ta porte. Calcul GPS précis,
            portefeuille intégré, points relais partout.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/restaurants">
              <Button size="lg" className="bg-gradient-primary shadow-glow border-0 h-12 px-6">
                Explorer les restaurants <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 px-6 border-border/60">
                Créer un compte
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Navigation, title: "Distance GPS précise", desc: "Frais calculés au km réel entre le restaurant et vous." },
            { icon: Wallet, title: "Wallet intégré", desc: "Rechargez et payez en un tap. Ou choisissez cash / SmartPay." },
            { icon: Timer, title: "Livraison planifiée", desc: "Choisissez le jour et l'heure exacte de réception." },
          ].map((f) => (
            <Card key={f.title} className="p-6 bg-gradient-card border-border/40 shadow-card">
              <f.icon className="h-8 w-8 text-primary-glow mb-4" />
              <h3 className="font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* RESTAURANTS PREVIEW */}
      {restaurants && restaurants.length > 0 && (
        <section className="container mx-auto px-4 pb-24">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold">Stands en vedette</h2>
              <p className="text-muted-foreground mt-1">Découverte du moment.</p>
            </div>
            <Link to="/restaurants" className="text-sm text-primary-glow hover:underline">
              Voir tout →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((r) => (
              <Link key={r.id} to="/restaurants/$id" params={{ id: r.id }}>
                <Card className="overflow-hidden bg-gradient-card border-border/40 shadow-card hover:shadow-elegant transition-all group h-full">
                  <div className="aspect-[16/10] bg-gradient-primary/30 relative overflow-hidden">
                    {r.banner_url ? (
                      <img src={r.banner_url} alt={r.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-4xl font-display">{r.name[0]}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-lg font-semibold truncate">{r.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{r.neighborhood}, {r.city}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
