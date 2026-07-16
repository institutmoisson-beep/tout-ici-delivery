import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export function ProfilesReadonly() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["manage-profiles"],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {data.map((p: any) => (
        <Card key={p.id} className="p-4 bg-gradient-card border-border/40">
          <p className="font-semibold">{p.full_name || "—"}</p>
          <p className="text-xs text-muted-foreground">{p.phone || "Sans téléphone"}</p>
          {p.default_address && <p className="text-xs mt-1">📍 {p.default_address}</p>}
          <p className="text-[10px] text-muted-foreground mt-2">
            Inscrit le {new Date(p.created_at).toLocaleDateString("fr-FR")}
          </p>
        </Card>
      ))}
      {data.length === 0 && <p className="text-sm text-muted-foreground">Aucun profil.</p>}
    </div>
  );
}