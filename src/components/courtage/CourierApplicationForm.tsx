import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function CourierApplicationForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", phone: "", city: "", vehicle: "", motivation: "" });
  const [busy, setBusy] = useState(false);
  const { data: apps = [] } = useQuery({
    queryKey: ["my-courier-apps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("courier_applications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const pending = apps.find((a) => a.status === "PENDING");
  const last = apps[0];

  const submit = async () => {
    if (!user || !f.full_name.trim() || !f.phone.trim() || !f.city.trim()) return toast.error("Nom, téléphone et ville requis");
    setBusy(true);
    const { error } = await supabase.from("courier_applications").insert({
      user_id: user.id,
      full_name: f.full_name.trim(),
      phone: f.phone.trim(),
      city: f.city.trim(),
      vehicle: f.vehicle.trim() || null,
      motivation: f.motivation.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Demande envoyée");
    qc.invalidateQueries({ queryKey: ["my-courier-apps"] });
  };

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Bike className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Devenir livreur</h1>
          <p className="text-xs text-muted-foreground">Votre demande sera étudiée par l'administration.</p>
        </div>
      </div>
      {pending ? (
        <Card className="p-4 space-y-1">
          <Badge>En attente</Badge>
          <p className="text-sm">Votre demande du {new Date(pending.created_at).toLocaleDateString("fr-FR")} est en cours d'examen.</p>
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          {last?.status === "REJECTED" && (
            <p className="text-xs text-muted-foreground">Demande précédente refusée{last.admin_note ? ` : ${last.admin_note}` : ""}. Vous pouvez en refaire une.</p>
          )}
          <Input placeholder="Nom complet" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Input placeholder="Téléphone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Input placeholder="Ville" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <Input placeholder="Véhicule (moto, vélo, voiture…)" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} />
          <Textarea placeholder="Motivation (optionnel)" value={f.motivation} onChange={(e) => setF({ ...f, motivation: e.target.value })} />
          <Button className="w-full" disabled={busy} onClick={submit}>Envoyer ma demande</Button>
        </Card>
      )}
    </div>
  );
}
