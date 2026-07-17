import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { ManageShell } from "@/components/manage/manage-shell";
import { RestaurantsAdmin, DishesAdmin } from "./admin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/manage/restaurants")({
  component: RouteView,
});

function RouteView() {
  return (
    <ManageShell
      domain="restaurants"
      icon={Store}
      title="Espace Restaurants & Plats"
      description="Vous gérez uniquement les restaurants et leurs plats."
    >
      <Tabs defaultValue="restaurants">
        <TabsList>
          <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          <TabsTrigger value="dishes">Plats</TabsTrigger>
        </TabsList>
        <TabsContent value="restaurants" className="mt-6"><RestaurantsAdmin /></TabsContent>
        <TabsContent value="dishes" className="mt-6"><DishesAdmin /></TabsContent>
      </Tabs>
    </ManageShell>
  );
}