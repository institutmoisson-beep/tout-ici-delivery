import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck, Store, MapPin, Package, Wallet, Zap, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/manage/")({
  component: ManageHub,
});

const ROLES = [
  { domain: "restaurants", to: "/manage/restaurants", label: "Restaurants & Plats", desc: "Créer et gérer les restaurants et leurs plats", icon: Store },
  { domain: "relais", to: "/manage/relais", label: "Points relais", desc: "Ajouter et modifier les points de retrait", icon: MapPin },
  { domain: "orders", to: "/manage/orders", label: "Commandes", desc: "Suivre et partager les commandes reçues", icon: Package },
  { domain: "finance", to: "/manage/finance", label: "Finance", desc: "Recharges, tarifs de livraison et journal", icon: Wallet },
  { domain: "payments", to: "/manage/payments", label: "Passerelles de paiement", desc: "Configurer les moyens de paiement", icon: Zap },
  { domain: "profiles", to: "/manage/profiles", label: "Profils", desc: "Consulter les profils utilisateurs", icon: Users },
] as const;

function ManageHub() {
  const { isAdmin, domains, loading } = useAuth();
  const navigate = useNavigate();
  const shown = ROLES.filter((r) => isAdmin || domains.includes(r.domain));

  useEffect(() => {
    if (!loading && shown.length === 0) {
      toast.error("Aucun rôle de gestion attribué");
      navigate({ to: "/dashboard" });
    }
  }, [loading, shown.length, navigate]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Mes espaces de gestion</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isAdmin ? "Super-administrateur — tous les rôles" : "Chaque rôle est un tableau de bord distinct"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((r) => (
          <Link key={r.domain} to={r.to}>
            <Card className="p-5 h-full bg-gradient-card border-border/40 hover:shadow-glow hover:border-primary/40 transition-all cursor-pointer">
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center mb-3">
                <r.icon className="h-5 w-5 text-primary-glow" />
              </div>
              <p className="font-semibold">{r.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
              <p className="text-xs text-primary-glow mt-3">Ouvrir le tableau de bord →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}