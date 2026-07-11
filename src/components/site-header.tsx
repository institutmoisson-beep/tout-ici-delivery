import { Link, useRouter } from "@tanstack/react-router";
import { ShoppingBag, Wallet, User as UserIcon, LogOut, ShieldCheck, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/70 border-b border-border/50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary shadow-glow grid place-items-center font-display font-bold text-primary-foreground">
            T
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            Tout'<span className="text-primary-glow">ICI</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" activeOptions={{ exact: true }} className="text-muted-foreground hover:text-foreground transition-colors">Accueil</Link>
          <Link to="/restaurants" className="text-muted-foreground hover:text-foreground transition-colors">Restaurants</Link>
          {user && <Link to="/orders" className="text-muted-foreground hover:text-foreground transition-colors">Commandes</Link>}
          {user && <Link to="/wallet" className="text-muted-foreground hover:text-foreground transition-colors">Wallet</Link>}
          {isAdmin && <Link to="/admin" className="text-accent hover:text-accent/80 transition-colors flex items-center gap-1"><ShieldCheck className="h-4 w-4" />Admin</Link>}
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <Link to="/checkout">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center shadow-glow">
                    {count}
                  </span>
                )}
              </Button>
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UserIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.navigate({ to: "/orders" })}>
                  <ShoppingBag className="mr-2 h-4 w-4" />Mes commandes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.navigate({ to: "/wallet" })}>
                  <Wallet className="mr-2 h-4 w-4" />Mon portefeuille
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => router.navigate({ to: "/admin" })}>
                    <ShieldCheck className="mr-2 h-4 w-4" />Console admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); router.navigate({ to: "/" }); }}>
                  <LogOut className="mr-2 h-4 w-4" />Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="bg-gradient-primary shadow-glow border-0">Connexion</Button>
            </Link>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-3 text-sm">
            <Link to="/" onClick={() => setMobileOpen(false)}>Accueil</Link>
            <Link to="/restaurants" onClick={() => setMobileOpen(false)}>Restaurants</Link>
            {user && <Link to="/orders" onClick={() => setMobileOpen(false)}>Commandes</Link>}
            {user && <Link to="/wallet" onClick={() => setMobileOpen(false)}>Wallet</Link>}
            {isAdmin && <Link to="/admin" onClick={() => setMobileOpen(false)}>Admin</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}