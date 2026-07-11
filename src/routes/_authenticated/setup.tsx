import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupPage,
});

function SetupPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const claim = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("claim_first_admin");
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data) {
      toast.success("Vous êtes maintenant administrateur !");
      setTimeout(() => window.location.assign("/admin"), 500);
    } else {
      toast.error("Un administrateur existe déjà. Impossible de revendiquer.");
      navigate({ to: "/" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card className="p-8 bg-gradient-card border-border/40 text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center mx-auto shadow-glow mb-4">
          <ShieldCheck className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold">Initialisation Tout'ICI</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Revendiquez le rôle d'administrateur si aucun n'existe encore. Cette action n'est possible qu'une seule fois.
        </p>
        <Button onClick={claim} disabled={loading} className="w-full bg-gradient-primary border-0 shadow-glow">
          {loading ? "..." : "Devenir administrateur"}
        </Button>
      </Card>
    </div>
  );
}