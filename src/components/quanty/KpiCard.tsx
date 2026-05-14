import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "success" | "warning" | "muted";
}

const accentMap: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  accent = "primary",
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
            {value}
          </p>
        </div>
        <div
          className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accentMap[accent])}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {positive ? "+" : ""}
            {delta}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[image:var(--gradient-primary)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
      />
    </div>
  );
}
