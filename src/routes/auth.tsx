import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — Tout'ICI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bienvenue !");
    navigate({ to: "/" });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Compte créé !");
    navigate({ to: "/" });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Connexion Google impossible");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-hero grid place-items-center px-4 py-12">
      <Card className="w-full max-w-md p-8 bg-gradient-card border-border/50 shadow-elegant">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold">Bienvenue chez Tout'<span className="text-primary-glow">ICI</span></h1>
          <p className="text-sm text-muted-foreground mt-2">Connectez-vous ou créez votre compte</p>
        </div>
        <Button onClick={handleGoogle} variant="outline" className="w-full mb-4 border-border/60">
          Continuer avec Google
        </Button>
        <div className="relative my-4 text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">ou par email</span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-3 mt-4">
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Mot de passe</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary border-0">{loading ? "..." : "Se connecter"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3 mt-4">
              <div><Label>Nom complet</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Téléphone</Label><Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00" /></div>
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Mot de passe</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary border-0">{loading ? "..." : "Créer mon compte"}</Button>
            </form>
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground text-center mt-6">
          En vous inscrivant vous acceptez les <Link to="/cgu" className="underline">CGU/CGV</Link>.
        </p>
      </Card>
    </div>
  );
}