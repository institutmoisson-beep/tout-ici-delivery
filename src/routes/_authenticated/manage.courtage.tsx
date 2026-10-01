import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ManageShell } from "@/components/manage/manage-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatXof } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/manage/courtage")({
  head: () => ({ meta: [{ title: "Gestion Courtage & Livreurs — Tout'ICI" }] }),
  component: () => (
    <ManageShell domain="courtage" icon={Bike} title="Courtage & Livreurs" description="Demandes, livreurs, affectations et séquestre.">
      <Tabs defaultValue="apps">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="apps">Demandes</TabsTrigger>
          <TabsTrigger value="couriers">Livreurs</TabsTrigger>
          <TabsTrigger value="orders">Commandes séquestre</TabsTrigger>
        </TabsList>
        <TabsContent value="apps"><Applications /></TabsContent>
        <TabsContent value="couriers"><Couriers /></TabsContent>
        <TabsContent value="orders"><EscrowOrders /></TabsContent>
      </Tabs>
    </ManageShell>
  ),
});

const err = (e: unknown) => (e as any)?.message ?? "Erreur";

function Applications() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["courier-apps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courier_applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const review = async (id: string, approve: boolean) => {
    const note = approve ? undefined : window.prompt("Motif du refus (optionnel)") ?? undefined;
    const { error } = await supabase.rpc("admin_review_courier_application", { p_id: id, p_approve: approve, p_note: note });
    if (error) return toast.error(err(error));
    toast.success(approve ? "Demande approuvée — livreur activé" : "Demande refusée");
    qc.invalidateQueries({ queryKey: ["courier-apps"] });
    qc.invalidateQueries({ queryKey: ["couriers"] });
  };
  if (!data.length) return <p className="text-sm text-muted-foreground py-4">Aucune demande.</p>;
  return (
    <div className="space-y-3 mt-3">
      {data.map((a) => (
        <Card key={a.id} className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{a.full_name}</p>
            <Badge variant={a.status === "PENDING" ? "default" : "secondary"}>{a.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{a.phone} · {a.city}{a.vehicle ? ` · ${a.vehicle}` : ""}</p>
          {a.motivation && <p className="text-sm">{a.motivation}</p>}
          {a.admin_note && <p className="text-xs text-muted-foreground">Note : {a.admin_note}</p>}
          {a.status === "PENDING" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(a.id, true)}>Approuver</Button>
              <Button size="sm" variant="outline" onClick={() => review(a.id, false)}>Refuser</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Couriers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const couriers = useQuery({
    queryKey: ["couriers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_couriers");
      if (error) throw error;
      return data ?? [];
    },
  });
  const users = useQuery({
    queryKey: ["courtage-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) return [];
      return data ?? [];
    },
  });
  const ids = new Set((couriers.data ?? []).map((c) => c.id));
  const set = async (uid: string, active: boolean) => {
    const { error } = await supabase.rpc("admin_set_courier", { p_user_id: uid, p_active: active });
    if (error) return toast.error(err(error));
    toast.success(active ? "Utilisateur désigné livreur" : "Rôle livreur retiré");
    qc.invalidateQueries({ queryKey: ["couriers"] });
  };
  const filtered = (users.data ?? [])
    .filter((u) => !ids.has(u.id))
    .filter((u) => q.length > 1 && `${u.full_name} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 10);
  return (
    <div className="space-y-4 mt-3">
      <Card className="p-4 space-y-2">
        <p className="font-semibold text-sm">Désigner un livreur</p>
        <Input placeholder="Rechercher un utilisateur (nom, email, téléphone)" value={q} onChange={(e) => setQ(e.target.value)} />
        {filtered.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{u.full_name || u.email} <span className="text-muted-foreground">{u.email}</span></span>
            <Button size="sm" onClick={() => set(u.id, true)}>Désigner</Button>
          </div>
        ))}
      </Card>
      {(couriers.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun livreur.</p>
      ) : (
        (couriers.data ?? []).map((c) => (
          <Card key={c.id} className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{c.full_name || "Sans nom"}</p>
              <p className="text-xs text-muted-foreground">{c.phone} · {c.active_deliveries} en cours · {c.completed_deliveries} livrées</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => set(c.id, false)}>Retirer</Button>
          </Card>
        ))
      )}
    </div>
  );
}

function EscrowOrders() {
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["escrow-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_escrow_orders");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });
  const couriers = useQuery({
    queryKey: ["couriers"],
    queryFn: async () => (await supabase.rpc("admin_list_couriers")).data ?? [],
  });
  const assign = async (orderId: string, courierId: string) => {
    const { error } = await supabase.rpc("admin_assign_courier", { p_order_id: orderId, p_courier_id: courierId });
    if (error) return toast.error(err(error));
    toast.success("Commande assignée");
    qc.invalidateQueries({ queryKey: ["escrow-orders"] });
  };
  const refund = async (orderId: string) => {
    if (!window.confirm("Rembourser le client et annuler cette commande ?")) return;
    const { error } = await supabase.rpc("admin_refund_escrow", { p_order_id: orderId });
    if (error) return toast.error(err(error));
    toast.success("Client remboursé");
    qc.invalidateQueries({ queryKey: ["escrow-orders"] });
  };
  const name = (id: string | null) => (couriers.data ?? []).find((c) => c.id === id)?.full_name;
  if (!(orders.data ?? []).length) return <p className="text-sm text-muted-foreground py-4">Aucune commande séquestrée.</p>;
  return (
    <div className="space-y-3 mt-3">
      {(orders.data ?? []).map((o) => {
        const open = o.escrow_status === "funds_locked" || o.escrow_status === "delivered_pending_code";
        return (
          <Card key={o.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">#{o.id.slice(0, 8)} · {formatXof(o.total_amount)}</p>
              <Badge variant="secondary">{o.escrow_status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {o.status} · {o.delivery_city ?? "—"} · commission {formatXof(o.commission_amount_fcfa ?? 0)} · livreur : {name(o.courier_id) ?? (o.courier_id ? o.courier_id.slice(0, 8) : "non assigné")}
            </p>
            {open && (
              <div className="flex flex-wrap gap-2">
                <Select onValueChange={(v) => assign(o.id, v)}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Assigner un livreur" /></SelectTrigger>
                  <SelectContent>
                    {(couriers.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name || c.phone || c.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => refund(o.id)}>Rembourser</Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
