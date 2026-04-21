import { useState, type ReactNode } from "react";
import { Menu, Bell, Search, LogOut } from "lucide-react";
import { DesktopSidebar, MobileSidebar } from "./Sidebar";
import { RequireAuth } from "./RouteGuard";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!source) return "U";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || source[0].toUpperCase();
}

export function AppLayout({ title, subtitle, actions, children }: AppLayoutProps) {
  return (
    <RequireAuth>
      <AppLayoutInner title={title} subtitle={subtitle} actions={actions}>
        {children}
      </AppLayoutInner>
    </RequireAuth>
  );
}

function AppLayoutInner({ title, subtitle, actions, children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { displayName } = useProfile();

  const initials = getInitials(displayName, user?.email);

  return (
    <div className="min-h-screen w-full bg-background">
      <DesktopSidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-foreground hover:bg-muted lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden flex-1 items-center md:flex">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Buscar productos, clientes…"
                className="w-full rounded-lg border border-input bg-secondary/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
                aria-label="Menú de cuenta"
              >
                {initials}
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-card)]">
                    <div className="border-b border-border px-3 py-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
