import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { ManageShell } from "@/components/manage/manage-shell";
import { OrdersLedger } from "./admin";

export const Route = createFileRoute("/_authenticated/manage/orders")({
  component: RouteView,
});

function RouteView() {
  return (
    <ManageShell
      domain="orders"
      icon={Package}
      title="Espace Commandes"
      description="Vous suivez et partagez uniquement les commandes."
    >
      <OrdersLedger />
    </ManageShell>
  );
}