import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  domains: string[];
  /** Rôle « courtage » : livreur enregistré, peut voir/scanner les livraisons. */
  isCourier: boolean;
  /** Restaurateur : identifiant de son propre établissement, s'il en gère un. */
  ownedRestaurantId: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  domains: [],
  isCourier: false,
  ownedRestaurantId: null,
  signOut: async () => {},
});

async function loadCourtageContext(
  userId: string,
  setIsCourier: (v: boolean) => void,
  setOwnedRestaurantId: (v: string | null) => void,
) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  setIsCourier(!!roles?.some((r: any) => r.role === "courier"));

  const { data: owned } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  setOwnedRestaurantId(owned?.id ?? null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [isCourier, setIsCourier] = useState(false);
  const [ownedRestaurantId, setOwnedRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(async () => {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", s.user.id);
          setIsAdmin(!!data?.some((r) => r.role === "admin"));
          const { data: mr } = await supabase
            .from("manager_roles")
            .select("domain")
            .eq("user_id", s.user.id);
          setDomains((mr ?? []).map((r: any) => r.domain));
          void loadCourtageContext(s.user.id, setIsCourier, setOwnedRestaurantId);
        }, 0);
      } else {
        setIsAdmin(false);
        setDomains([]);
        setIsCourier(false);
        setOwnedRestaurantId(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        const uid = data.session.user.id;
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .then(({ data: roles }) => {
            setIsAdmin(!!roles?.some((r) => r.role === "admin"));
          });
        supabase
          .from("manager_roles")
          .select("domain")
          .eq("user_id", uid)
          .then(({ data: mr }) => {
            setDomains((mr ?? []).map((r: any) => r.domain));
          });
        void loadCourtageContext(uid, setIsCourier, setOwnedRestaurantId);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        isAdmin,
        domains,
        isCourier,
        ownedRestaurantId,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
