import { useEffect, type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface Props {
  domain: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}

export function ManageShell({ domain, title, description, icon: Icon, children }: Props) {
  const { isAdmin, domains, loading } = useAuth();
  const navigate = useNavigate();
  const allowed = isAdmin || domains.includes(domain);

  useEffect(() => {
    if (!loading && !allowed) {
      toast.error("Accès refusé : ce rôle ne vous est pas attribué");
      navigate({ to: "/dashboard" });
    }
  }, [loading, allowed, navigate]);

  if (loading) return <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!allowed) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight truncate">{title}</h1>
            <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/manage"><ArrowLeft className="h-4 w-4 mr-1" />Mes espaces</Link>
        </Button>
      </div>
      {children}
    </div>
  );
}