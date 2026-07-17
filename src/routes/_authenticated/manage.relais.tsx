import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { ManageShell } from "@/components/manage/manage-shell";
import { RelaisAdmin } from "./admin";

export const Route = createFileRoute("/_authenticated/manage/relais")({
  component: RouteView,
});

function RouteView() {
  return (
    <ManageShell
      domain="relais"
      icon={MapPin}
      title="Espace Points relais"
      description="Vous gérez uniquement les points de retrait."
    >
      <RelaisAdmin />
    </ManageShell>
  );
}