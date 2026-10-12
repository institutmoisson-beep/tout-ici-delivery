import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Users, Eye, Search, ShoppingBag, Smartphone, UserPlus, Wallet, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatXof } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Statistiques en direct — Tout'ICI" },
      { name: "description", content: "Visiteurs en direct, pages consultées et activité des utilisateurs Tout'ICI." },
      { property: "og:title", content: "Statistiques en direct — Tout'ICI" },
      { property: "og:description", content: "Tableau de bord d'audience pour l'administrateur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

const EVENT_LABEL: Record<string, string> = { page_view: "a visité", search: "a recherché" };

function AnalyticsPage() {
  const { isAdmin, loading } = useAuth();
  const { data: s, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    enabled: isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_analytics_summary" as any);
      if (error) throw error;
      return data as any;
    },
  });

  if (loading) return <div className="container mx-auto p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!isAdmin) return <div className="container mx-auto p-8">Accès réservé à l'administrateur.</div>;

  const maxDaily = Math.max(1, ...((s?.daily ?? []) as any[]).map((d) => d.visitors));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Statistiques en direct</h1>
          <p className="text-sm text-muted-foreground">Mise à jour automatique toutes les 15 secondes</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Link></Button>
      </div>

      {isLoading || !s ? <p className="text-sm text-muted-foreground">Chargement des données…</p> : (
        <>
          <Card className="p-5 mb-4 bg-gradient-card border-primary/40 ring-1 ring-primary/30 flex items-center gap-4">
            <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-4 w-4 rounded-full bg-primary" /></span>
            <div>
              <p className="font-display text-4xl font-bold">{s.live}</p>
              <p className="text-xs text-muted-foreground">connectés en ce moment · dont {s.live_users} avec compte</p>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat icon={Users} label="Visiteurs aujourd'hui" value={s.day} />
            <Stat icon={Users} label="Cette semaine" value={s.week} />
            <Stat icon={Users} label="Ce mois" value={s.month} />
            <Stat icon={Users} label="Cette année" value={s.year} />
            <Stat icon={Eye} label="Pages vues aujourd'hui" value={s.views_day} />
            <Stat icon={UserPlus} label="Inscrits (jour / mois)" value={`${s.new_users_day} / ${s.new_users_month}`} />
            <Stat icon={Users} label="Comptes au total" value={s.total_users} />
            <Stat icon={ShoppingBag} label="Commandes aujourd'hui" value={s.orders_day} />
            <Stat icon={Wallet} label="Chiffre du mois" value={formatXof(Number(s.revenue_month))} />
            <Stat icon={Smartphone} label="Sur mobile (30 j)" value={`${s.mobile_share}%`} />
          </div>

          <Card className="p-5 mb-4 bg-gradient-card border-border/40">
            <h2 className="font-semibold mb-3">Visiteurs des 14 derniers jours</h2>
            <div className="flex items-end gap-1 h-32">
              {(s.daily as any[]).map((d) => (
                <div key={d.d} className="flex-1 flex flex-col items-center gap-1" title={`${d.d} : ${d.visitors} visiteurs, ${d.views} pages`}>
                  <div className="w-full rounded-t bg-gradient-primary" style={{ height: `${(d.visitors / maxDaily) * 100}%`, minHeight: 2 }} />
                  <span className="text-[9px] text-muted-foreground">{String(d.d).slice(8, 10)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Card className="p-5 bg-gradient-card border-border/40">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Eye className="h-4 w-4" />Pages les plus consultées (30 j)</h2>
              <List rows={(s.top_pages as any[]).map((p) => [p.path, `${p.views} vues · ${p.visitors} pers.`])} empty="Aucune donnée" />
            </Card>
            <Card className="p-5 bg-gradient-card border-border/40">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="h-4 w-4" />Recherches des utilisateurs (30 j)</h2>
              <List rows={(s.searches as any[]).map((q) => [q.q, `${q.n} fois`])} empty="Aucune recherche" />
            </Card>
          </div>

          <Card className="p-5 bg-gradient-card border-border/40">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4" />Activité récente des utilisateurs</h2>
            <div className="space-y-1.5 max-h-[480px] overflow-auto">
              {(s.recent as any[]).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border-b border-border/30 pb-1.5">
                  <span className="text-[11px] text-muted-foreground w-28 shrink-0">{new Date(e.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium truncate">{e.full_name ?? "Visiteur"}</span>
                  <span className="text-muted-foreground">{EVENT_LABEL[e.event] ?? e.event}</span>
                  <span className="truncate text-primary-glow">{e.event === "search" ? `« ${e.meta?.q} »` : e.path}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{e.device}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card className="p-4 bg-gradient-card border-border/40">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Icon className="h-4 w-4" />{label}</div>
      <p className="font-display text-xl font-bold">{value}</p>
    </Card>
  );
}

function List({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-1.5">
      {rows.map(([a, b], i) => (
        <div key={i} className="flex justify-between gap-3 text-sm"><span className="truncate">{a}</span><span className="text-muted-foreground shrink-0">{b}</span></div>
      ))}
    </div>
  );
}
