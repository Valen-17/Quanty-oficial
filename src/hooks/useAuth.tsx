import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { rehydrateAllScopedPersistStores } from "@/lib/rehydrate-persist-stores";
import { rehydrateThenBootstrapRemoteModules } from "@/lib/remote-bootstrap";
import { setScopedPersistenceUserId } from "@/lib/scoped-persist-storage";
import { useRemoteBootstrapStore } from "@/stores/remoteBootstrapStore";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = session?.user?.id ?? null;
    setScopedPersistenceUserId(uid);
    if (loading) return;

    const ac = new AbortController();
    void (async () => {
      if (!uid) {
        useRemoteBootstrapStore.getState().resetForGuest();
        await rehydrateAllScopedPersistStores();
        return;
      }
      await rehydrateThenBootstrapRemoteModules(uid, ac.signal);
    })();

    return () => ac.abort();
  }, [session?.user?.id, loading]);

  useEffect(() => {
    // 1) Set listener FIRST to avoid race conditions
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    // 2) Then read existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
