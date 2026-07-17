import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ManageShell } from "@/components/manage/manage-shell";
import { ProfilesReadonly } from "@/components/manage/profiles-readonly";

export const Route = createFileRoute("/_authenticated/manage/profiles")({
  component: RouteView,
});

function RouteView() {
  return (
    <ManageShell
      domain="profiles"
      icon={Users}
      title="Espace Profils"
      description="Vous consultez uniquement les profils utilisateurs (lecture seule)."
    >
      <ProfilesReadonly />
    </ManageShell>
  );
}