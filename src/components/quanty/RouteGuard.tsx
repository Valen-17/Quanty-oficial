import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

// Redirige a /auth si no hay sesión.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || user) return;
    if (location.pathname.startsWith("/auth")) return;
    navigate({
      to: "/auth",
      search: { redirect: location.pathname, mode: "login" },
      replace: true,
    });
  }, [loading, user, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
