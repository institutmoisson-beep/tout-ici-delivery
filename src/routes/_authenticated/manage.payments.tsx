import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { ManageShell } from "@/components/manage/manage-shell";
import { GatewaysAdmin } from "./admin";

export const Route = createFileRoute("/_authenticated/manage/payments")({
  component: RouteView,
});

function RouteView() {
  return (
    <ManageShell
      domain="payments"
      icon={Zap}
      title="Espace Passerelles de paiement"
      description="Vous configurez uniquement les moyens de paiement."
    >
      <GatewaysAdmin />
    </ManageShell>
  );
}