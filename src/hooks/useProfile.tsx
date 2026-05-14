import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ProfileRow {
  id: string;
  full_name: string;
  business_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

/** Convierte "isabella.arango" / "isabella_arango" / "isabella-arango" → "Isabella Arango" */
export function nameFromEmail(email?: string | null): string {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function firstName(fullName?: string | null): string {
  const n = (fullName ?? "").trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Si no hay full_name, derivarlo del email y persistirlo
    if (data && (!data.full_name || data.full_name.trim() === "")) {
      const derived = nameFromEmail(user.email);
      if (derived) {
        const { data: updated } = await supabase
          .from("profiles")
          .update({ full_name: derived })
          .eq("id", user.id)
          .select("id, full_name, business_name, phone, avatar_url")
          .maybeSingle();
        setProfile(updated ?? { ...data, full_name: derived });
        setLoading(false);
        return;
      }
    }

    setProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void fetchProfile();
  }, [authLoading, fetchProfile]);

  const updateProfile = useCallback(
    async (
      patch: Partial<Pick<ProfileRow, "full_name" | "business_name" | "phone" | "avatar_url">>,
    ) => {
      if (!user) return { error: new Error("No user") };
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("id, full_name, business_name, phone, avatar_url")
        .maybeSingle();
      if (!error && data) setProfile(data);
      return { data, error };
    },
    [user],
  );

  const displayName = profile?.full_name?.trim() || nameFromEmail(user?.email) || "Tu cuenta";

  return {
    profile,
    loading: loading || authLoading,
    displayName,
    updateProfile,
    refetch: fetchProfile,
  };
}
