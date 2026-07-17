import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ManageShell } from "@/components/manage/manage-shell";
import { RechargesAdmin, DeliveryAdmin, FinanceLedger } from "./admin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/manage/finance")({
  component: RouteView,
});

function RouteView() {
  return (
    <ManageShell
      domain="finance"
      icon={Wallet}
      title="Espace Finance"
      description="Vous gérez uniquement les recharges, tarifs de livraison et le journal financier."
    >
      <Tabs defaultValue="recharges">
        <TabsList>
          <TabsTrigger value="recharges">Recharges</TabsTrigger>
          <TabsTrigger value="delivery">Tarifs livraison</TabsTrigger>
          <TabsTrigger value="ledger">Journal</TabsTrigger>
        </TabsList>
        <TabsContent value="recharges" className="mt-6"><RechargesAdmin /></TabsContent>
        <TabsContent value="delivery" className="mt-6"><DeliveryAdmin /></TabsContent>
        <TabsContent value="ledger" className="mt-6"><FinanceLedger /></TabsContent>
      </Tabs>
    </ManageShell>
  );
}