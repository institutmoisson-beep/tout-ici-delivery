import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { ShieldCheck, Store, UtensilsCrossed, MapPin, Package, Wallet, Zap, Users, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OrdersLedger,
  RestaurantsAdmin,
  DishesAdmin,
  RelaisAdmin,
  DeliveryAdmin,
  RechargesAdmin,
  GatewaysAdmin,
  FinanceLedger,
} from "./admin";
import { ProfilesReadonly } from "@/components/manage/profiles-readonly";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/manage")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ManagePage,
});

type TabDef = { value: string; label: string; icon: any; domain: string; render: () => JSX.Element };

const TABS: TabDef[] = [
  { value: "restaurants", label: "Restaurants", icon: Store, domain: "restaurants", render: () => <RestaurantsAdmin /> },
  { value: "dishes", label: "Plats", icon: UtensilsCrossed, domain: "restaurants", render: () => <DishesAdmin /> },
  { value: "relais", label: "Points relais", icon: MapPin, domain: "relais", render: () => <RelaisAdmin /> },
  { value: "orders", label: "Commandes", icon: Package, domain: "orders", render: () => <OrdersLedger /> },
  { value: "finance", label: "Recharges", icon: Wallet, domain: "finance", render: () => <RechargesAdmin /> },
  { value: "delivery", label: "Tarifs livraison", icon: Truck, domain: "finance", render: () => <DeliveryAdmin /> },
  { value: "ledger", label: "Journal financier", icon: ShieldCheck, domain: "finance", render: () => <FinanceLedger /> },
  { value: "gateways", label: "Passerelles", icon: Zap, domain: "payments", render: () => <GatewaysAdmin /> },
  { value: "profiles", label: "Profils", icon: Users, domain: "profiles", render: () => <ProfilesReadonly /> },
];

function ManagePage() {
  const { isAdmin, domains, loading } = useAuth();
  const navigate = useNavigate();
  const { tab } = Route.useSearch();

  const allowed = useMemo(
    () => TABS.filter((t) => isAdmin || domains.includes(t.domain)),
    [isAdmin, domains],
  );

  useEffect(() => {
    if (!loading && allowed.length === 0) {
      toast.error("Aucun rôle de gestion attribué");
      navigate({ to: "/dashboard" });
    }
  }, [loading, allowed, navigate]);

  if (allowed.length === 0) return null;

  const active = allowed.find((t) => t.value === tab)?.value ?? allowed[0].value;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Mes espaces de gestion</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Super-administrateur" : `Manager : ${domains.join(", ")}`}
          </p>
        </div>
      </div>

      <Tabs value={active} onValueChange={(v) => navigate({ to: "/manage", search: { tab: v } })}>
        <TabsList className="flex flex-wrap h-auto">
          {allowed.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon className="h-4 w-4 mr-1" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {allowed.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-6">
            {t.render()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}