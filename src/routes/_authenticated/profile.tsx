import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserIcon, LocateFixed, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", phone: "", default_address: "", default_latitude: "", default_longitude: "" });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (profile) {
      setF({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        default_address: profile.default_address ?? "",
        default_latitude: profile.default_latitude?.toString() ?? "",
        default_longitude: profile.default_longitude?.toString() ?? "",
      });
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name || null,
      phone: f.phone || null,
      default_address: f.default_address || null,
      default_latitude: f.default_latitude ? Number(f.default_latitude) : null,
      default_longitude: f.default_longitude ? Number(f.default_longitude) : null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil enregistré");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  const geolocate = () => {
    if (!("geolocation" in navigator)) return toast.error("Géolocalisation indisponible");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setF((s) => ({ ...s, default_latitude: p.coords.latitude.toString(), default_longitude: p.coords.longitude.toString() }));
        setLocating(false);
        toast.success("Coordonnées récupérées");
      },
      (err) => { setLocating(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <UserIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Mon profil</h1>
      </div>

      <Card className="p-5 bg-gradient-card border-border/40">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="mt-1" />
          </div>
          <div>
            <Label>Nom complet</Label>
            <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} placeholder="Ex : Kouassi N'Guessan" className="mt-1" />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+225 07 00 00 00 00" className="mt-1" />
          </div>
          <div>
            <Label>Adresse par défaut</Label>
            <Textarea value={f.default_address} onChange={(e) => setF({ ...f, default_address: e.target.value })} placeholder="Quartier, rue, indications…" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Latitude</Label><Input type="number" step="any" value={f.default_latitude} onChange={(e) => setF({ ...f, default_latitude: e.target.value })} className="mt-1" /></div>
            <div><Label>Longitude</Label><Input type="number" step="any" value={f.default_longitude} onChange={(e) => setF({ ...f, default_longitude: e.target.value })} className="mt-1" /></div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={geolocate} disabled={locating}>
            <LocateFixed className="h-4 w-4 mr-2" />{locating ? "Localisation…" : "Utiliser ma position"}
          </Button>
          <Button type="submit" disabled={saving} className="w-full bg-gradient-primary border-0">
            <Save className="h-4 w-4 mr-2" />{saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </Card>
    </div>
  );
}