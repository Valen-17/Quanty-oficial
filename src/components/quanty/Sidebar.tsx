import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Wallet,
  CalendarDays,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/inventario", label: "Inventario", icon: Package },
  { to: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/balance", label: "Balance", icon: Wallet },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-elegant)]">
        <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold text-sidebar-foreground">Quanty</p>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
          Insumos · Cotizaciones
        </p>
      </div>
    </div>
  );
}

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { pathname } = useLocation();

  return (
    <nav className="mt-8 flex flex-1 flex-col gap-1 px-3">
      {navItems.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-4.5 w-4.5 transition-transform group-hover:scale-110",
                active && "text-sidebar-primary",
              )}
            />
            <span>{item.label}</span>
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarFooter() {
  return (
    <div className="mx-3 mb-4 mt-6 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/40 p-4">
      <p className="text-xs font-semibold text-sidebar-foreground">Plan Starter</p>
      <p className="mt-1 text-[11px] text-sidebar-foreground/60">
        Mejora a Pro para reportes ilimitados.
      </p>
      <button className="mt-3 w-full rounded-md bg-sidebar-primary px-3 py-1.5 text-xs font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90">
        Mejorar plan
      </button>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border lg:flex"
      style={{ background: "var(--gradient-sidebar)" }}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border/50 px-4">
        <SidebarBrand />
      </div>
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "var(--gradient-sidebar)" }}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border/50 px-4">
          <SidebarBrand />
          <button
            onClick={onClose}
            className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav onNavigate={onClose} />
        <SidebarFooter />
      </aside>
    </>
  );
}
