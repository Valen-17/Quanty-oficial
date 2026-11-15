import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { nameFromEmail } from "@/lib/names";
import { mergeCloudProfileIntoSettings } from "@/lib/profile-settings-sync";

export interface ProfileRow {
  id: string;
  full_name: string;
  business_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  has_employees: boolean;
  employee_count: number;
  currency: string;
  language: string;
}

export type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    | "full_name"
    | "business_name"
    | "phone"
    | "avatar_url"
    | "has_employees"
    | "employee_count"
    | "currency"
    | "language"
  >
>;

interface ProfileContextValue {
  profile: ProfileRow | null;
  loading: boolean;
  displayName: string;
  updateProfile: (patch: ProfilePatch) => Promise<{ data: ProfileRow | null; error: Error | null }>;
  refetch: () => Promise<void>;
}

const PROFILE_COLUMNS =
  "id, full_name, business_name, phone, avatar_url, has_employees, employee_count, currency, language";

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

// Lee el perfil y completa el nombre si está vacío.
async function loadProfile(userId: string, email: string | undefined): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.full_name && data.full_name.trim() !== "") return data;
  const derived = nameFromEmail(email);
  if (!derived) return data;
  const { data: updated } = await supabase
    .from("profiles")
    .update({ full_name: derived })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  return updated ?? { ...data, full_name: derived };
}

// Comparte un solo perfil con toda la app.
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email;
  const [state, setState] = useState<{ userId: string | null; profile: ProfileRow | null }>({
    userId: null,
    profile: null,
  });

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    void loadProfile(userId, userEmail).then((profile) => {
      if (!cancelled) setState({ userId, profile });
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, userEmail]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    const profile = await loadProfile(userId, userEmail);
    setState({ userId, profile });
  }, [userId, userEmail]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) return { data: null, error: new Error("No user") };
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select(PROFILE_COLUMNS)
        .maybeSingle();
      if (error) return { data: null, error: new Error(error.message) };
      if (data) {
        setState({ userId, profile: data });
        mergeCloudProfileIntoSettings(data);
      }
      return { data, error: null };
    },
    [userId],
  );

  const profile = userId && state.userId === userId ? state.profile : null;
  const loading = authLoading || (!!userId && state.userId !== userId);
  const displayName = profile?.full_name?.trim() || nameFromEmail(userEmail) || "Tu cuenta";

  const value = useMemo(
    () => ({ profile, loading, displayName, updateProfile, refetch }),
    [profile, loading, displayName, updateProfile, refetch],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// Acceso al perfil desde cualquier componente.
export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
